"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
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
  Building2,
  XCircle,
  Loader2,
  Phone,
  Send,
  PhoneIncoming,
  PhoneOutgoing,
  Mail,
  Pencil,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"

// --- Types ---

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

interface Condition {
  id: string
  title: string
  description: string
  status: string
  due_date: string
  created_at: string
  created_by: string | null
}

interface DscrLender {
  id: string
  name: string
  short_name: string
  min_fico: number
  min_loan: number
  max_loan: number | null
  min_dscr: number
  max_term: string | null
}

interface MatchResult {
  lender: DscrLender
  qualified: boolean
  reasons: string[]
}

interface ConditionsData {
  conditions: Condition[]
  lenderMatch: {
    matches: MatchResult[]
    application: Record<string, unknown> | null
    stats: { qualified: number; total: number }
  }
  progress: { total: number; received: number; approved: number; pending: number }
  templates: Record<string, string[]>
}

interface Interaction {
  id: string
  phone: string
  channel: string
  direction: string
  entity: string | null
  content: string | null
  summary: string | null
  metadata: Record<string, any> | null
  created_at: string
}

interface ValuationData {
  success: boolean
  address?: string
  estimatedValue?: number
  sqft?: number
  bedrooms?: number
  bathrooms?: number
  yearBuilt?: number
  lastSoldPrice?: number
  lastSoldDate?: string
  source?: string
  error?: string
}

interface Document {
  id: string
  file_name: string
  document_type: string
  status: string
  created_at: string
}

// --- Helpers ---

const getStatusColor = (status: string) => {
  switch (status) {
    case "approved": return "bg-green-600 text-white"
    case "under_review": return "bg-yellow-600 text-black"
    case "submitted": return "bg-blue-600 text-white"
    case "rejected": return "bg-red-600 text-white"
    case "on_hold": return "bg-orange-600 text-white"
    case "funded": return "bg-[#997100] text-white"
    default: return "bg-gray-600 text-white"
  }
}

const formatStatus = (status: string) =>
  status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// --- Component ---

export default function LenderApplicationDetail() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const appId = params.id as string

  // Core data
  const [app, setApp] = useState<ApplicationDetail | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // Conditions + DSCR match
  const [condData, setCondData] = useState<ConditionsData | null>(null)
  const [condLoading, setCondLoading] = useState(false)
  const [newCondLabel, setNewCondLabel] = useState("")
  const [addingCond, setAddingCond] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [portalUrl, setPortalUrl] = useState("")
  const [copiedPortal, setCopiedPortal] = useState(false)

  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [editedFields, setEditedFields] = useState<Record<string, any>>({})
  const [originalApp, setOriginalApp] = useState<ApplicationDetail | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Communication thread
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [interactionsLoading, setInteractionsLoading] = useState(false)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)

  // SMS
  const [smsText, setSmsText] = useState("")
  const [sendingSms, setSendingSms] = useState(false)
  const [smsStatus, setSmsStatus] = useState<"idle" | "sent" | "error">("idle")

  // Valuation
  const [valuation, setValuation] = useState<ValuationData | null>(null)
  const [valuationLoading, setValuationLoading] = useState(false)

  const supabase = createClient()

  // --- Fetch functions ---

  const fetchApp = useCallback(async () => {
    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("id", appId)
      .single()
    if (!error && data) {
      setApp(data)
      if (!originalApp) setOriginalApp({ ...data })
    }
    setLoading(false)
  }, [appId, supabase, originalApp])

  const fetchDocuments = useCallback(async () => {
    const { data } = await supabase
      .from("loan_documents")
      .select("*")
      .eq("application_id", appId)
      .order("created_at", { ascending: false })
    if (data) setDocuments(data)
  }, [appId, supabase])

  const fetchConditions = useCallback(async () => {
    setCondLoading(true)
    try {
      const res = await fetch(`/api/applications/${appId}/conditions`)
      if (res.ok) setCondData(await res.json())
    } catch { /* ignore */ }
    setCondLoading(false)
  }, [appId])

  const fetchInteractions = useCallback(async () => {
    setInteractionsLoading(true)
    try {
      const res = await fetch(`/api/applications/${appId}/interactions`)
      if (res.ok) {
        const json = await res.json()
        setInteractions(json.interactions || [])
      }
    } catch { /* ignore */ }
    setInteractionsLoading(false)
  }, [appId])

  const fetchValuation = useCallback(async (address: string) => {
    setValuationLoading(true)
    setValuation(null)
    try {
      const res = await fetch("/api/admin/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      })
      setValuation(await res.json())
    } catch {
      setValuation({ success: false, error: "Valuation request failed" })
    }
    setValuationLoading(false)
  }, [])

  // --- Initial load ---
  useEffect(() => {
    fetchApp()
    fetchDocuments()
    fetchConditions()
    fetchInteractions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Edit helpers ---
  const getFieldValue = (key: string) => {
    if (key in editedFields) return editedFields[key]
    return (app as any)?.[key] ?? ""
  }

  const setField = (key: string, value: any) => {
    setEditedFields((prev) => ({ ...prev, [key]: value }))
  }

  const hasEdits = Object.keys(editedFields).length > 0

  const isFieldModified = (key: string) => {
    if (!(key in editedFields)) return false
    return editedFields[key] !== ((originalApp as any)?.[key] ?? "")
  }

  const saveEdits = async () => {
    if (!app || !hasEdits) return
    setIsSaving(true)
    setUpdateError(null)
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedFields),
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error || "Failed to save")
      if (result.application) setApp(result.application)
      setEditedFields({})
      setIsEditing(false)
      fetchConditions()
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const resetToOriginal = async () => {
    if (!app || !originalApp) return
    setIsSaving(true)
    try {
      const resetPayload: Record<string, any> = {}
      const keys = ["loan_amount", "loan_type", "loan_purpose", "credit_score_range", "property_value", "property_type", "property_address", "property_city", "property_state", "property_zip"]
      for (const key of keys) {
        if ((app as any)[key] !== (originalApp as any)[key]) {
          resetPayload[key] = (originalApp as any)[key]
        }
      }
      if (Object.keys(resetPayload).length > 0) {
        const res = await fetch(`/api/applications/${appId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resetPayload),
        })
        const result = await res.json()
        if (result.application) setApp(result.application)
      }
      setEditedFields({})
      setIsEditing(false)
      fetchConditions()
    } catch { /* ignore */ }
    setIsSaving(false)
  }

  // --- Status ---
  const updateStatus = async (newStatus: string) => {
    if (!app) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setApp({ ...app, status: newStatus })
      }
    } catch { /* ignore */ }
    setUpdating(false)
  }

  // --- Conditions actions ---
  const addConditionItem = async (label: string) => {
    if (!label.trim()) return
    setAddingCond(true)
    await fetch(`/api/applications/${appId}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", label }),
    })
    setNewCondLabel("")
    setAddingCond(false)
    fetchConditions()
  }

  const addConditionBatch = async (labels: string[]) => {
    await fetch(`/api/applications/${appId}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_batch", labels }),
    })
    fetchConditions()
  }

  const updateCondStatus = async (condId: string, status: string) => {
    await fetch(`/api/applications/${appId}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", conditionId: condId, status }),
    })
    fetchConditions()
  }

  const deleteCond = async (condId: string) => {
    await fetch(`/api/applications/${appId}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", conditionId: condId }),
    })
    fetchConditions()
  }

  const sendConditionsEmail = async () => {
    setSendingEmail(true)
    try {
      const res = await fetch(`/api/applications/${appId}/conditions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_request_email" }),
      })
      const json = await res.json()
      if (json.portalUrl) setPortalUrl(json.portalUrl)
    } catch { /* ignore */ }
    setSendingEmail(false)
  }

  // --- SMS ---
  const sendSms = async () => {
    if (!smsText.trim()) return
    setSendingSms(true)
    setSmsStatus("idle")
    try {
      const res = await fetch(`/api/applications/${appId}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: smsText.trim() }),
      })
      if (res.ok) {
        setSmsText("")
        setSmsStatus("sent")
        fetchInteractions()
        setTimeout(() => setSmsStatus("idle"), 3000)
      } else {
        setSmsStatus("error")
      }
    } catch {
      setSmsStatus("error")
    }
    setSendingSms(false)
  }

  // --- Document status ---
  const updateDocStatus = async (docId: string, status: string) => {
    await supabase.from("loan_documents").update({ status }).eq("id", docId)
    setDocuments(documents.map((d) => (d.id === docId ? { ...d, status } : d)))
  }

  // --- Loading / Not Found ---

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#997100]" />
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

  const fullAddress = [app.property_address, app.property_city, app.property_state, app.property_zip].filter(Boolean).join(", ")
  const applicantFirstName = app.applicant_name?.split(" ")[0] || "Applicant"

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10">
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
                <h2 className="font-semibold text-lg">{app.applicant_name}</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Home className="h-3 w-3" />
                  {fullAddress || "No address"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(app.status)}>{formatStatus(app.status)}</Badge>
              {app.applicant_phone && (
                <a
                  href={`tel:${app.applicant_phone}`}
                  className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
                >
                  <Phone className="h-4 w-4" /> Call
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">

        {updateError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="text-sm font-medium">Error: {updateError}</p>
          </div>
        )}

        {/* ═══ COMMUNICATION THREAD ═══ */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#997100]" />
              Communication Thread
              {interactions.length > 0 && (
                <Badge variant="outline" className="border-border text-muted-foreground ml-2 text-xs">
                  {interactions.length} interaction{interactions.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {interactionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : interactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No interactions recorded yet. Send a message below to start the thread.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {interactions.map((ix) => {
                  const meta = ix.metadata || {}
                  const isOutbound = ix.direction === "outbound"
                  const time = new Date(ix.created_at).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })

                  const actorLabel = (() => {
                    if (meta.type === "call_review") return "Review"
                    if (meta.is_training) return "Training"
                    if (ix.channel === "voice" && isOutbound) return "Riley"
                    if (ix.channel === "voice" && !isOutbound) {
                      if (meta.manual_bridge) return "Nyalls"
                      return applicantFirstName
                    }
                    if (ix.channel === "sms" && isOutbound) return "Preme"
                    if (ix.channel === "sms" && !isOutbound) return applicantFirstName
                    if (ix.channel === "email") return isOutbound ? "Preme" : applicantFirstName
                    return isOutbound ? "Preme" : applicantFirstName
                  })()

                  if (meta.type === "call_review") return null

                  // SMS
                  if (ix.channel === "sms") {
                    return (
                      <div key={ix.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 ${
                          isOutbound
                            ? "bg-[#997100]/20 border border-[#997100]/30 text-foreground"
                            : "bg-muted/50 border border-border text-foreground"
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{actorLabel}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-500/30 text-blue-400">SMS</Badge>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{ix.content || ix.summary || "(no content)"}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{time}</p>
                        </div>
                      </div>
                    )
                  }

                  // Voice
                  if (ix.channel === "voice") {
                    const durationSec = meta.duration_ms ? Math.round(meta.duration_ms / 1000) : meta.duration_seconds || 0
                    const durationStr = durationSec > 0 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : ""
                    const recordingUrl = meta.recording_storage_url || meta.recording_url || null
                    const isExpanded = expandedCallId === ix.id

                    return (
                      <div key={ix.id} className="rounded-lg border border-border bg-muted/50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isOutbound ? <PhoneOutgoing className="h-4 w-4 text-[#997100]" /> : <PhoneIncoming className="h-4 w-4 text-green-500" />}
                            <span className="text-sm font-medium text-foreground">{isOutbound ? "Outbound Call" : "Inbound Call"}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{actorLabel}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-green-500/30 text-green-400">Call</Badge>
                            {durationStr && <span className="text-xs text-muted-foreground">{durationStr}</span>}
                            {meta.temperature && (
                              <Badge className={`text-[9px] px-1.5 py-0 ${
                                meta.temperature === "hot" ? "bg-red-600 text-white" :
                                meta.temperature === "warm" ? "bg-orange-500 text-white" :
                                "bg-blue-600 text-white"
                              }`}>{meta.temperature}</Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{time}</span>
                        </div>
                        {ix.summary && <p className="text-sm text-muted-foreground mt-2">{ix.summary}</p>}
                        {recordingUrl && (
                          <div className="mt-2">
                            <audio
                              controls
                              preload="none"
                              className="w-full h-8 [&::-webkit-media-controls-panel]:bg-muted"
                              src={recordingUrl.includes("api.twilio.com") ? `/api/admin/recording?url=${encodeURIComponent(recordingUrl)}` : recordingUrl}
                            />
                          </div>
                        )}
                        {ix.content && (
                          <div className="mt-2">
                            <button onClick={() => setExpandedCallId(isExpanded ? null : ix.id)} className="text-xs text-[#997100] hover:text-[#b8850a] font-medium">
                              {isExpanded ? "Hide transcript" : "Show transcript"}
                            </button>
                            {isExpanded && (
                              <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap bg-background/50 rounded p-2 max-h-[300px] overflow-y-auto border border-border">
                                {ix.content}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  }

                  // Email
                  if (ix.channel === "email") {
                    return (
                      <div key={ix.id} className="rounded-lg border border-border bg-muted/50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium text-foreground">{meta.subject || "Email"}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{actorLabel}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-500/30 text-purple-400">Email</Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{time}</span>
                        </div>
                        {ix.summary && <p className="text-sm text-muted-foreground mt-1">{ix.summary}</p>}
                      </div>
                    )
                  }

                  // Fallback
                  return (
                    <div key={ix.id} className="rounded-lg border border-border bg-muted/50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground">{ix.channel}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{actorLabel}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{time}</span>
                      </div>
                      {(ix.summary || ix.content) && <p className="text-sm text-muted-foreground mt-1">{ix.summary || ix.content}</p>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* SMS Compose */}
            <div className="mt-4 pt-3 border-t border-border">
              {smsStatus === "sent" && <p className="mb-2 text-xs text-green-600 font-medium">Message sent!</p>}
              {smsStatus === "error" && <p className="mb-2 text-xs text-red-600">Failed to send — check Twilio config</p>}
              <div className="flex items-end gap-2">
                <Textarea
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendSms() } }}
                  placeholder="Type a message... (Enter to send)"
                  rows={2}
                  className="flex-1 bg-muted border-border text-foreground resize-none"
                />
                {app.applicant_phone && (
                  <a
                    href={`tel:${app.applicant_phone}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-green-600 text-white hover:bg-green-700 transition"
                    title="Call"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                <Button
                  onClick={sendSms}
                  disabled={sendingSms || !smsText.trim()}
                  className="bg-[#997100] hover:bg-[#b8850a] text-black h-10"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ TWO COLUMN LAYOUT ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT COLUMN (2/3) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Application Details — Editable */}
            <Card className={`bg-card ${isEditing ? "border-[#997100]" : "border-border"}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground text-2xl">{getFieldValue("applicant_name") || app.applicant_name}</CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Home className="h-3.5 w-3.5 shrink-0" />
                      {fullAddress || "No address"}
                    </p>
                    <CardDescription className="text-muted-foreground mt-1">
                      {getFieldValue("applicant_email") || app.applicant_email}
                      {(getFieldValue("applicant_phone") || app.applicant_phone) && <span> &bull; {getFieldValue("applicant_phone") || app.applicant_phone}</span>}
                      <span className="text-xs ml-2 opacity-60">{app.application_number}</span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(app.status)}>
                      {formatStatus(app.status)}
                    </Badge>
                    {!isEditing ? (
                      <Button
                        variant="outline"
                        className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-black bg-transparent"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button onClick={saveEdits} disabled={isSaving || !hasEdits} className="bg-[#997100] hover:bg-[#b8850a] text-black">
                          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Save & Re-Match
                        </Button>
                        <Button variant="outline" className="border-border text-muted-foreground hover:bg-muted bg-transparent" onClick={() => { setEditedFields({}); setIsEditing(false) }}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Loan Details */}
                <div>
                  <h4 className="text-sm font-semibold text-[#997100] mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Loan Details
                    {isEditing && <span className="text-xs font-normal text-muted-foreground">(edit these to see which lenders qualify)</span>}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Loan Amount {isFieldModified("loan_amount") && <span className="text-blue-400">*</span>}
                      </p>
                      {isEditing ? (
                        <Input type="number" value={getFieldValue("loan_amount") || ""} onChange={(e) => setField("loan_amount", e.target.value ? Number(e.target.value) : null)} className="bg-muted border-border text-foreground mt-1 text-lg font-semibold" />
                      ) : (
                        <p className="text-lg font-semibold text-foreground">{getFieldValue("loan_amount") ? `$${Number(getFieldValue("loan_amount")).toLocaleString()}` : "—"}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Credit Score {isFieldModified("credit_score_range") && <span className="text-blue-400">*</span>}
                      </p>
                      {isEditing ? (
                        <Select value={getFieldValue("credit_score_range") || ""} onValueChange={(v) => setField("credit_score_range", v)}>
                          <SelectTrigger className="bg-muted border-border text-foreground mt-1 text-lg font-semibold"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="800+">800+</SelectItem>
                            <SelectItem value="740-799">740-799</SelectItem>
                            <SelectItem value="670-739">670-739</SelectItem>
                            <SelectItem value="620-669">620-669</SelectItem>
                            <SelectItem value="580-619">580-619</SelectItem>
                            <SelectItem value="Below 580">Below 580</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-lg font-semibold text-foreground">{getFieldValue("credit_score_range") || "—"}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Loan Type {isFieldModified("loan_type") && <span className="text-blue-400">*</span>}
                      </p>
                      {isEditing ? (
                        <Input value={getFieldValue("loan_type") || ""} onChange={(e) => setField("loan_type", e.target.value)} className="bg-muted border-border text-foreground mt-1" />
                      ) : (
                        <p className="text-lg font-semibold text-foreground">{getFieldValue("loan_type") || "—"}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Loan Purpose {isFieldModified("loan_purpose") && <span className="text-blue-400">*</span>}
                      </p>
                      {isEditing ? (
                        <Input value={getFieldValue("loan_purpose") || ""} onChange={(e) => setField("loan_purpose", e.target.value)} className="bg-muted border-border text-foreground mt-1" />
                      ) : (
                        <p className="text-lg font-semibold text-foreground">{getFieldValue("loan_purpose") || "—"}</p>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-border" />

                {/* Property Info */}
                <div>
                  <h4 className="text-sm font-semibold text-[#997100] mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Property Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Property Address</p>
                      {isEditing ? (
                        <Input value={getFieldValue("property_address") || ""} onChange={(e) => setField("property_address", e.target.value)} className="bg-muted border-border text-foreground mt-1" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{fullAddress || "—"}</p>
                          {fullAddress && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-600/50 text-green-500 hover:bg-green-600 hover:text-white bg-transparent h-7 text-xs shrink-0"
                              onClick={() => fetchValuation(fullAddress)}
                              disabled={valuationLoading}
                            >
                              {valuationLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Home className="h-3 w-3 mr-1" />}
                              Get Estimate
                            </Button>
                          )}
                        </div>
                      )}
                      {valuation && (
                        <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3">
                          {valuation.success ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-2xl font-bold text-green-500">${valuation.estimatedValue?.toLocaleString()}</p>
                                <span className="text-[10px] text-muted-foreground italic">via Zillow</span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {!!valuation.sqft && <span>{valuation.sqft.toLocaleString()} sqft</span>}
                                {!!valuation.bedrooms && <span>{valuation.bedrooms} bed</span>}
                                {!!valuation.bathrooms && <span>{valuation.bathrooms} bath</span>}
                                {!!valuation.yearBuilt && <span>Built {valuation.yearBuilt}</span>}
                              </div>
                              {(!!valuation.lastSoldPrice || valuation.lastSoldDate) && (
                                <p className="text-xs text-muted-foreground">
                                  Last sold: {valuation.lastSoldPrice ? `$${valuation.lastSoldPrice.toLocaleString()}` : ""}{valuation.lastSoldDate ? ` on ${valuation.lastSoldDate}` : ""}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-red-400">{valuation.error || "No valuation data found"}</p>
                          )}
                        </div>
                      )}
                    </div>
                    {isEditing && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">State</p>
                          <Input value={getFieldValue("property_state") || ""} onChange={(e) => setField("property_state", e.target.value)} placeholder="GA" className="bg-muted border-border text-foreground mt-1" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Zip</p>
                          <Input value={getFieldValue("property_zip") || ""} onChange={(e) => setField("property_zip", e.target.value)} className="bg-muted border-border text-foreground mt-1" />
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Property Value {isFieldModified("property_value") && <span className="text-blue-400">*</span>}
                      </p>
                      {isEditing ? (
                        <Input type="number" value={getFieldValue("property_value") || ""} onChange={(e) => setField("property_value", e.target.value ? Number(e.target.value) : null)} className="bg-muted border-border text-foreground mt-1 text-lg font-semibold" />
                      ) : (
                        <p className="text-lg font-semibold text-foreground">{getFieldValue("property_value") ? `$${Number(getFieldValue("property_value")).toLocaleString()}` : "—"}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Property Type {isFieldModified("property_type") && <span className="text-blue-400">*</span>}
                      </p>
                      {isEditing ? (
                        <Input value={getFieldValue("property_type") || ""} onChange={(e) => setField("property_type", e.target.value)} className="bg-muted border-border text-foreground mt-1" />
                      ) : (
                        <p className="text-lg font-semibold text-foreground">{getFieldValue("property_type") || "—"}</p>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-border" />

                {/* Applicant Info */}
                <div>
                  <h4 className="text-sm font-semibold text-[#997100] mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" /> Applicant Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Full Name</p>
                      {isEditing ? (
                        <Input value={getFieldValue("applicant_name") || ""} onChange={(e) => setField("applicant_name", e.target.value)} className="bg-muted border-border text-foreground mt-1" />
                      ) : (
                        <p className="text-sm font-medium text-foreground">{app.applicant_name}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      {isEditing ? (
                        <Input value={getFieldValue("applicant_email") || ""} onChange={(e) => setField("applicant_email", e.target.value)} className="bg-muted border-border text-foreground mt-1" />
                      ) : (
                        <p className="text-sm font-medium text-foreground">{app.applicant_email}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      {isEditing ? (
                        <Input value={getFieldValue("applicant_phone") || ""} onChange={(e) => setField("applicant_phone", e.target.value)} className="bg-muted border-border text-foreground mt-1" />
                      ) : (
                        <p className="text-sm font-medium text-foreground">{app.applicant_phone || "—"}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Employment</p>
                      <p className="text-sm font-medium text-foreground">{app.employment_status || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Employer</p>
                      <p className="text-sm font-medium text-foreground">{app.employer_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Income</p>
                      <p className="text-sm font-medium text-foreground">{app.annual_income ? `$${app.annual_income.toLocaleString()}` : "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Financial / Liquidity */}
                {(app.cash_reserves || app.investment_accounts || app.retirement_accounts) && (
                  <>
                    <hr className="border-border" />
                    <div>
                      <h4 className="text-sm font-semibold text-[#997100] mb-3 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" /> Liquidity
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Cash Reserves</p>
                          <p className="text-sm font-medium text-foreground">{app.cash_reserves ? `$${app.cash_reserves.toLocaleString()}` : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Investments</p>
                          <p className="text-sm font-medium text-foreground">{app.investment_accounts ? `$${app.investment_accounts.toLocaleString()}` : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Retirement</p>
                          <p className="text-sm font-medium text-foreground">{app.retirement_accounts ? `$${app.retirement_accounts.toLocaleString()}` : "—"}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Sponsor */}
                {app.has_sponsor && (
                  <>
                    <hr className="border-border" />
                    <div>
                      <h4 className="text-sm font-semibold text-[#997100] mb-3">Sponsor</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{app.sponsor_name || "—"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{app.sponsor_email || "—"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{app.sponsor_phone || "—"}</p></div>
                      </div>
                    </div>
                  </>
                )}

                <p className="text-xs text-muted-foreground">Submitted {formatDate(app.submitted_at || app.created_at)}</p>

                {/* Bottom save bar */}
                {isEditing && hasEdits && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#997100]/10 border border-[#997100]/30">
                    <p className="text-sm text-[#997100] font-medium">
                      {Object.keys(editedFields).length} field{Object.keys(editedFields).length > 1 ? "s" : ""} changed — save to update lender matches
                    </p>
                    <Button onClick={saveEdits} disabled={isSaving} className="bg-[#997100] hover:bg-[#b8850a] text-black">
                      {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save & Re-Match Lenders
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══ LENDER MATCH ═══ */}
            <Card className="bg-card border-[#997100]/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-xl flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#997100]" />
                    DSCR Lender Match
                  </CardTitle>
                  {condData?.lenderMatch && (
                    <Badge className={`text-sm px-3 py-1 ${condData.lenderMatch.stats.qualified > 0 ? "bg-green-600 text-white" : "bg-red-500 text-white"}`}>
                      {condData.lenderMatch.stats.qualified} of {condData.lenderMatch.stats.total} lenders qualified
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-muted-foreground">
                  Lenders matched against credit score, loan amount, and property state
                </CardDescription>
              </CardHeader>
              <CardContent>
                {condLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !condData?.lenderMatch || condData.lenderMatch.matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No DSCR lenders matched. Edit the application fields above and save to re-run the match.</p>
                ) : (
                  <div className="space-y-3">
                    {condData.lenderMatch.matches.filter((m) => m.qualified).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-500 uppercase tracking-wide mb-2">Qualified Lenders</p>
                        <div className="space-y-2">
                          {condData.lenderMatch.matches.filter((m) => m.qualified).map((m) => (
                            <div key={m.lender.id} className="rounded-lg border border-green-600/30 bg-green-600/5 p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-foreground">{m.lender.name}</p>
                                  <p className="text-sm text-muted-foreground">{m.lender.short_name}</p>
                                </div>
                                <Shield className="h-5 w-5 text-green-500" />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span>Min DSCR: {m.lender.min_dscr}</span>
                                <span>Min FICO: {m.lender.min_fico}</span>
                                <span>Loan: ${m.lender.min_loan.toLocaleString()}+</span>
                                {m.lender.max_loan && <span>Max: ${m.lender.max_loan.toLocaleString()}</span>}
                                {m.lender.max_term && <span>{m.lender.max_term}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {condData.lenderMatch.matches.filter((m) => !m.qualified).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2 mt-4">Not Qualified</p>
                        <div className="space-y-2">
                          {condData.lenderMatch.matches.filter((m) => !m.qualified).map((m) => (
                            <div key={m.lender.id} className="rounded-lg border border-border bg-muted/50 p-3 opacity-70">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-foreground text-sm">{m.lender.name}</p>
                                <XCircle className="h-4 w-4 text-red-400" />
                              </div>
                              <div className="mt-1 space-y-0.5">
                                {m.reasons.map((r: string, i: number) => (
                                  <p key={i} className="text-xs text-red-400">{r}</p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══ CONDITIONS & DOCUMENTS ═══ */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#997100]" />
                  Conditions & Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {condLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Progress */}
                    {condData && condData.progress.total > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>{condData.progress.received} of {condData.progress.total} received</span>
                          <span>{condData.progress.approved} approved</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-[#997100] h-2 rounded-full transition-all" style={{ width: `${condData.progress.total > 0 ? (condData.progress.received / condData.progress.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Conditions list */}
                    <div className="space-y-2">
                      {condData?.conditions.length === 0 && (
                        <p className="text-sm text-muted-foreground">No conditions added yet. Use templates below or add manually.</p>
                      )}
                      {condData?.conditions.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 p-2.5 bg-muted rounded-lg">
                          <button
                            onClick={() => {
                              const next = c.status === "outstanding" ? "submitted" : c.status === "submitted" ? "approved" : c.status
                              if (next !== c.status) updateCondStatus(c.id, next)
                            }}
                            className={`shrink-0 ${
                              c.status === "approved" ? "text-green-500" :
                              c.status === "submitted" ? "text-blue-500" :
                              c.status === "waived" ? "text-gray-400" :
                              "text-gray-400 hover:text-[#997100]"
                            } transition`}
                            title={`Status: ${c.status}. Click to advance.`}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <span className={`flex-1 text-sm ${c.status === "approved" || c.status === "waived" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {c.title}
                          </span>
                          <Badge variant="outline" className={`text-xs ${
                            c.status === "outstanding" ? "border-orange-400 text-orange-500" :
                            c.status === "submitted" ? "border-blue-400 text-blue-500" :
                            c.status === "approved" ? "border-green-400 text-green-500" :
                            "border-border text-muted-foreground"
                          }`}>
                            {c.status}
                          </Badge>
                          <button onClick={() => deleteCond(c.id)} className="shrink-0 text-muted-foreground hover:text-red-500 transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add condition */}
                    <div className="flex gap-2">
                      <Input
                        value={newCondLabel}
                        onChange={(e) => setNewCondLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addConditionItem(newCondLabel)}
                        placeholder="Add condition..."
                        className="bg-muted border-border text-foreground"
                      />
                      <Button onClick={() => addConditionItem(newCondLabel)} disabled={addingCond || !newCondLabel.trim()} className="bg-[#997100] hover:bg-[#b8850a] text-black">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Templates */}
                    <div>
                      <button onClick={() => setShowTemplates(!showTemplates)} className="text-xs text-[#997100] hover:text-[#b8850a] font-medium">
                        {showTemplates ? "Hide templates" : "+ Add from template"}
                      </button>
                      {showTemplates && condData?.templates && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(condData.templates).map(([key, labels]) => (
                            <button
                              key={key}
                              onClick={() => addConditionBatch(labels)}
                              className="block w-full text-left rounded-lg bg-muted px-3 py-2 text-xs text-foreground hover:bg-accent transition"
                            >
                              <span className="font-medium text-[#997100]">{key.toUpperCase()}</span>
                              <span className="text-muted-foreground ml-2">({labels.length} items)</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Email / Portal */}
                    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button
                        onClick={sendConditionsEmail}
                        disabled={sendingEmail || !condData?.conditions.some((c) => c.status === "outstanding")}
                        className="bg-[#997100] hover:bg-[#b8850a] text-black"
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        {sendingEmail ? "Sending..." : "Email Document Request"}
                      </Button>
                      {portalUrl && (
                        <Button
                          variant="outline"
                          className="border-border text-foreground hover:bg-muted bg-transparent"
                          onClick={() => { navigator.clipboard.writeText(portalUrl); setCopiedPortal(true); setTimeout(() => setCopiedPortal(false), 2000) }}
                          title={portalUrl}
                        >
                          {copiedPortal ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                          {copiedPortal ? "Copied!" : "Copy Portal Link"}
                        </Button>
                      )}
                    </div>

                    {/* Documents */}
                    {documents.length > 0 && (
                      <div className="border-t border-border pt-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Uploaded Documents</p>
                        <div className="space-y-2">
                          {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex items-center space-x-3">
                                <FileText className="h-5 w-5 text-[#997100]" />
                                <div>
                                  <p className="text-sm font-medium">{doc.file_name}</p>
                                  <p className="text-xs text-muted-foreground">{doc.document_type || "Other"} &middot; {formatDate(doc.created_at)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={doc.status === "approved" ? "bg-green-600 text-white" : doc.status === "rejected" ? "bg-red-600 text-white" : "bg-yellow-600 text-black"}>
                                  {doc.status}
                                </Badge>
                                <Button size="sm" variant="outline" className="bg-transparent h-7 w-7 p-0" onClick={() => updateDocStatus(doc.id, "approved")}>
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="bg-transparent h-7 w-7 p-0" onClick={() => updateDocStatus(doc.id, "rejected")}>
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT SIDEBAR (1/3) */}
          <div className="space-y-6">
            {/* Status Controls */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-base">Review Application</CardTitle>
                <CardDescription className="text-muted-foreground">Update status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus("approved")} disabled={updating || app.status === "approved"}>
                  <CheckCircle className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button variant="outline" className="w-full border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-black bg-transparent" onClick={() => updateStatus("under_review")} disabled={updating || app.status === "under_review"}>
                  <Clock className="mr-2 h-4 w-4" /> Under Review
                </Button>
                <Button variant="outline" className="w-full border-red-600 text-red-600 hover:bg-red-600 hover:text-white bg-transparent" onClick={() => updateStatus("rejected")} disabled={updating || app.status === "rejected"}>
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
                <Button variant="outline" className="w-full border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white bg-transparent" onClick={() => updateStatus("on_hold")} disabled={updating || app.status === "on_hold"}>
                  <AlertCircle className="mr-2 h-4 w-4" /> On Hold
                </Button>
              </CardContent>
            </Card>

            {/* LTV Ratio */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground text-base">LTV Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {app.property_value && app.loan_amount
                    ? ((app.loan_amount / app.property_value) * 100).toFixed(1) + "%"
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Loan to Value</p>
              </CardContent>
            </Card>

            {/* Submitted */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground text-base">Submitted</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
