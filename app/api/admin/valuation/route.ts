import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/admin/valuation
 * Get estimated property value from Zillow via Jina Reader.
 */
export async function POST(request: NextRequest) {
  const { address } = await request.json()

  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 })
  }

  try {
    // Format address for Zillow URL
    const formatted = address
      .trim()
      .replace(/[,#]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "")

    // Use Jina Reader to fetch Zillow page content
    const zillowUrl = `https://www.zillow.com/homes/${encodeURIComponent(formatted)}_rb/`
    const jinaUrl = `https://r.jina.ai/${zillowUrl}`

    const res = await fetch(jinaUrl, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "text",
      },
    })

    if (!res.ok) {
      return NextResponse.json({ success: false, error: "Could not fetch property data" })
    }

    const text = await res.text()

    // Parse key values from the text content
    const zestimate = extractNumber(text, /Zestimate[:\s®]*\$?([\d,]+)/i)
    const sqft = extractNumber(text, /(\d{3,5})\s*(?:sq\s*ft|sqft)/i)
    const bedrooms = extractNumber(text, /(\d+)\s*(?:bed|bd)/i)
    const bathrooms = extractNumber(text, /(\d+(?:\.\d+)?)\s*(?:bath|ba)/i)
    const yearBuilt = extractNumber(text, /(?:built|year built)[:\s]*(\d{4})/i)
    const lastSold = text.match(/(?:sold|last sold)[:\s]*\$?([\d,]+)/i)
    const lastSoldDate = text.match(/(?:sold|last sold).*?(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2},? \d{4})/i)

    if (!zestimate) {
      // Try alternative: look for price in the content
      const anyPrice = extractNumber(text, /\$\s*([\d,]+(?:,\d{3})+)/i)
      if (anyPrice && anyPrice > 50000) {
        return NextResponse.json({
          success: true,
          address,
          estimatedValue: anyPrice,
          sqft: sqft || 0,
          bedrooms: bedrooms || 0,
          bathrooms: bathrooms || 0,
          yearBuilt: yearBuilt || 0,
          lastSoldPrice: lastSold ? parseInt(lastSold[1].replace(/,/g, "")) : 0,
          lastSoldDate: lastSoldDate?.[1] || "",
          source: "zillow",
        })
      }

      return NextResponse.json({ success: false, error: "No valuation data found" })
    }

    return NextResponse.json({
      success: true,
      address,
      estimatedValue: zestimate,
      sqft: sqft || 0,
      bedrooms: bedrooms || 0,
      bathrooms: bathrooms || 0,
      yearBuilt: yearBuilt || 0,
      lastSoldPrice: lastSold ? parseInt(lastSold[1].replace(/,/g, "")) : 0,
      lastSoldDate: lastSoldDate?.[1] || "",
      source: "zillow",
    })
  } catch (err) {
    console.error("[valuation] Error:", err)
    return NextResponse.json({ success: false, error: "Valuation lookup failed" }, { status: 500 })
  }
}

function extractNumber(text: string, regex: RegExp): number {
  const match = text.match(regex)
  if (!match) return 0
  return parseInt(match[1].replace(/,/g, ""))
}
