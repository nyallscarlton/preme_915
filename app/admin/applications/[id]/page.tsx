"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browserClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Clock, FileText, Download } from "lucide-react"

export default function AdminApplicationDetailPage() {
  const params = useParams<{ id: string }>()
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

  const appId = params?.id

  return (
    <div className="min-h-screen bg-background text-foreground container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Application {appId}</h1>
        <Button variant="outline" className="border-border text-foreground hover:bg-muted bg-transparent" onClick={() => router.back()}>
          ← Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Details</CardTitle>
              <CardDescription className="text-muted-foreground">Full application context</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>Applicant: John Smith</div>
                <div>Email: john.smith@email.com</div>
                <div>Property: 123 Main Street, Beverly Hills, CA 90210</div>
                <div>Loan Amount: $450,000</div>
                <div>Submitted: Jan 15, 2024</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {["Income Verification", "Bank Statements", "Credit Report"].map((doc) => (
                  <div key={doc} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-[#997100]" />
                      <span className="text-foreground">{doc}</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge className="bg-yellow-600 text-black">Under Review</Badge>
              <div className="space-y-2">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button variant="outline" className="w-full border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-black bg-transparent">
                  <Clock className="mr-2 h-4 w-4" /> Request Info
                </Button>
                <Button variant="outline" className="w-full border-red-600 text-red-600 hover:bg-red-600 hover:text-white bg-transparent">
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


