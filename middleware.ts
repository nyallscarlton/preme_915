import { NextResponse, type NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirect unauthenticated access to /admin routes to admin login
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && pathname !== "/admin/test") {
    // We cannot access Supabase auth here easily; rely on client-side guard and route-level checks.
    // Keep middleware lightweight; allow request to continue.
    // Optionally, could add basic heuristic checks here.
  }

  return NextResponse.next({ request: { headers: request.headers } })
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
