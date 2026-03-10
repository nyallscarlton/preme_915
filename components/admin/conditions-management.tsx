"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle,
  Clock,
  FileText,
  Search,
  Filter,
  Upload,
  Plus,
  Trash2,
  Eye,
  Download,
  ArrowLeft,
  Loader2,
  Mail,
  Copy,
  Link2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  File,
} from "lucide-react"

// ─── Types ───

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
  status: string // outstanding, submitted, approved, waived
  due_date: string | null
  created_by: string | null
  created_at: string
}

interface ConditionDocument {
  id: string
  application_id: string | null
  file_name: string
  storage_path: string
  document_type: string | null
  status: string
  uploaded_by: string | null
  created_at: string
}

interface ConditionsData {
  conditions: Condition[]
  documents: ConditionDocument[]
  progress: { total: number; received: number; cleared: number; pending: number }
  templates: Record<string, string[]>
}

interface ConditionsManagementProps {
  applications: Application[]
}

// ─── Status helpers ───

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  outstanding: { label: "Added", color: "border-orange-400 text-orange-500 bg-orange-500/10", icon: <Clock className="h-3.5 w-3.5" /> },
  submitted: { label: "Received", color: "border-blue-400 text-blue-500 bg-blue-500/10", icon: <FileText className="h-3.5 w-3.5" /> },
  approved: { label: "Cleared", color: "border-green-400 text-green-500 bg-green-500/10", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  waived: { label: "Waived", color: "border-gray-400 text-gray-400 bg-gray-400/10", icon: <CheckCircle className="h-3.5 w-3.5" /> },
}

// ─── Component ───

export function ConditionsManagement({ applications }: ConditionsManagementProps) {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [condData, setCondData] = useState<ConditionsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [newCondLabel, setNewCondLabel] = useState("")
  const [addingCond, setAddingCond] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [portalUrl, setPortalUrl] = useState("")
  const [copiedPortal, setCopiedPortal] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractResult, setExtractResult] = useState<{ count: number; source: string } | null>(null)
  const [extractError, setExtractError] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const extractRef = useRef<HTMLInputElement | null>(null)

  // ─── Fetch ───

  const fetchConditions = useCallback(async (dbId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/applications/${dbId}/conditions`)
      if (res.ok) setCondData(await res.json())
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (selectedApp) {
      fetchConditions(selectedApp.dbId)
      setPortalUrl("")
    }
  }, [selectedApp, fetchConditions])

  // ─── Actions ───

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

  async function addBatch(labels: string[]) {
    if (!selectedApp) return
    await fetch(`/api/applications/${selectedApp.dbId}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_batch", labels }),
    })
    setShowTemplates(false)
    fetchConditions(selectedApp.dbId)
  }

  async function updateStatus(conditionId: string, status: string) {
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

  async function handleUpload(conditionId: string, file: File) {
    if (!selectedApp) return
    setUploading(conditionId)
    const form = new FormData()
    form.append("file", file)
    form.append("condition_id", conditionId)
    form.append("uploaded_by", "admin")

    await fetch(`/api/applications/${selectedApp.dbId}/conditions`, {
      method: "POST",
      body: form,
    })
    setUploading(null)
    fetchConditions(selectedApp.dbId)
  }

  async function handleExtract(file: File) {
    if (!selectedApp) return
    setExtracting(true)
    setExtractResult(null)
    setExtractError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("action", "extract")
      const res = await fetch(`/api/applications/${selectedApp.dbId}/conditions`, {
        method: "POST",
        body: form,
      })
      const json = await res.json()
      if (!res.ok) {
        setExtractError(json.error || "Extraction failed")
      } else {
        setExtractResult({ count: json.extracted, source: json.source })
        fetchConditions(selectedApp.dbId)
      }
    } catch {
      setExtractError("Extraction request failed")
    }
    setExtracting(false)
  }

  async function sendEmail() {
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
    } catch { /* */ }
    setSendingEmail(false)
  }

  // ─── Helpers ───

  function getDocsForCondition(conditionTitle: string): ConditionDocument[] {
    if (!condData) return []
    // Match documents by document_type containing condition title, or by storage path containing condition id
    return condData.documents.filter((d) =>
      d.document_type === conditionTitle ||
      d.file_name.toLowerCase().includes(conditionTitle.toLowerCase().split(" ")[0])
    )
  }

  const filteredApps = applications.filter((app) =>
    app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredConditions = condData?.conditions.filter((c) =>
    statusFilter === "all" || c.status === statusFilter
  ) || []

  // ═══════════════════════════════════════════════════════════
  // CONDITION DETAIL VIEW (selected application)
  // ═══════════════════════════════════════════════════════════

  if (selectedApp) {
    const progress = condData?.progress
    const pctReceived = progress && progress.total > 0 ? Math.round((progress.received / progress.total) * 100) : 0
    const pctCleared = progress && progress.total > 0 ? Math.round((progress.cleared / progress.total) * 100) : 0

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-muted bg-transparent"
            onClick={() => { setSelectedApp(null); setCondData(null) }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Applications
          </Button>
          <div className="flex items-center gap-2">
            <Button
              onClick={sendEmail}
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
              >
                {copiedPortal ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                {copiedPortal ? "Copied!" : "Portal Link"}
              </Button>
            )}
          </div>
        </div>

        {/* Application summary */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedApp.applicantName}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedApp.id} &bull; {selectedApp.applicantEmail} &bull; ${selectedApp.loanAmount.toLocaleString()} &bull; {selectedApp.loanType}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {progress && (
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">{progress.total} conditions</p>
                    <p className="font-medium text-foreground">{progress.received} received &bull; {progress.cleared} cleared</p>
                  </div>
                )}
              </div>
            </div>
            {/* Progress bars */}
            {progress && progress.total > 0 && (
              <div className="mt-4 space-y-2">
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Received</span>
                    <span>{pctReceived}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pctReceived}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Cleared</span>
                    <span>{pctCleared}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pctCleared}%` }} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add condition + Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <Input
              value={newCondLabel}
              onChange={(e) => setNewCondLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addConditionItem(newCondLabel)}
              placeholder="Add new condition..."
              className="bg-card border-border text-foreground"
            />
            <Button
              onClick={() => addConditionItem(newCondLabel)}
              disabled={addingCond || !newCondLabel.trim()}
              className="bg-[#997100] hover:bg-[#b8850a] text-black"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-muted bg-transparent"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              Templates
            </Button>
            <input
              type="file"
              ref={extractRef}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleExtract(file)
                e.target.value = ""
              }}
            />
            <Button
              variant="outline"
              className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-black bg-transparent"
              onClick={() => extractRef.current?.click()}
              disabled={extracting}
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              {extracting ? "Extracting..." : "Import from PDF/Image"}
            </Button>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 bg-card border-border text-foreground">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="outstanding">Added</SelectItem>
              <SelectItem value="submitted">Received</SelectItem>
              <SelectItem value="approved">Cleared</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Templates dropdown */}
        {showTemplates && condData?.templates && (
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Quick-add a full set of conditions:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(condData.templates).map(([key, labels]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-black bg-transparent"
                    onClick={() => addBatch(labels)}
                  >
                    {key.toUpperCase()} ({labels.length} items)
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extraction result/error */}
        {extractResult && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Extracted {extractResult.count} conditions from {extractResult.source}
                </span>
              </div>
              <button onClick={() => setExtractResult(null)} className="text-green-500 hover:text-green-400">
                &times;
              </button>
            </CardContent>
          </Card>
        )}
        {extractError && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{extractError}</span>
              </div>
              <button onClick={() => setExtractError(null)} className="text-red-500 hover:text-red-400">
                &times;
              </button>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Conditions list */}
        {!loading && (
          <div className="space-y-3">
            {filteredConditions.length === 0 && (
              <Card className="bg-card border-border">
                <CardContent className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {condData?.conditions.length === 0 ? "No conditions added yet" : "No conditions match this filter"}
                  </p>
                </CardContent>
              </Card>
            )}

            {filteredConditions.map((c) => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.outstanding
              const docs = getDocsForCondition(c.title)
              const isUploading = uploading === c.id

              return (
                <Card key={c.id} className="bg-card border-border">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      {/* Status cycle button */}
                      <button
                        onClick={() => {
                          const next = c.status === "outstanding" ? "submitted"
                            : c.status === "submitted" ? "approved"
                            : c.status
                          if (next !== c.status) updateStatus(c.id, next)
                        }}
                        className={`mt-0.5 shrink-0 transition ${
                          c.status === "approved" ? "text-green-500" :
                          c.status === "submitted" ? "text-blue-500" :
                          c.status === "waived" ? "text-gray-400" :
                          "text-gray-400 hover:text-[#997100]"
                        }`}
                        title={`Status: ${cfg.label}. Click to advance.`}
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>

                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className={`text-sm font-medium ${
                            c.status === "approved" || c.status === "waived" ? "line-through text-muted-foreground" : "text-foreground"
                          }`}>
                            {c.title}
                          </h3>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                              {cfg.icon}
                              <span className="ml-1">{cfg.label}</span>
                            </Badge>
                          </div>
                        </div>

                        {c.description && (
                          <p className="text-xs text-muted-foreground mb-2">{c.description}</p>
                        )}

                        {/* Uploaded documents */}
                        {docs.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {docs.map((doc) => (
                              <div key={doc.id} className="flex items-center gap-2 text-xs p-1.5 bg-muted rounded">
                                <File className="h-3.5 w-3.5 text-[#997100] shrink-0" />
                                <span className="text-foreground truncate">{doc.file_name}</span>
                                <span className="text-muted-foreground shrink-0">
                                  by {doc.uploaded_by || "borrower"}
                                </span>
                                <span className="text-muted-foreground shrink-0">
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions row */}
                        <div className="flex items-center gap-2 mt-2">
                          {/* Upload button */}
                          <input
                            type="file"
                            ref={(el) => { fileRefs.current[c.id] = el }}
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleUpload(c.id, file)
                              e.target.value = ""
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-border text-foreground hover:bg-muted bg-transparent text-xs h-7"
                            onClick={() => fileRefs.current[c.id]?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3 mr-1" />
                            )}
                            {isUploading ? "Uploading..." : "Upload"}
                          </Button>

                          {/* Status quick-set */}
                          {c.status !== "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white bg-transparent text-xs h-7"
                              onClick={() => updateStatus(c.id, "approved")}
                            >
                              Clear
                            </Button>
                          )}

                          {c.status !== "waived" && c.status !== "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-border text-muted-foreground hover:bg-muted bg-transparent text-xs h-7"
                              onClick={() => updateStatus(c.id, "waived")}
                            >
                              Waive
                            </Button>
                          )}

                          <div className="flex-1" />

                          <span className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>

                          <button
                            onClick={() => deleteCond(c.id)}
                            className="text-muted-foreground hover:text-red-500 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // APPLICATION PICKER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Conditions Management</h2>
        <p className="text-muted-foreground">Select an application to manage its conditions and documents</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name or application number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border text-foreground"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {filteredApps.map((app) => (
          <Card
            key={app.dbId}
            className="bg-card border-border hover:border-[#997100]/50 transition-colors cursor-pointer"
            onClick={() => setSelectedApp(app)}
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-[#997100]/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-[#997100]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{app.applicantName}</h3>
                    <p className="text-sm text-muted-foreground">{app.id} &bull; {app.loanType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-foreground">${app.loanAmount.toLocaleString()}</p>
                    <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                      {app.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredApps.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No applications found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
