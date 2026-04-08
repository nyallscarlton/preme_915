import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/pipeline/recording?url=...
 * Proxies Twilio recording URLs that require authentication.
 * Retell recordings (CloudFront) don't need this — they're public.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  // Only proxy Twilio URLs
  if (!url.includes("api.twilio.com")) {
    // For non-Twilio URLs (Retell CloudFront), redirect directly
    return NextResponse.redirect(url)
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Recording not found" }, { status: res.status })
    }

    const body = await res.arrayBuffer()
    const contentType = res.headers.get("content-type") || "audio/mpeg"

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (err) {
    console.error("[recording-proxy] Error:", err)
    return NextResponse.json({ error: "Failed to fetch recording" }, { status: 500 })
  }
}
