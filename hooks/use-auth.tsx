"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me")
      if (!res.ok) {
        setUser(null)
        return
      }
      const data = await res.json()
      setUser(data.user || null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    await fetchUser()
  }, [fetchUser])

  const handleSignOut = useCallback(async () => {
    // Clear cookies via server-side sign-out
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {})
    setUser(null)
    setLoading(false)
    window.location.href = "/"
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

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
