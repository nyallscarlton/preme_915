"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface User {
  id: string
  email: string
  role: string
  name?: string
}

interface AuthState {
  user: User | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshUser = async () => {
    console.log("[v0] refreshUser called")
    setLoading(false)
  }

  const handleSignOut = async () => {
    console.log("[v0] signOut called")
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    loading,
    signOut: handleSignOut,
    refreshUser,
    setUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
