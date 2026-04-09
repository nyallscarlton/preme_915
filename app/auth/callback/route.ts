import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // If no explicit next param, route based on role
      let redirectTo = next
      if (next === "/dashboard") {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Use marathon schema for profile lookup (profiles table lives there)
          const premeSb = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              db: { schema: "preme" },
              cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                  try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                      cookieStore.set(name, value, options)
                    )
                  } catch {}
                },
              },
            }
          )
          const { data: profile } = await premeSb
            .from("profiles")
            .select("role")
            .eq("user_id", user.id)
            .single()
          if (profile?.role === "admin") {
            redirectTo = "/admin"
          } else if (profile?.role === "lender") {
            redirectTo = "/lender"
          }
        }
      }
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  // If code exchange fails, redirect to auth with error
  return NextResponse.redirect(`${origin}/auth?error=callback_failed`)
}
