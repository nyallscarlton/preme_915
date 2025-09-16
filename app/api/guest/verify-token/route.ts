export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token) return NextResponse.json({ ok: false, reason: "missing_token" }, { status: 400 })
  return NextResponse.json({ ok: true })
}
