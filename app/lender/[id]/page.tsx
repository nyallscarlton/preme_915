"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  User,
  Home,
  Upload,
  MessageSquare,
  Shield,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"

interface ApplicationDetail {
  id: string
  application_number: string
  applicant_name: string
  applicant_email: string
  applicant_phone: string
  status: string
  loan_amount: number
  loan_type: string
  loan_purpose: string
  property_address: string
  property_city: string
  property_state: string
  property_zip: string
  property_type: string
  property_value: number
  annual_income: number
  employment_status: string
  employer_name: string
  credit_score_range: string
  has_sponsor: boolean
  sponsor_name: string
  sponsor_email: string
  sponsor_phone: string
  cash_reserves: number
  investment_accounts: number
  retirement_accounts: number
  submitted_at: string
  created_at: string
  updated_at: string
}

interface StatusHistoryEntry {
  id: string
  old_status: string
  new_status: string
  created_at: string
  notes: string
}

interface Document {
  id: string
  file_name: string
  document_type: string
  status: string
  created_at: string
}

interface Condition {
  id: string
  title: string
  description: string
  status: string
  due_date: string
  created_at: string
}

export default function LenderApplicationDetail() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [app, setApp] = useState<ApplicationDetail | null>(null)
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [conditions, setConditions] = useState<Condition[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [notes, setNotes] = useState("")
  const [newCondition, setNewCondition] = useState({ title: "", description: "", due_date: "" })

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const appId = params.id as string

      const [appResult, historyResult, docsResult, conditionsResult] = await Promise.all([
        supabase.from("loan_applications").select("*").eq("id", appId).single(),
        supabase
          .from("status_history")
          .select("*")
          .eq("application_id", appId)
          .order("created_at", { ascending: false }),
        supabase
          .from("loan_documents")
          .select("*")
          .eq("application_id", appId)
          .order("created_at", { ascending: false }),
        supabase
          .from("conditions")
          .select("*")
          .eq("application_id", appId)
          .order("created_at", { ascending: false }),
      ])

      if (appResult.data) setApp(appResult.data)
      if (historyResult.data) setStatusHistory(historyResult.data)
      if (docsResult.data) setDocuments(docsResult.data)
      if (conditionsResult.data) setConditions(conditionsResult.data)
      setLoading(false)
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const updateStatus = async (newStatus: string) => {
    if (!app) return
    setUpdating(true)

    const { error } = await supabase
      .from("loan_applications")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", app.id)

    if (!error) {
      setApp({ ...app, status: newStatus })
      // Refresh history
      const { data } = await supabase
        .from("status_history")
        .select("*")
        .eq("application_id", app.id)
        .order("created_at", { ascending: false })
      if (data) setStatusHistory(data)

      // Notify MC
      fetch(`/api/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }).catch(() => {})
    }

    setUpdating(false)
  }

  const updateDocStatus = async (docId: string, status: string) => {
    await supabase.from("loan_documents").update({ status }).eq("id", docId)
    setDocuments(documents.map((d) => (d.id === docId ? { ...d, status } : d)))
  }

  const addCondition = async () => {
    if (!app || !newCondition.title) return

    const { data, error } = await supabase
      .from("conditions")
      .insert({
        application_id: app.id,
        title: newCondition.title,
        description: newCondition.description,
        due_date: newCondition.due_date || null,
        created_by: user?.id,
      })
      .select()
      .single()

    if (!error && data) {
      setConditions([data, ...conditions])
      setNewCondition({ title: "", description: "", due_date: "" })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-600 text-white"
      case "under_review":
        return "bg-yellow-600 text-black"
      case "submitted":
        return "bg-blue-600 text-white"
      case "rejected":
        return "bg-red-600 text-white"
      case "on_hold":
        return "bg-orange-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const formatStatus = (status: string) =>
    status
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100]"></div>
      </div>
    )
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-foreground">Application not found</p>
          <Button className="mt-4" asChild>
            <Link href="/lender">Back to Pipeline</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/lender">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Pipeline
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h2 className="font-semibold">{app.application_number}</h2>
                <p className="text-xs text-muted-foreground">{app.applicant_name}</p>
              </div>
            </div>
            <Badge className={getStatusColor(app.status)}>{formatStatus(app.status)}</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="bg-muted border border-border mb-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
            <TabsTrigger value="conditions">Conditions ({conditions.length})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Application info */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Borrower Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{app.applicant_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{app.applicant_email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{app.applicant_phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Employment</p>
                      <p className="font-medium">{app.employment_status || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Employer</p>
                      <p className="font-medium">{app.employer_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Annual Income</p>
                      <p className="font-medium">
                        {app.annual_income ? `$${app.annual_income.toLocaleString()}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Credit Score</p>
                      <p className="font-medium">{app.credit_score_range || "—"}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Home className="h-5 w-5 mr-2" />
                      Property & Loan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Loan Amount</p>
                      <p className="font-medium text-lg">
                        ${(app.loan_amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Property Value</p>
                      <p className="font-medium text-lg">
                        ${(app.property_value || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Loan Type</p>
                      <p className="font-medium">{app.loan_type || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Purpose</p>
                      <p className="font-medium">{app.loan_purpose || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Property Address</p>
                      <p className="font-medium">
                        {[app.property_address, app.property_city, app.property_state, app.property_zip]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Property Type</p>
                      <p className="font-medium">{app.property_type || "—"}</p>
                    </div>
                    {app.has_sponsor && (
                      <>
                        <div className="col-span-2">
                          <Separator className="my-2" />
                        </div>
                        <div>
                          <p className="text-muted-foreground">Sponsor</p>
                          <p className="font-medium">{app.sponsor_name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Sponsor Contact</p>
                          <p className="font-medium">{app.sponsor_email || "—"}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <DollarSign className="h-5 w-5 mr-2" />
                      Liquidity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Cash Reserves</p>
                      <p className="font-medium">
                        ${(app.cash_reserves || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Investments</p>
                      <p className="font-medium">
                        ${(app.investment_accounts || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Retirement</p>
                      <p className="font-medium">
                        ${(app.retirement_accounts || 0).toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Status controls */}
              <div className="space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Shield className="h-5 w-5 mr-2" />
                      Status Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {["submitted", "under_review", "approved", "rejected", "on_hold"].map(
                        (status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={app.status === status ? "default" : "outline"}
                            className={
                              app.status === status
                                ? "bg-[#997100] text-black"
                                : "bg-transparent"
                            }
                            disabled={updating || app.status === status}
                            onClick={() => updateStatus(status)}
                          >
                            {formatStatus(status)}
                          </Button>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Submitted</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {app.submitted_at
                        ? new Date(app.submitted_at).toLocaleString()
                        : "—"}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>LTV Ratio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {app.property_value && app.loan_amount
                        ? ((app.loan_amount / app.property_value) * 100).toFixed(1) + "%"
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Loan to Value</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Uploaded Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No documents uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 bg-muted rounded-lg"
                      >
                        <div className="flex items-center space-x-4">
                          <FileText className="h-8 w-8 text-[#997100]" />
                          <div>
                            <p className="font-medium">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.document_type || "Other"} &middot;{" "}
                              {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            className={
                              doc.status === "approved"
                                ? "bg-green-600 text-white"
                                : doc.status === "rejected"
                                  ? "bg-red-600 text-white"
                                  : "bg-yellow-600 text-black"
                            }
                          >
                            {doc.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent"
                            onClick={() => updateDocStatus(doc.id, "approved")}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent"
                            onClick={() => updateDocStatus(doc.id, "rejected")}
                          >
                            <AlertCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conditions Tab */}
          <TabsContent value="conditions">
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Add Condition</CardTitle>
                  <CardDescription>
                    Create a condition for the borrower to satisfy
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={newCondition.title}
                      onChange={(e) =>
                        setNewCondition({ ...newCondition, title: e.target.value })
                      }
                      placeholder="e.g., Submit 2 months bank statements"
                      className="bg-background border-border"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newCondition.description}
                      onChange={(e) =>
                        setNewCondition({ ...newCondition, description: e.target.value })
                      }
                      placeholder="Additional details..."
                      className="bg-background border-border"
                    />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={newCondition.due_date}
                      onChange={(e) =>
                        setNewCondition({ ...newCondition, due_date: e.target.value })
                      }
                      className="bg-background border-border"
                    />
                  </div>
                  <Button
                    onClick={addCondition}
                    disabled={!newCondition.title}
                    className="bg-[#997100] hover:bg-[#b8850a] text-black"
                  >
                    Add Condition
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Conditions ({conditions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {conditions.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      No conditions added yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {conditions.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-4 bg-muted rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{c.title}</p>
                            {c.description && (
                              <p className="text-sm text-muted-foreground">{c.description}</p>
                            )}
                            {c.due_date && (
                              <p className="text-xs text-muted-foreground">
                                Due: {new Date(c.due_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Badge
                            className={
                              c.status === "approved"
                                ? "bg-green-600 text-white"
                                : c.status === "submitted"
                                  ? "bg-blue-600 text-white"
                                  : c.status === "waived"
                                    ? "bg-gray-600 text-white"
                                    : "bg-yellow-600 text-black"
                            }
                          >
                            {c.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Status History</CardTitle>
              </CardHeader>
              <CardContent>
                {statusHistory.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No status changes recorded yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {statusHistory.map((entry) => (
                      <div key={entry.id} className="flex items-start space-x-4">
                        <div className="w-2 h-2 bg-[#997100] rounded-full mt-2"></div>
                        <div>
                          <div className="flex items-center space-x-2">
                            {entry.old_status && (
                              <>
                                <Badge variant="outline">{formatStatus(entry.old_status)}</Badge>
                                <span className="text-muted-foreground">→</span>
                              </>
                            )}
                            <Badge className={getStatusColor(entry.new_status)}>
                              {formatStatus(entry.new_status)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(entry.created_at).toLocaleString()}
                          </p>
                          {entry.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
