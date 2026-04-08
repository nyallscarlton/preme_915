import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/pipeline/valuation
 * Get estimated property value using Zillow autocomplete + zpid detail page.
 * Two-step approach: autocomplete gets zpid, then scrape detail page via Browserless.
 * Falls back to Jina Reader if Browserless unavailable.
 */
export async function POST(request: NextRequest) {
  const { address } = await request.json()

  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 })
  }

  try {
    // Step 1: Get zpid from Zillow autocomplete (this endpoint is not bot-protected)
    const autocompleteRes = await fetch(
      `https://www.zillowstatic.com/autocomplete/v3/suggestions?q=${encodeURIComponent(address)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } }
    )

    if (!autocompleteRes.ok) {
      return NextResponse.json({ success: false, error: "Could not look up address" })
    }

    const autocomplete = await autocompleteRes.json()
    const result = autocomplete.results?.[0]

    if (!result?.metaData?.zpid) {
      return NextResponse.json({ success: false, error: "Address not found on Zillow" })
    }

    const zpid = result.metaData.zpid
    const cleanAddress = result.display || address
    const lat = result.metaData.lat
    const lng = result.metaData.lng

    // Step 2: Try to get property details from the detail page
    const detailUrl = `https://www.zillow.com/homedetails/${cleanAddress.replace(/[,\s]+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}/${zpid}_zpid/`

    // Try Jina Reader first (free, sometimes works)
    let propertyData = await tryJinaReader(detailUrl)

    // If Jina failed, try Firecrawl
    if (!propertyData && process.env.FIRECRAWL_API_KEY) {
      propertyData = await tryFirecrawl(detailUrl)
    }

    // If scraping failed, return basic data from autocomplete
    if (!propertyData) {
      // Use Zillow's search results page which sometimes has price data
      const searchData = await tryZillowSearch(cleanAddress)
      if (searchData) {
        return NextResponse.json({
          success: true,
          address: cleanAddress,
          estimatedValue: searchData.price,
          sqft: searchData.sqft || 0,
          bedrooms: searchData.beds || 0,
          bathrooms: searchData.baths || 0,
          yearBuilt: 0,
          lastSoldPrice: 0,
          lastSoldDate: "",
          homeType: searchData.homeType || "",
          source: "zillow",
        })
      }

      return NextResponse.json({
        success: false,
        error: "Property found on Zillow but couldn't retrieve valuation. Try searching manually.",
        zpid,
        zillowUrl: detailUrl,
      })
    }

    return NextResponse.json({
      success: true,
      address: cleanAddress,
      ...propertyData,
      source: "zillow",
    })
  } catch (err) {
    console.error("[valuation] Error:", err)
    return NextResponse.json({ success: false, error: "Valuation lookup failed" }, { status: 500 })
  }
}

async function tryJinaReader(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain", "X-Return-Format": "text" },
    })
    if (!res.ok) return null

    const text = await res.text()
    if (text.includes("Press & Hold to confirm") || text.includes("CAPTCHA")) return null

    return parsePropertyText(text)
  } catch {
    return null
  }
}

async function tryFirecrawl(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    })
    if (!res.ok) return null

    const data = await res.json()
    if (!data.success) return null

    const text = data.data?.markdown || ""
    if (text.includes("Press & Hold") || text.includes("CAPTCHA")) return null

    return parsePropertyText(text)
  } catch {
    return null
  }
}

async function tryZillowSearch(address: string): Promise<{ price: number; sqft?: number; beds?: number; baths?: number; homeType?: string } | null> {
  try {
    // Try Jina on Zillow search results page
    const searchUrl = `https://www.zillow.com/homes/${address.replace(/[,\s]+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}_rb/`
    const res = await fetch(`https://r.jina.ai/${searchUrl}`, {
      headers: { Accept: "text/plain" },
    })
    if (!res.ok) return null

    const text = await res.text()
    if (text.includes("Press & Hold") || text.includes("CAPTCHA")) return null

    const priceMatch = text.match(/\$\s*([\d,]+(?:,\d{3})+)/)
    if (!priceMatch) return null

    const price = parseInt(priceMatch[1].replace(/,/g, ""))
    if (price < 30000) return null

    return {
      price,
      sqft: extractNum(text, /(\d{3,5})\s*(?:sq\s*ft|sqft)/i),
      beds: extractNum(text, /(\d+)\s*(?:bed|bd)/i),
      baths: extractNum(text, /(\d+(?:\.\d+)?)\s*(?:bath|ba)/i),
    }
  } catch {
    return null
  }
}

function parsePropertyText(text: string): Record<string, unknown> | null {
  const zestimate = extractNum(text, /Zestimate[:\s®]*\$?([\d,]+)/i)
  const price = zestimate || extractNum(text, /\$\s*([\d,]+(?:,\d{3})+)/)

  if (!price || price < 30000) return null

  return {
    estimatedValue: price,
    sqft: extractNum(text, /(\d{3,5})\s*(?:sq\s*ft|sqft)/i),
    bedrooms: extractNum(text, /(\d+)\s*(?:bed|bd)/i),
    bathrooms: extractNum(text, /(\d+(?:\.\d+)?)\s*(?:bath|ba)/i),
    yearBuilt: extractNum(text, /(?:built|year built)[:\s]*(\d{4})/i),
    lastSoldPrice: extractNum(text, /(?:sold|last sold)[:\s]*\$?([\d,]+)/i),
    lastSoldDate: text.match(/(?:sold|last sold).*?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2},? \d{4})/i)?.[1] || "",
    homeType: "",
  }
}

function extractNum(text: string, regex: RegExp): number {
  const match = text.match(regex)
  if (!match) return 0
  return parseInt(match[1].replace(/,/g, ""))
}
