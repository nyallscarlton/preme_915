export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "edge"

import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") || ""
  if (!q || q.length < 3) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", q)
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("addressdetails", "0")
    url.searchParams.set("limit", "8")
    // Restrict results to United States only
    url.searchParams.set("countrycodes", "us")

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "PremeApp/1.0 (contact: support@premeapp.local)",
      },
      // Nominatim rate limits; avoid caching to keep suggestions fresh
      cache: "no-store",
    })

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] }, { status: 200 })
    }

    const items: any[] = await res.json()
    const suggestions = items.map((it) => ({
      place_id: String(it.place_id),
      description: it.display_name as string,
      structured_formatting: {
        main_text: it.name || it.display_name?.split(",")[0] || "",
        secondary_text: it.display_name?.split(",").slice(1).join(",").trim() || "",
      },
    }))

    return NextResponse.json({ suggestions })
  } catch (_) {
    return NextResponse.json({ suggestions: [] }, { status: 200 })
  }
}


