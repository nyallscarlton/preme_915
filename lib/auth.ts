import { supabase } from "./supabase"

export interface User {
  id: string
  email: string
  role: "admin" | "applicant"
  firstName?: string
  lastName?: string
  phone?: string
}

export interface AuthState {
  user: User | null
  loading: boolean
}

export async function signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      if (error.message.includes("email not confirmed")) {
        return { user: null, error: "email_not_confirmed" }
      }
      return { user: null, error: error.message }
    }

    if (data.user) {
      if (!data.user.email_confirmed_at) {
        return { user: null, error: "email_not_confirmed" }
      }

      // Get user profile data from Supabase
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single()

      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        role: profile?.role || "applicant",
        firstName: profile?.first_name || data.user.user_metadata?.first_name,
        lastName: profile?.last_name || data.user.user_metadata?.last_name,
        phone: profile?.phone,
      }

      return { user, error: null }
    }

    return { user: null, error: "Authentication failed" }
  } catch (error) {
    return { user: null, error: "Authentication failed" }
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return null
    }

    // Get user profile data from Supabase
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()

    const user: User = {
      id: session.user.id,
      email: session.user.email!,
      role: profile?.role || "applicant",
      firstName: profile?.first_name || session.user.user_metadata?.first_name,
      lastName: profile?.last_name || session.user.user_metadata?.last_name,
      phone: profile?.phone,
    }

    return user
  } catch (error) {
    return null
  }
}

export async function checkEmailVerification(): Promise<{ needsVerification: boolean; email?: string }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return { needsVerification: false }
    }

    if (!session.user.email_confirmed_at) {
      return { needsVerification: true, email: session.user.email }
    }

    return { needsVerification: false }
  } catch (error) {
    return { needsVerification: false }
  }
}

export function requireAuth(allowedRoles?: ("admin" | "applicant")[]): (user: User | null) => boolean {
  return (user: User | null) => {
    if (!user) return false
    if (!allowedRoles) return true
    return allowedRoles.includes(user.role)
  }
}

export function requireAdmin(user: User | null): boolean {
  return requireAuth(["admin"])(user)
}

export function requireApplicant(user: User | null): boolean {
  return requireAuth(["applicant"])(user)
}
