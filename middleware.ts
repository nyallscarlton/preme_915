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

  console.log("[v0] Middleware running but auth checks disabled for testing")

  // TODO: Re-enable once Supabase packages are available
  try {
    const {
      data: { session },
    } = await supabaseServer().auth.getSession()

    // Apply routing guards
    if (url.pathname === "/apply") {
      const isGuestMode = url.searchParams.get("guest") === "1"

      // If not guest mode and no authenticated session, redirect to auth
      if (!isGuestMode && !session?.user?.email_confirmed_at) {
        const redirectUrl = new URL("/auth", request.url)
        redirectUrl.searchParams.set("next", "/apply")
        return NextResponse.redirect(redirectUrl)
      }
    }

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
