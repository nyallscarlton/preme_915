"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User as AuthUser, Session } from "@supabase/supabase-js"

export type UserRole = "applicant" | "lender" | "admin"

export interface User {
  id: string
  email: string
  role: UserRole
  firstName?: string
  lastName?: string
  phone?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function mapAuthUser(authUser: AuthUser, profile?: Record<string, unknown> | null): User {
  return {
    id: authUser.id,
    email: authUser.email!,
    role: (profile?.role as UserRole) || (authUser.user_metadata?.role as UserRole) || "applicant",
    firstName: (profile?.first_name as string) || authUser.user_metadata?.first_name,
    lastName: (profile?.last_name as string) || authUser.user_metadata?.last_name,
    phone: (profile?.phone as string) || undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchProfile = async (authUser: AuthUser): Promise<User> => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single()

    return mapAuthUser(authUser, profile)
  }

  const refreshUser = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (authUser) {
        const mappedUser = await fetchProfile(authUser)
        setUser(mappedUser)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          const mappedUser = await fetchProfile(session.user)
          setUser(mappedUser)
        }
      } catch {
        // No session
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      if (event === "SIGNED_IN" && session?.user) {
        const mappedUser = await fetchProfile(session.user)
        setUser(mappedUser)
      } else if (event === "SIGNED_OUT") {
        setUser(null)
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        const mappedUser = await fetchProfile(session.user)
        setUser(mappedUser)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
