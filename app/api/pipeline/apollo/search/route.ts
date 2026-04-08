import { NextRequest, NextResponse } from "next/server"
import { searchContractors } from "@/lib/apollo"

// GET /api/pipeline/apollo/search?metro=dallas&page=1
// Search Apollo for water damage restoration contractors by metro
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const metro = searchParams.get("metro")
  if (!metro) {
    return NextResponse.json({ error: "metro is required (dallas, atlanta, houston)" }, { status: 400 })
  }

  const page = parseInt(searchParams.get("page") || "1", 10)
  const limit = parseInt(searchParams.get("limit") || "25", 10)

  try {
    const results = await searchContractors({
      metro,
      maxResults: Math.min(limit, 100),
      page,
    })

    return NextResponse.json(results)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apollo search failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
