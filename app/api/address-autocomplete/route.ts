import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")

  if (!query || query.length < 3) {
    return NextResponse.json([])
  }

  try {
    const params = new URLSearchParams({
      q: query,
      countrycodes: "us",
      format: "json",
      addressdetails: "1",
      limit: "5",
    })

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          "User-Agent": "PremeHomeLoanPortal/1.0 (mortgage application)",
          Accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json([])
    }

    const data = await response.json()

    const suggestions = data
      .filter((item: any) => {
        const type = item.type
        const cls = item.class
        return (
          cls === "place" ||
          cls === "building" ||
          cls === "highway" ||
          type === "house" ||
          type === "residential" ||
          type === "apartments"
        )
      })
      .map((item: any, index: number) => {
        const addr = item.address || {}
        const houseNumber = addr.house_number || ""
        const road = addr.road || ""
        const city =
          addr.city || addr.town || addr.village || addr.hamlet || ""
        const state = addr.state || ""
        const postcode = addr.postcode || ""

        const mainText = [houseNumber, road].filter(Boolean).join(" ") || item.display_name.split(",")[0]
        const secondaryParts = [city, state, postcode].filter(Boolean)
        const secondaryText = secondaryParts.join(", ")

        const fullAddress = [mainText, secondaryText]
          .filter(Boolean)
          .join(", ")

        return {
          place_id: String(item.place_id || index),
          description: fullAddress,
          structured_formatting: {
            main_text: mainText,
            secondary_text: secondaryText,
          },
        }
      })

    return NextResponse.json(suggestions)
  } catch {
    return NextResponse.json([])
  }
}
