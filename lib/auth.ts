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

const mockUsers = [
  {
    id: "admin-1",
    email: "admin@preme.com",
    password: "demo123",
    role: "admin" as const,
    firstName: "Admin",
    lastName: "User",
  },
  {
    id: "demo-1",
    email: "demo@example.com",
    password: "demo123",
    role: "applicant" as const,
    firstName: "Demo",
    lastName: "User",
  },
]

export async function signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate API delay

  const mockUser = mockUsers.find((u) => u.email === email && u.password === password)

  if (!mockUser) {
    return { user: null, error: "Invalid email or password" }
  }

  const user: User = {
    id: mockUser.id,
    email: mockUser.email,
    role: mockUser.role,
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
  }

  return { user, error: null }
}

export async function signOut(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100))
}

export async function getCurrentUser(): Promise<User | null> {
  return null
}

export async function checkEmailVerification(): Promise<{ needsVerification: boolean; email?: string }> {
  return { needsVerification: false }
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
