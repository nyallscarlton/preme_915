import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    // In a real app, verify token in DB, check expiry, return data
    if (!token.startsWith("ml_")) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 401 })
    }

    const applicationData = { id: "app_123" }
    return NextResponse.json({ success: true, application: applicationData })
  } catch (error) {
    return NextResponse.json({ error: "Failed to verify token" }, { status: 500 })
  }
}
