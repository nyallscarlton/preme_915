import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()

  // Skip middleware for static files and API routes
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  const { supabaseResponse, user } = await updateSession(request)

  // Protected routes that require authentication
  const protectedPaths = ["/dashboard", "/portal"]
  const lenderPaths = ["/lender"]
  const adminPaths = ["/admin"]

  const isProtected = protectedPaths.some((p) => url.pathname.startsWith(p))
  const isLenderRoute = lenderPaths.some((p) => url.pathname.startsWith(p))
  const isAdminRoute = adminPaths.some((p) => url.pathname.startsWith(p))

  // Redirect unauthenticated users from protected routes
  if ((isProtected || isLenderRoute || isAdminRoute) && !user) {
    const redirectUrl = new URL("/auth", request.url)
    redirectUrl.searchParams.set("next", url.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // /apply route: allow guest mode or authenticated users
  if (url.pathname === "/apply") {
    const isGuestMode = url.searchParams.get("guest") === "1"
    if (!isGuestMode && !user) {
      const redirectUrl = new URL("/auth", request.url)
      redirectUrl.searchParams.set("next", "/apply")
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Role-based access for lender routes
  if (isLenderRoute && user) {
    const { createServerClient } = await import("@supabase/ssr")
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // Role-based access for admin routes
  if (isAdminRoute && user) {
    const { createServerClient } = await import("@supabase/ssr")
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
