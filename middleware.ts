import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const host = request.headers.get("host")?.replace(/:.*$/, "") || ""

  // ── app.premerealestate.com host routing ──────────────────────────
  // The "app" subdomain is the Preme Lead Pipeline UI (ported from
  // Zentryx admin). The bare/www domain still serves the marketing
  // site + the existing /admin loan portal.
  //
  // On this host:
  //  - "/" → "/pipeline"
  //  - "/admin" or "/admin/*" → "/pipeline" or "/pipeline/*" (rewrite, not redirect)
  //  - HTTP Basic auth required for /pipeline + /admin
  //  - Everything else passes through to whatever route exists
  //
  // We do this BEFORE the static-file/_next bail-out so it always runs.
  if (host === "app.premerealestate.com") {
    const isPipelineUi =
      url.pathname === "/" ||
      url.pathname === "/admin" ||
      url.pathname.startsWith("/admin/") ||
      url.pathname === "/pipeline" ||
      url.pathname.startsWith("/pipeline/")

    if (isPipelineUi) {
      // HTTP Basic auth — same pattern as zentryx admin
      const sessionCookie = request.cookies.get("zx_admin_session")
      const authedViaCookie = sessionCookie?.value === "authenticated"

      let authedViaHeader = false
      const authHeader = request.headers.get("authorization") || ""
      if (authHeader.startsWith("Basic ")) {
        const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8")
        const [user, pass] = decoded.split(":")
        if (
          user === (process.env.ADMIN_USERNAME || "admin") &&
          pass === (process.env.ADMIN_PASSWORD || "")
        ) {
          authedViaHeader = true
        }
      }

      if (!authedViaCookie && !authedViaHeader) {
        return new NextResponse("Unauthorized", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Preme Pipeline"' },
        })
      }
    }

    if (url.pathname === "/") {
      url.pathname = "/pipeline"
      const res = NextResponse.rewrite(url)
      res.cookies.set("zx_admin_session", "authenticated", { httpOnly: true, sameSite: "lax", path: "/" })
      return res
    }
    if (url.pathname === "/admin") {
      url.pathname = "/pipeline"
      const res = NextResponse.rewrite(url)
      res.cookies.set("zx_admin_session", "authenticated", { httpOnly: true, sameSite: "lax", path: "/" })
      return res
    }
    if (url.pathname.startsWith("/admin/")) {
      url.pathname = "/pipeline" + url.pathname.slice("/admin".length)
      const res = NextResponse.rewrite(url)
      res.cookies.set("zx_admin_session", "authenticated", { httpOnly: true, sameSite: "lax", path: "/" })
      return res
    }

    // /pipeline/* — set the cookie and pass through
    if (url.pathname.startsWith("/pipeline")) {
      const res = NextResponse.next()
      res.cookies.set("zx_admin_session", "authenticated", { httpOnly: true, sameSite: "lax", path: "/" })
      return res
    }
  }

  // Skip middleware for static files, API routes, and the lead pipeline UI
  // (the pipeline uses HTTP Basic auth via lib/zx-admin-auth.ts at the route level)
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/pipeline") ||
    url.pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  const { supabaseResponse, user } = await updateSession(request)

  // Protected routes that require authentication
  const protectedPaths = ["/dashboard", "/portal"]
  const lenderPaths = ["/lender", "/portals", "/conditions"]
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

  // Redirect admin/lender users from /dashboard to /lender
  if (url.pathname === "/dashboard" && user) {
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
      .eq("user_id", user.id)
      .single()

    if (profile && (profile.role === "lender" || profile.role === "admin")) {
      return NextResponse.redirect(new URL("/lender", request.url))
    }
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
      .eq("user_id", user.id)
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
      .eq("user_id", user.id)
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
