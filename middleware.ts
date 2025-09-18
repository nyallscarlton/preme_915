import { NextResponse, type NextRequest } from "next/server"
import { supabaseServer } from "@/lib/supabase/serverClient"

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const url = request.nextUrl.clone()

  // Skip middleware for static files and API routes
  if (url.pathname.startsWith("/_next") || url.pathname.startsWith("/api") || url.pathname.includes(".")) {
    return response
  }

  console.log("[v1] Middleware running in pass-through mode (no auth redirects)")

  // TODO: Re-enable once Supabase packages are available
  try {
    const {
      data: { session },
    } = await supabaseServer().auth.getSession()

    // Temporarily disable auth-based redirects to avoid re-login loops
    // We'll rely on page-level guards instead.

    // Refresh session if needed
    if (session) {
      await supabaseServer().auth.getUser()
    }
  } catch (error) {
    console.error("Middleware error:", error)
    // Continue without authentication if there's an error
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
