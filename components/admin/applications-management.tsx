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
  const [showLenderDetail, setShowLenderDetail] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [smsText, setSmsText] = useState("")
  const [sendingSms, setSendingSms] = useState(false)
  const [smsStatus, setSmsStatus] = useState<"idle" | "sent" | "error">("idle")
  const [copiedPortal, setCopiedPortal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
    return matchesStatus && matchesSearch
  })

  // Fetch conditions + lender data when an app is selected
  const fetchConditions = useCallback(async (dbId: string) => {
    setCondLoading(true)
    try {
      const res = await fetch(`/api/applications/${dbId}/conditions`)
      if (res.ok) setCondData(await res.json())
    } catch { /* ignore */ }
    setCondLoading(false)
  }, [])

  useEffect(() => {
    if (selectedApp) {
      fetchConditions(selectedApp.dbId)
    } else {
      setCondData(null)
      setPortalUrl("")
      setSmsText("")
      setSmsStatus("idle")
    }
  }, [selectedApp, fetchConditions])

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

        {updateError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="text-sm font-medium">Error: {updateError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ═══ LEFT: Application Details + SMS + Conditions ═══ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Application Info */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground text-2xl">{selectedApp.id}</CardTitle>
                    <CardDescription className="text-muted-foreground text-lg">
                      {selectedApp.applicantName} &bull; {selectedApp.applicantEmail}
                      {selectedApp.applicantPhone && <span> &bull; {selectedApp.applicantPhone}</span>}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(selectedApp.status)}>
                    {getStatusIcon(selectedApp.status)}
                    <span className="ml-2">{formatStatus(selectedApp.status)}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Loan Amount</p>
                    <p className="text-lg font-semibold text-foreground">${selectedApp.loanAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Property Type</p>
                    <p className="text-lg font-semibold text-foreground">{selectedApp.loanType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Credit Score</p>
                    <p className="text-lg font-semibold text-foreground">{selectedApp.creditScoreRange}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Property Value</p>
                    <p className="text-lg font-semibold text-foreground">
                      {selectedApp.propertyValue ? `$${selectedApp.propertyValue.toLocaleString()}` : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Property Address</p>
                  <p className="text-foreground">{selectedApp.propertyAddress}</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Submitted {formatDate(selectedApp.submittedAt)}</p>
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

            {/* DSCR Lender Match */}
            {condData?.lenderMatch && condData.lenderMatch.matches.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowLenderDetail(!showLenderDetail)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-foreground text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#997100]" />
                      DSCR Lender Match
                      <Badge className="bg-green-600 text-white ml-1">
                        {condData.lenderMatch.stats.qualified} qualified
                      </Badge>
                    </CardTitle>
                    {showLenderDetail ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </CardHeader>
                {showLenderDetail && (
                  <CardContent className="pt-0 space-y-2">
                    {condData.lenderMatch.matches.map((m) => (
                      <div
                        key={m.lender.id}
                        className={`rounded-lg border p-3 text-xs ${
                          m.qualified ? "border-green-600/30 bg-green-600/5" : "border-border bg-muted opacity-70"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{m.lender.name}</p>
                            <p className="text-muted-foreground">{m.lender.short_name}</p>
                          </div>
                          {m.qualified ? (
                            <Shield className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                          <span>DSCR &ge; {m.lender.min_dscr}</span>
                          <span>FICO &ge; {m.lender.min_fico}</span>
                          <span>Loan ${m.lender.min_loan.toLocaleString()}+</span>
                          {m.lender.max_loan && <span>Max ${m.lender.max_loan.toLocaleString()}</span>}
                          {m.lender.max_term && <span>{m.lender.max_term}</span>}
                        </div>
                        {m.reasons.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {m.reasons.map((r, i) => (
                              <p key={i} className="text-red-500">{r}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )}

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Applications Management</h2>
          <p className="text-muted-foreground">Review and manage loan applications</p>
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
                  placeholder="Search applications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card border-border text-foreground"
                />
              </div>
            </div>
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

      {/* Applications List */}
      <div className="grid gap-4">
        {filteredApplications.map((app) => (
          <Card
            key={app.id}
            className="bg-card border-border hover:border-[#997100]/50 transition-colors cursor-pointer"
            onClick={() => setSelectedApp(app)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(app.status)}
                  <div>
                    <h3 className="font-semibold text-foreground">{app.id}</h3>
                    <p className="text-sm text-muted-foreground">
                      {app.applicantName} &bull; {app.applicantEmail}
                    </p>
                    <p className="text-sm text-muted-foreground">{app.propertyAddress}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-foreground">${app.loanAmount.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(app.submittedAt)}</p>
                    <Badge className={getStatusColor(app.status)}>{formatStatus(app.status)}</Badge>
                  </div>
                  <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
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
        ))}
      </div>

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
