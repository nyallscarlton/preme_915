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
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: UserRole
  created_at: string
}

function mapProfileToUser(profile: Profile): User {
  return {
    id: profile.user_id,
    email: profile.email,
    role: profile.role,
    firstName: profile.first_name || undefined,
    lastName: profile.last_name || undefined,
    phone: profile.phone || undefined,
  }
}

async function ensureProfile(
  userId: string,
  email: string,
  firstName?: string,
  lastName?: string,
  role?: string
): Promise<Profile | null> {
  const supabase = createClient()

  // Try to fetch existing profile
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (existing) return existing

  // Create profile if it doesn't exist
  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      user_id: userId,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      role: role || "applicant",
    })
    .select()
    .single()

  if (error) {
    // RLS might block insert — profile will be created via API route fallback
    console.warn("Could not create profile client-side:", error.message)
    return null
  }

  return created
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

  // Non-blocking: ensure profile row exists for future queries
  ensureProfile(
    data.user.id,
    data.user.email!,
    data.user.user_metadata?.first_name,
    data.user.user_metadata?.last_name,
    data.user.user_metadata?.role
  ).catch(() => {})

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
    // Handle the broken trigger error gracefully
    if (error.message.includes("profiles") && error.message.includes("not-null")) {
      // Trigger failed but user was created — fix profile via API
      const { data: retryData } = await supabase.auth.signInWithPassword({ email, password })
      if (retryData?.user) {
        await ensureProfile(retryData.user.id, email, firstName, lastName, "applicant")
        return {
          user: {
            id: retryData.user.id,
            email,
            role: "applicant",
            firstName,
            lastName,
          },
          error: null,
        }
      }
    }
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

  // Create profile for the new user
  await ensureProfile(data.user.id, email, firstName, lastName, "applicant")

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

  const profile = await ensureProfile(
    authUser.id,
    authUser.email!,
    authUser.user_metadata?.first_name,
    authUser.user_metadata?.last_name,
    authUser.user_metadata?.role
  )

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
