import { NextRequest, NextResponse } from "next/server"

export function verifyAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  if (!authHeader) return false

  const [scheme, encoded] = authHeader.split(" ")
  if (scheme !== "Basic" || !encoded) return false

  const decoded = Buffer.from(encoded, "base64").toString("utf-8")
  const [username, password] = decoded.split(":")

  return (
    username === (process.env.ADMIN_USERNAME || "admin") &&
    password === (process.env.ADMIN_PASSWORD || "")
  )
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Zentryx Admin"' },
    }
  )
}

export function checkAdminAuth(request: NextRequest) {
  // Check cookie first (session persistence)
  const sessionCookie = request.cookies.get("zx_admin_session")
  if (sessionCookie?.value === "authenticated") return true

  return verifyAdmin(request)
}
