"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browserClient"
import { ApplicationsManagement } from "@/components/admin/applications-management"

const mockApplications = [
  {
    id: "PREME-2024-001",
    applicantName: "John Smith",
    applicantEmail: "john.smith@email.com",
    propertyAddress: "123 Main Street, Beverly Hills, CA 90210",
    loanAmount: 450000,
    status: "under_review",
    submittedAt: "2024-01-15T10:30:00Z",
    loanType: "Single Family Home",
    progress: 65,
    assignedTo: "Sarah Johnson",
  },
]

export default function AdminApplicationsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean>(false)

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      const user = session?.user
      if (!user) {
        router.replace("/admin/login")
        return
      }
      const { data: profile } = await supabaseBrowser
        .from("profiles")
        .select("is_admin, role")
        .eq("id", user.id)
        .maybeSingle()
      if (!profile || !(profile as any).is_admin) {
        router.replace("/")
        return
      }
      setAuthorized(true)
    }
    check()
  }, [router])

  if (!authorized) return null

  return (
    <div className="min-h-screen bg-background text-foreground container mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-6">Applications</h1>
      <ApplicationsManagement applications={mockApplications as any} />
    </div>
  )
}


