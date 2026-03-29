"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Eye,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Download,
  User,
  Calendar,
  DollarSign,
  Archive,
  Loader2,
  Phone,
  Mail,
  Send,
  Plus,
  Trash2,
  Shield,
  Building2,
  Copy,
  ChevronDown,
  ChevronUp,
  Link2,
  Users,
  AlertTriangle,
  CircleCheck,
  Pencil,
  RotateCcw,
  Save,
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Home,
} from "lucide-react"

interface Application {
  id: string
  dbId: string
  applicantName: string
  applicantEmail: string
  applicantPhone: string
  propertyAddress: string
  loanAmount: number
  status: string
  submittedAt: string
  loanType: string
  creditScoreRange: string
  propertyValue: number
  progress: number
  assignedTo: string | null
  completenessPercent: number
  missingFields: string[]
  guestToken: string | null
  raw: Record<string, any>
}

interface Condition {
  id: string
  application_id: string
  title: string
  description: string | null
  status: string
  due_date: string | null
  created_by: string | null
  created_at: string
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

interface ApplicationsManagementProps {
  applications: Application[]
  onRefresh?: () => void
  initialSelectedId?: string | null
  onSelectedCleared?: () => void
}

export function ApplicationsManagement({ applications, onRefresh, initialSelectedId, onSelectedCleared }: ApplicationsManagementProps) {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [reviewNotes, setReviewNotes] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // New state for conditions/lender/sms
  const [condData, setCondData] = useState<ConditionsData | null>(null)
  const [condLoading, setCondLoading] = useState(false)
  const [newCondLabel, setNewCondLabel] = useState("")
  const [addingCond, setAddingCond] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [portalUrl, setPortalUrl] = useState("")
  const [showLenderDetail, setShowLenderDetail] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [smsText, setSmsText] = useState("")
  const [sendingSms, setSendingSms] = useState(false)
  const [smsStatus, setSmsStatus] = useState<"idle" | "sent" | "error">("idle")
  const [copiedPortal, setCopiedPortal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [fullApp, setFullApp] = useState<Record<string, any> | null>(null)
  const [fullAppLoading, setFullAppLoading] = useState(false)
  const [completenessFilter, setCompletenessFilter] = useState<"all" | "complete" | "incomplete">("all")
  const [followUpId, setFollowUpId] = useState<string | null>(null)

  // Interactions state
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [interactionsLoading, setInteractionsLoading] = useState(false)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)
  const [interactionApplicantName, setInteractionApplicantName] = useState("Applicant")

  // Valuation state
  const [valuation, setValuation] = useState<ValuationData | null>(null)
  const [valuationLoading, setValuationLoading] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editedFields, setEditedFields] = useState<Record<string, any>>({})
  const [originalApp, setOriginalApp] = useState<Record<string, any> | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Auto-select application when navigating from dashboard
  useEffect(() => {
    if (initialSelectedId && applications.length > 0) {
      const found = applications.find((a) => a.id === initialSelectedId)
      if (found) {
        setSelectedApp(found)
        onSelectedCleared?.()
      }
    }
  }, [initialSelectedId, applications, onSelectedCleared])

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    const matchesSearch =
      app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCompleteness =
      completenessFilter === "all" ||
      (completenessFilter === "complete" && app.completenessPercent === 100) ||
      (completenessFilter === "incomplete" && app.completenessPercent < 100)
    return matchesStatus && matchesSearch && matchesCompleteness
  })

  const completeApps = filteredApplications.filter((a) => a.completenessPercent === 100)
  const incompleteApps = filteredApplications.filter((a) => a.completenessPercent < 100)

  // Fetch conditions + lender data when an app is selected
  const fetchConditions = useCallback(async (dbId: string) => {
    setCondLoading(true)
    try {
      const res = await fetch(`/api/applications/${dbId}/conditions`)
      if (res.ok) setCondData(await res.json())
    } catch { /* ignore */ }
    setCondLoading(false)
  }, [])

  // Fetch full application data when selected
  const fetchFullApp = useCallback(async (dbId: string) => {
    setFullAppLoading(true)
    try {
      const res = await fetch(`/api/applications/${dbId}`)
      if (res.ok) {
        const json = await res.json()
        const app = json.application || null
        setFullApp(app)
        // Store original snapshot on first load
        if (app && !originalApp) setOriginalApp({ ...app })
      }
    } catch { /* ignore */ }
    setFullAppLoading(false)
  }, [originalApp])

  // Fetch interactions for the applicant
  const fetchInteractions = useCallback(async (dbId: string) => {
    setInteractionsLoading(true)
    try {
      const res = await fetch(`/api/applications/${dbId}/interactions`)
      if (res.ok) {
        const json = await res.json()
        setInteractions(json.interactions || [])
        setInteractionApplicantName(json.applicantName || "Applicant")
      }
    } catch { /* ignore */ }
    setInteractionsLoading(false)
  }, [])

  // Fetch Zillow valuation
  const fetchValuation = useCallback(async (address: string) => {
    setValuationLoading(true)
    setValuation(null)
    try {
      const res = await fetch("/api/admin/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      })
      const json: ValuationData = await res.json()
      setValuation(json)
    } catch {
      setValuation({ success: false, error: "Valuation request failed" })
    }
    setValuationLoading(false)
  }, [])

  useEffect(() => {
    if (selectedApp) {
      fetchConditions(selectedApp.dbId)
      fetchFullApp(selectedApp.dbId)
      fetchInteractions(selectedApp.dbId)
    } else {
      setCondData(null)
      setFullApp(null)
      setOriginalApp(null)
      setEditedFields({})
      setIsEditing(false)
      setPortalUrl("")
      setSmsText("")
      setSmsStatus("idle")
      setInteractions([])
      setValuation(null)
      setExpandedCallId(null)
    }
  }, [selectedApp, fetchConditions, fetchFullApp, fetchInteractions])

  // Get the display value for a field — edited value takes priority over DB value
  const getFieldValue = (key: string) => {
    if (key in editedFields) return editedFields[key]
    return fullApp?.[key] ?? ""
  }

  const setField = (key: string, value: any) => {
    setEditedFields((prev) => ({ ...prev, [key]: value }))
  }

  const hasEdits = Object.keys(editedFields).length > 0

  // Check if a specific field was modified from the original
  const isFieldModified = (key: string) => {
    if (!(key in editedFields)) return false
    return editedFields[key] !== (originalApp?.[key] ?? "")
  }

  // Save edits and refresh lender match
  const saveEdits = async () => {
    if (!selectedApp || !hasEdits) return
    setIsSaving(true)
    setUpdateError(null)
    try {
      const res = await fetch(`/api/applications/${selectedApp.dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedFields),
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error || "Failed to save")

      // Update local state with saved data
      setFullApp(result.application)
      setEditedFields({})
      setIsEditing(false)

      // Re-fetch lender match with updated data
      fetchConditions(selectedApp.dbId)

      // Refresh parent list
      if (onRefresh) onRefresh()
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to original application data
  const resetToOriginal = async () => {
    if (!selectedApp || !originalApp) return
    setIsSaving(true)
    setUpdateError(null)
    try {
      // Build a payload of only the fields that differ from original
      const resetPayload: Record<string, any> = {}
      const keysToCheck = [
        "loan_amount", "loan_type", "loan_purpose", "credit_score_range",
        "property_value", "property_type", "property_address", "property_city",
        "property_state", "property_zip", "applicant_name", "applicant_email",
        "applicant_phone",
      ]
      for (const key of keysToCheck) {
        if (fullApp?.[key] !== originalApp[key]) {
          resetPayload[key] = originalApp[key]
        }
      }

      if (Object.keys(resetPayload).length === 0) {
        setEditedFields({})
        setIsEditing(false)
        setIsSaving(false)
        return
      }

      const res = await fetch(`/api/applications/${selectedApp.dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resetPayload),
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error || "Failed to reset")

      setFullApp(result.application)
      setEditedFields({})
      setIsEditing(false)
      fetchConditions(selectedApp.dbId)
      if (onRefresh) onRefresh()
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to reset")
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Conditions actions ───

  async function addConditionItem(label: string) {
    if (!label.trim() || !selectedApp) return
    setAddingCond(true)
    await fetch(`/api/applications/${selectedApp.dbId}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", label }),
    })
    setNewCondLabel("")
    setAddingCond(false)
    fetchConditions(selectedApp.dbId)
  }

  async function addConditionBatch(labels: string[]) {
    if (!selectedApp) return
    await fetch(`/api/applications/${selectedApp.dbId}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_batch", labels }),
    })
    setShowTemplates(false)
    fetchConditions(selectedApp.dbId)
  }

  async function updateCondStatus(conditionId: string, status: string) {
    if (!selectedApp) return
    await fetch(`/api/applications/${selectedApp.dbId}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", condition_id: conditionId, status }),
    })
    fetchConditions(selectedApp.dbId)
  }

  async function deleteCond(conditionId: string) {
    if (!selectedApp) return
    await fetch(`/api/applications/${selectedApp.dbId}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", condition_id: conditionId }),
    })
    fetchConditions(selectedApp.dbId)
  }

  async function sendConditionsEmail() {
    if (!selectedApp) return
    setSendingEmail(true)
    try {
      const res = await fetch(`/api/applications/${selectedApp.dbId}/conditions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_request_email" }),
      })
      const json = await res.json()
      if (json.portal_url) setPortalUrl(json.portal_url)
    } catch { /* ignore */ }
    setSendingEmail(false)
  }

  // ─── SMS ───

  async function sendSms() {
    if (!smsText.trim() || !selectedApp) return
    setSendingSms(true)
    setSmsStatus("idle")
    try {
      const res = await fetch(`/api/applications/${selectedApp.dbId}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: smsText }),
      })
      if (res.ok) {
        setSmsText("")
        setSmsStatus("sent")
        setTimeout(() => setSmsStatus("idle"), 3000)
      } else {
        setSmsStatus("error")
      }
    } catch {
      setSmsStatus("error")
    }
    setSendingSms(false)
  }

  // ─── Helpers ───

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-600 text-white"
      case "under_review": return "bg-yellow-600 text-black"
      case "submitted": return "bg-blue-600 text-white"
      case "rejected": return "bg-red-600 text-white"
      case "on_hold": return "bg-orange-600 text-white"
      case "archived": return "bg-gray-500 text-white"
      default: return "bg-gray-600 text-white"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle className="h-4 w-4" />
      case "under_review": return <Clock className="h-4 w-4" />
      case "submitted": return <FileText className="h-4 w-4" />
      case "rejected": return <AlertCircle className="h-4 w-4" />
      case "on_hold": return <AlertCircle className="h-4 w-4" />
      case "archived": return <Archive className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const formatStatus = (status: string) =>
    status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    })

  const handleStatusUpdate = async (appId: string, newStatus: string) => {
    setIsUpdating(true)
    setUpdateError(null)
    try {
      const response = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to update status")
      if (onRefresh) onRefresh()
      if (selectedApp && selectedApp.id === appId) setSelectedApp({ ...selectedApp, status: newStatus })
      setReviewNotes("")
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "Failed to update status")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleArchive = async (appId: string) => {
    await handleStatusUpdate(appId, "archived")
  }

  const handleFollowUp = async (app: Application) => {
    setFollowUpId(app.dbId)
    try {
      const missingList = app.missingFields.join(", ")
      const firstName = app.applicantName.split(" ")[0] || "there"
      const message = `Hi ${firstName}, this is Preme Home Loans. We received your loan application but it looks like we're still missing some info (${missingList}). Could you complete it so we can get you matched with a lender? Reply STOP to opt out.`

      // Try SMS first if phone exists
      if (app.applicantPhone) {
        const res = await fetch(`/api/applications/${app.dbId}/sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        })
        if (res.ok) {
          setFollowUpId(null)
          return
        }
      }

      // Fallback: open SMS compose in detail view
      setSelectedApp(app)
      setSmsText(message)
    } catch { /* ignore */ }
    setFollowUpId(null)
  }

  const handleDelete = async (appId: string) => {
    if (!confirm("Permanently delete this application? This cannot be undone.")) return
    setDeletingId(appId)
    try {
      const response = await fetch(`/api/applications/${appId}`, { method: "DELETE" })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to delete")
      if (selectedApp && selectedApp.dbId === appId) setSelectedApp(null)
      if (onRefresh) onRefresh()
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "Failed to delete application")
    } finally {
      setDeletingId(null)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SELECTED APPLICATION DETAIL VIEW
  // ═══════════════════════════════════════════════════════════

  if (selectedApp) {
    return (
      <div className="space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-muted bg-transparent"
            onClick={() => setSelectedApp(null)}
          >
            &larr; Back to Applications
          </Button>
          <div className="flex items-center gap-2">
            <a
              href={`tel:${selectedApp.applicantPhone}`}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
            >
              <Phone className="h-4 w-4" /> Call
            </a>
            <Button
              variant="outline"
              className="border-gray-500 text-gray-500 hover:bg-gray-500 hover:text-white bg-transparent"
              onClick={() => handleArchive(selectedApp.dbId)}
              disabled={isUpdating || selectedApp.status === "archived"}
            >
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
              Archive
            </Button>
            <Button
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-600 hover:text-white bg-transparent"
              onClick={() => handleDelete(selectedApp.dbId)}
              disabled={deletingId === selectedApp.dbId}
            >
              {deletingId === selectedApp.dbId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </div>
        </div>

        {/* Incomplete Application Warning */}
        {selectedApp.completenessPercent < 100 && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-500">Incomplete Application ({selectedApp.completenessPercent}%)</p>
                <p className="text-xs text-orange-400">Missing: {selectedApp.missingFields.join(", ")}</p>
              </div>
            </div>
            {selectedApp.applicantPhone && (
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                onClick={() => handleFollowUp(selectedApp)}
                disabled={followUpId === selectedApp.dbId}
              >
                {followUpId === selectedApp.dbId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Text to Complete
              </Button>
            )}
          </div>
        )}

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
              <p className="text-sm text-muted-foreground py-4 text-center">No interactions recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {interactions.map((ix) => {
                  const meta = ix.metadata || {}
                  const isOutbound = ix.direction === "outbound"
                  const time = new Date(ix.created_at).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })

                  // Determine actor label
                  const actorLabel = (() => {
                    if (meta.type === "call_review") return "Review"
                    if (meta.is_training) return "Training"
                    if (ix.channel === "voice" && isOutbound) return "Riley"
                    if (ix.channel === "voice" && !isOutbound) {
                      if (meta.manual_bridge) return "Nyalls"
                      return interactionApplicantName.split(" ")[0] || "Caller"
                    }
                    if (ix.channel === "sms" && isOutbound) return "Preme"
                    if (ix.channel === "sms" && !isOutbound) return interactionApplicantName.split(" ")[0] || "Applicant"
                    if (ix.channel === "email") return isOutbound ? "Preme" : interactionApplicantName.split(" ")[0] || "Applicant"
                    return isOutbound ? "Preme" : interactionApplicantName.split(" ")[0] || "Contact"
                  })()

                  // ── SMS ──
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

                  // ── VOICE CALL ──
                  if (ix.channel === "voice") {
                    const durationSec = meta.duration_ms ? Math.round(meta.duration_ms / 1000) : meta.duration_seconds || 0
                    const durationStr = durationSec > 0 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : ""
                    const recordingUrl = meta.recording_storage_url || meta.recording_url || null
                    const isExpanded = expandedCallId === ix.id
                    const isReview = meta.type === "call_review"

                    // For call reviews, skip rendering (or render minimally)
                    if (isReview) return null

                    return (
                      <div key={ix.id} className="rounded-lg border border-border bg-muted/50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isOutbound ? (
                              <PhoneOutgoing className="h-4 w-4 text-[#997100]" />
                            ) : (
                              <PhoneIncoming className="h-4 w-4 text-green-500" />
                            )}
                            <span className="text-sm font-medium text-foreground">
                              {isOutbound ? "Outbound Call" : "Inbound Call"}
                            </span>
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
                              src={
                                recordingUrl.includes("api.twilio.com")
                                  ? `/api/admin/recording?url=${encodeURIComponent(recordingUrl)}`
                                  : recordingUrl
                              }
                            />
                          </div>
                        )}
                        {ix.content && (
                          <div className="mt-2">
                            <button
                              onClick={() => setExpandedCallId(isExpanded ? null : ix.id)}
                              className="text-xs text-[#997100] hover:text-[#b8850a] font-medium"
                            >
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

                  // ── EMAIL ──
                  if (ix.channel === "email") {
                    return (
                      <div key={ix.id} className="rounded-lg border border-border bg-muted/50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium text-foreground">
                              {meta.subject || "Email"}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{actorLabel}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-500/30 text-purple-400">Email</Badge>
                            {meta.status && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-border text-muted-foreground">{meta.status}</Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{time}</span>
                        </div>
                        {ix.summary && <p className="text-sm text-muted-foreground mt-1">{ix.summary}</p>}
                      </div>
                    )
                  }

                  // ── OTHER / FALLBACK ──
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
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ═══ LEFT: Application Details + SMS + Conditions ═══ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Application Info — Editable */}
            <Card className={`bg-card ${isEditing ? "border-[#997100]" : "border-border"}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground text-2xl">{getFieldValue("applicant_name") || selectedApp.applicantName}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {selectedApp.id} &bull; {getFieldValue("applicant_email") || selectedApp.applicantEmail}
                      {(getFieldValue("applicant_phone") || selectedApp.applicantPhone) && <span> &bull; {getFieldValue("applicant_phone") || selectedApp.applicantPhone}</span>}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(selectedApp.status)}>
                      {getStatusIcon(selectedApp.status)}
                      <span className="ml-2">{formatStatus(selectedApp.status)}</span>
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
                        <Button
                          onClick={saveEdits}
                          disabled={isSaving || !hasEdits}
                          className="bg-[#997100] hover:bg-[#b8850a] text-black"
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Save & Re-Match
                        </Button>
                        <Button
                          variant="outline"
                          className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                          onClick={() => { setEditedFields({}); setIsEditing(false) }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Modified indicator + Reset to Original */}
                {fullApp && originalApp && (
                  (() => {
                    const keysToCheck = ["loan_amount", "credit_score_range", "property_value", "property_type", "property_state", "loan_type", "loan_purpose"]
                    const modified = keysToCheck.filter((k) => String(fullApp[k] ?? "") !== String(originalApp[k] ?? ""))
                    if (modified.length === 0) return null
                    return (
                      <div className="flex items-center justify-between mt-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-xs text-blue-400">
                          Modified from original: {modified.map((k) => k.replace(/_/g, " ")).join(", ")}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-400 text-blue-400 hover:bg-blue-500 hover:text-white bg-transparent text-xs h-7"
                          onClick={resetToOriginal}
                          disabled={isSaving}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset to Original
                        </Button>
                      </div>
                    )
                  })()
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {fullAppLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Loan Details — these are the key lender-matching fields */}
                    <div>
                      <h4 className="text-sm font-semibold text-[#997100] mb-3 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" /> Loan Details
                        {isEditing && <span className="text-xs font-normal text-muted-foreground">(edit these to see which lenders qualify)</span>}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            Loan Amount
                            {isFieldModified("loan_amount") && <span className="text-blue-400">*</span>}
                          </p>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={getFieldValue("loan_amount") || ""}
                              onChange={(e) => setField("loan_amount", e.target.value ? Number(e.target.value) : null)}
                              className="bg-muted border-border text-foreground mt-1 text-lg font-semibold"
                            />
                          ) : (
                            <p className="text-lg font-semibold text-foreground">{getFieldValue("loan_amount") ? `$${Number(getFieldValue("loan_amount")).toLocaleString()}` : "—"}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            Credit Score
                            {isFieldModified("credit_score_range") && <span className="text-blue-400">*</span>}
                          </p>
                          {isEditing ? (
                            <Select value={getFieldValue("credit_score_range") || ""} onValueChange={(v) => setField("credit_score_range", v)}>
                              <SelectTrigger className="bg-muted border-border text-foreground mt-1 text-lg font-semibold">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
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
                            Loan Type
                            {isFieldModified("loan_type") && <span className="text-blue-400">*</span>}
                          </p>
                          {isEditing ? (
                            <Input
                              value={getFieldValue("loan_type") || ""}
                              onChange={(e) => setField("loan_type", e.target.value)}
                              className="bg-muted border-border text-foreground mt-1"
                            />
                          ) : (
                            <p className="text-lg font-semibold text-foreground">{getFieldValue("loan_type") || "—"}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            Loan Purpose
                            {isFieldModified("loan_purpose") && <span className="text-blue-400">*</span>}
                          </p>
                          {isEditing ? (
                            <Input
                              value={getFieldValue("loan_purpose") || ""}
                              onChange={(e) => setField("loan_purpose", e.target.value)}
                              className="bg-muted border-border text-foreground mt-1"
                            />
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
                            <Input
                              value={getFieldValue("property_address") || ""}
                              onChange={(e) => setField("property_address", e.target.value)}
                              className="bg-muted border-border text-foreground mt-1"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {fullApp
                                  ? [fullApp.property_address, fullApp.property_city, fullApp.property_state, fullApp.property_zip].filter(Boolean).join(", ")
                                  : selectedApp.propertyAddress}
                              </p>
                              {(fullApp?.property_address || selectedApp.propertyAddress) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-green-600/50 text-green-500 hover:bg-green-600 hover:text-white bg-transparent h-7 text-xs shrink-0"
                                  onClick={() => {
                                    const addr = fullApp
                                      ? [fullApp.property_address, fullApp.property_city, fullApp.property_state, fullApp.property_zip].filter(Boolean).join(", ")
                                      : selectedApp.propertyAddress
                                    if (addr) fetchValuation(addr)
                                  }}
                                  disabled={valuationLoading}
                                >
                                  {valuationLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Home className="h-3 w-3 mr-1" />}
                                  Get Estimate
                                </Button>
                              )}
                            </div>
                          )}
                          {/* Zillow Valuation Result */}
                          {valuation && (
                            <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3">
                              {valuation.success ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-2xl font-bold text-green-500">
                                      ${valuation.estimatedValue?.toLocaleString()}
                                    </p>
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
                                      Last sold: {valuation.lastSoldPrice ? `$${valuation.lastSoldPrice.toLocaleString()}` : ""}
                                      {valuation.lastSoldDate ? ` on ${valuation.lastSoldDate}` : ""}
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
                              <Input
                                value={getFieldValue("property_state") || ""}
                                onChange={(e) => setField("property_state", e.target.value)}
                                placeholder="GA"
                                className="bg-muted border-border text-foreground mt-1"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Zip</p>
                              <Input
                                value={getFieldValue("property_zip") || ""}
                                onChange={(e) => setField("property_zip", e.target.value)}
                                className="bg-muted border-border text-foreground mt-1"
                              />
                            </div>
                          </>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            Property Value
                            {isFieldModified("property_value") && <span className="text-blue-400">*</span>}
                          </p>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={getFieldValue("property_value") || ""}
                              onChange={(e) => setField("property_value", e.target.value ? Number(e.target.value) : null)}
                              className="bg-muted border-border text-foreground mt-1 text-lg font-semibold"
                            />
                          ) : (
                            <p className="text-lg font-semibold text-foreground">
                              {getFieldValue("property_value") ? `$${Number(getFieldValue("property_value")).toLocaleString()}` : "—"}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            Property Type
                            {isFieldModified("property_type") && <span className="text-blue-400">*</span>}
                          </p>
                          {isEditing ? (
                            <Input
                              value={getFieldValue("property_type") || ""}
                              onChange={(e) => setField("property_type", e.target.value)}
                              className="bg-muted border-border text-foreground mt-1"
                            />
                          ) : (
                            <p className="text-lg font-semibold text-foreground">{getFieldValue("property_type") || "—"}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <hr className="border-border" />

                    {/* Contact Info */}
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
                            <p className="text-sm font-medium text-foreground">{getFieldValue("applicant_name") || selectedApp.applicantName}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          {isEditing ? (
                            <Input value={getFieldValue("applicant_email") || ""} onChange={(e) => setField("applicant_email", e.target.value)} className="bg-muted border-border text-foreground mt-1" />
                          ) : (
                            <p className="text-sm font-medium text-foreground">{getFieldValue("applicant_email") || selectedApp.applicantEmail}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          {isEditing ? (
                            <Input value={getFieldValue("applicant_phone") || ""} onChange={(e) => setField("applicant_phone", e.target.value)} className="bg-muted border-border text-foreground mt-1" />
                          ) : (
                            <p className="text-sm font-medium text-foreground">{getFieldValue("applicant_phone") || selectedApp.applicantPhone || "—"}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Financial / Liquidity */}
                    {(fullApp?.annual_income || fullApp?.cash_reserves || fullApp?.investment_accounts || fullApp?.retirement_accounts || isEditing) && (
                      <>
                        <hr className="border-border" />
                        <div>
                          <h4 className="text-sm font-semibold text-[#997100] mb-3 flex items-center gap-2">
                            <DollarSign className="h-4 w-4" /> Financial Information
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Cash Reserves</p>
                              {isEditing ? (
                                <Input type="number" value={getFieldValue("cash_reserves") || ""} onChange={(e) => setField("cash_reserves", e.target.value ? Number(e.target.value) : null)} className="bg-muted border-border text-foreground mt-1" />
                              ) : (
                                <p className="text-sm font-medium text-foreground">{getFieldValue("cash_reserves") ? `$${Number(getFieldValue("cash_reserves")).toLocaleString()}` : "—"}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Investment Accounts</p>
                              {isEditing ? (
                                <Input type="number" value={getFieldValue("investment_accounts") || ""} onChange={(e) => setField("investment_accounts", e.target.value ? Number(e.target.value) : null)} className="bg-muted border-border text-foreground mt-1" />
                              ) : (
                                <p className="text-sm font-medium text-foreground">{getFieldValue("investment_accounts") ? `$${Number(getFieldValue("investment_accounts")).toLocaleString()}` : "—"}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Retirement Accounts</p>
                              {isEditing ? (
                                <Input type="number" value={getFieldValue("retirement_accounts") || ""} onChange={(e) => setField("retirement_accounts", e.target.value ? Number(e.target.value) : null)} className="bg-muted border-border text-foreground mt-1" />
                              ) : (
                                <p className="text-sm font-medium text-foreground">{getFieldValue("retirement_accounts") ? `$${Number(getFieldValue("retirement_accounts")).toLocaleString()}` : "—"}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <p className="text-xs text-muted-foreground">Submitted {formatDate(selectedApp.submittedAt)}</p>

                    {/* Bottom save bar when editing */}
                    {isEditing && hasEdits && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#997100]/10 border border-[#997100]/30">
                        <p className="text-sm text-[#997100] font-medium">
                          {Object.keys(editedFields).length} field{Object.keys(editedFields).length > 1 ? "s" : ""} changed — save to update lender matches
                        </p>
                        <Button
                          onClick={saveEdits}
                          disabled={isSaving}
                          className="bg-[#997100] hover:bg-[#b8850a] text-black"
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Save & Re-Match Lenders
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* ═══ LENDER MATCH — Primary Panel ═══ */}
            <Card className="bg-card border-[#997100]/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-xl flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#997100]" />
                    Lender Match
                  </CardTitle>
                  {condData?.lenderMatch && (
                    <Badge className={`text-sm px-3 py-1 ${condData.lenderMatch.stats.qualified > 0 ? "bg-green-600 text-white" : "bg-red-500 text-white"}`}>
                      {condData.lenderMatch.stats.qualified} of {condData.lenderMatch.stats.total} lenders qualified
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-muted-foreground">
                  Lenders matched against this application&apos;s credit score, loan amount, and property state
                </CardDescription>
              </CardHeader>
              <CardContent>
                {condLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !condData?.lenderMatch || condData.lenderMatch.matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No DSCR lenders in database yet. Add lenders in the DSCR Matcher tool.</p>
                ) : (
                  <div className="space-y-3">
                    {/* Qualified lenders first */}
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
                    {/* Disqualified lenders */}
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
                                {m.reasons.map((r, i) => (
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

            {/* SMS Compose */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#997100]" />
                  Message Applicant
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                  <a
                    href={`tel:${selectedApp.applicantPhone}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-green-600 text-white hover:bg-green-700 transition"
                    title="Call"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                  <Button
                    onClick={sendSms}
                    disabled={sendingSms || !smsText.trim()}
                    className="bg-[#997100] hover:bg-[#b8850a] text-black h-10"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Conditions & Documents Tracker */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#997100]" />
                  Conditions & Documents
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Track required documents and their status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {condLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Progress bar */}
                    {condData && condData.progress.total > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>{condData.progress.received} of {condData.progress.total} received</span>
                          <span>{condData.progress.approved} approved</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-[#997100] h-2 rounded-full transition-all"
                            style={{ width: `${condData.progress.total > 0 ? (condData.progress.received / condData.progress.total) * 100 : 0}%` }}
                          />
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
                      <Button
                        onClick={() => addConditionItem(newCondLabel)}
                        disabled={addingCond || !newCondLabel.trim()}
                        className="bg-[#997100] hover:bg-[#b8850a] text-black"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Templates */}
                    <div>
                      <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="text-xs text-[#997100] hover:text-[#b8850a] font-medium"
                      >
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
                          onClick={() => {
                            navigator.clipboard.writeText(portalUrl)
                            setCopiedPortal(true)
                            setTimeout(() => setCopiedPortal(false), 2000)
                          }}
                          title={portalUrl}
                        >
                          {copiedPortal ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                          {copiedPortal ? "Copied!" : "Copy Portal Link"}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ RIGHT SIDEBAR ═══ */}
          <div className="space-y-6">
            {/* Review Panel */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Review Application</CardTitle>
                <CardDescription className="text-muted-foreground">Update status and add notes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Update Status</label>
                  <Select
                    defaultValue={selectedApp.status}
                    onValueChange={(value) => handleStatusUpdate(selectedApp.dbId, value)}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Review Notes</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="bg-card border-border text-foreground min-h-[80px]"
                    placeholder="Add your review notes..."
                  />
                </div>

                <div className="space-y-2">
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleStatusUpdate(selectedApp.dbId, "approved")}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-black bg-transparent"
                    onClick={() => handleStatusUpdate(selectedApp.dbId, "under_review")}
                    disabled={isUpdating}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Request More Info
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-red-600 text-red-600 hover:bg-red-600 hover:text-white bg-transparent"
                    onClick={() => handleStatusUpdate(selectedApp.dbId, "rejected")}
                    disabled={isUpdating}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center shrink-0">
                      <CheckCircle className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Application Submitted</p>
                      <p className="text-xs text-muted-foreground">{formatDate(selectedApp.submittedAt)}</p>
                    </div>
                  </div>
                  {selectedApp.status !== "submitted" && (
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center shrink-0">
                        <Clock className="h-3 w-3 text-black" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Under Review</p>
                        <p className="text-xs text-muted-foreground">Review in progress</p>
                      </div>
                    </div>
                  )}
                  {selectedApp.status === "approved" && (
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Approved</p>
                        <p className="text-xs text-muted-foreground">Application approved</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // APPLICATIONS LIST VIEW
  // ═══════════════════════════════════════════════════════════

  function renderAppCard(app: Application) {
    const isComplete = app.completenessPercent === 100
    return (
      <Card
        key={app.id}
        className={`bg-card transition-colors cursor-pointer ${
          isComplete
            ? "border-border hover:border-[#997100]/50"
            : "border-orange-500/40 hover:border-orange-500/70"
        }`}
        onClick={() => setSelectedApp(app)}
      >
        <CardContent className="pt-6">
          {/* Incomplete banner */}
          {!isComplete && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="text-sm font-medium text-orange-500">
                Incomplete ({app.completenessPercent}%)
              </span>
              <span className="text-xs text-orange-400">
                Missing: {app.missingFields.join(", ")}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {isComplete ? (
                <CircleCheck className="h-5 w-5 text-green-500 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
              )}
              <div>
                <h3 className="font-semibold text-foreground">{app.applicantName}</h3>
                <p className="text-sm text-muted-foreground">
                  {app.id} &bull; {app.applicantEmail}
                </p>
                <p className="text-sm text-muted-foreground">{app.propertyAddress}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-semibold text-foreground">
                  {app.loanAmount ? `$${app.loanAmount.toLocaleString()}` : "—"}
                </p>
                <p className="text-sm text-muted-foreground">{formatDate(app.submittedAt)}</p>
                <Badge className={getStatusColor(app.status)}>{formatStatus(app.status)}</Badge>
              </div>
              <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                {/* Follow-up button for incomplete apps */}
                {!isComplete && app.applicantPhone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-orange-400 text-orange-500 hover:bg-orange-500 hover:text-white bg-transparent h-8 px-2 text-xs"
                    onClick={() => handleFollowUp(app)}
                    disabled={followUpId === app.dbId}
                    title="Text to complete application"
                  >
                    {followUpId === app.dbId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                    Follow Up
                  </Button>
                )}
                <a
                  href={`tel:${app.applicantPhone}`}
                  className="inline-flex items-center justify-center rounded-md border border-green-600 text-green-600 hover:bg-green-600 hover:text-white bg-transparent h-8 w-8 transition"
                  title="Call"
                >
                  <Phone className="h-4 w-4" />
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-400 text-gray-500 hover:bg-gray-500 hover:text-white bg-transparent h-8 w-8 p-0"
                  onClick={() => handleArchive(app.dbId)}
                  disabled={isUpdating || app.status === "archived"}
                  title="Archive"
                >
                  <Archive className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-400 text-red-500 hover:bg-red-600 hover:text-white bg-transparent h-8 w-8 p-0"
                  onClick={() => handleDelete(app.dbId)}
                  disabled={deletingId === app.dbId}
                  title="Delete"
                >
                  {deletingId === app.dbId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Loan Pipeline</h2>
          <p className="text-muted-foreground">
            {completeApps.length} ready to work &bull; {incompleteApps.length} incomplete
          </p>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            onClick={onRefresh}
            className="border-border text-foreground hover:bg-muted bg-transparent"
          >
            Refresh
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name, app number, or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card border-border text-foreground"
                />
              </div>
            </div>
            <Select value={completenessFilter} onValueChange={(v) => setCompletenessFilter(v as any)}>
              <SelectTrigger className="w-48 bg-card border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Applications</SelectItem>
                <SelectItem value="complete">Complete Only</SelectItem>
                <SelectItem value="incomplete">Incomplete Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-card border-border text-foreground">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Complete Applications */}
      {completeApps.length > 0 && (completenessFilter === "all" || completenessFilter === "complete") && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CircleCheck className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-semibold text-foreground">Ready to Work ({completeApps.length})</h3>
          </div>
          <div className="grid gap-4">
            {completeApps.map(renderAppCard)}
          </div>
        </div>
      )}

      {/* Incomplete Applications */}
      {incompleteApps.length > 0 && (completenessFilter === "all" || completenessFilter === "incomplete") && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-foreground">Incomplete — Needs Follow-Up ({incompleteApps.length})</h3>
          </div>
          <div className="grid gap-4">
            {incompleteApps.map(renderAppCard)}
          </div>
        </div>
      )}

      {filteredApplications.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No applications found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
