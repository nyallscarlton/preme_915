import { createClient } from "@/lib/supabase/client"

export type UserRole = "applicant" | "lender" | "admin"

export interface User {
  id: string
  email: string
  role: UserRole
  firstName?: string
  lastName?: string
  phone?: string
}

export interface AuthState {
  user: User | null
  loading: boolean
}

export interface Profile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: UserRole
  created_at: string
}

function mapProfileToUser(profile: Profile): User {
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    firstName: profile.first_name || undefined,
    lastName: profile.last_name || undefined,
    phone: profile.phone || undefined,
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { user: null, error: error.message }
  }

  if (!data.user) {
    return { user: null, error: "Sign in failed" }
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single()

  if (profile) {
    return { user: mapProfileToUser(profile), error: null }
  }

  // Fallback if profile not yet created
  return {
    user: {
      id: data.user.id,
      email: data.user.email!,
      role: (data.user.user_metadata?.role as UserRole) || "applicant",
      firstName: data.user.user_metadata?.first_name,
      lastName: data.user.user_metadata?.last_name,
    },
    error: null,
  }
}

export async function signInWithMagicLink(
  email: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<{ user: User | null; error: string | null; needsVerification?: boolean }> {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: "applicant",
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    return { user: null, error: error.message }
  }

  if (!data.user) {
    return { user: null, error: "Sign up failed" }
  }

  // If email confirmation is required
  if (!data.session) {
    return {
      user: null,
      error: null,
      needsVerification: true,
    }
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email!,
      role: "applicant",
      firstName,
      lastName,
    },
    error: null,
  }
}

export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .single()

  if (profile) {
    return mapProfileToUser(profile)
  }

  return {
    id: authUser.id,
    email: authUser.email!,
    role: (authUser.user_metadata?.role as UserRole) || "applicant",
    firstName: authUser.user_metadata?.first_name,
    lastName: authUser.user_metadata?.last_name,
  }
}

export function requireAuth(allowedRoles?: UserRole[]): (user: User | null) => boolean {
  return (user: User | null) => {
    if (!user) return false
    if (!allowedRoles) return true
    return allowedRoles.includes(user.role)
  }
}

export function requireAdmin(user: User | null): boolean {
  return requireAuth(["admin"])(user)
}

export function requireLender(user: User | null): boolean {
  return requireAuth(["lender", "admin"])(user)
}

export function requireApplicant(user: User | null): boolean {
  return requireAuth(["applicant"])(user)
}
