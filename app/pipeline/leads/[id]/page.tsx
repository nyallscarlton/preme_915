"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Phone, Mail, MessageSquare, Clock, CheckCircle2,
  XCircle, AlertCircle, User, FileText, Plus, Play, Pause,
  Send, Trash2, ExternalLink, Upload, Building2, Shield,
  ChevronDown, ChevronUp, Copy, Link2, ListOrdered,
} from "lucide-react"
import { useNumberHealth, getHealthDisplay, type NumberHealthEntry } from "@/lib/use-number-health"

interface EmailEvent {
  id: string
  event_type: string
  recipient_email: string
  application_number: string | null
  subject: string | null
  link_clicked: string | null
  event_timestamp: string
  created_at: string
}

interface ApplicationRecord {
  id: string
  applicant_name: string
  applicant_email: string
  applicant_phone: string
  application_number: string
  status: string
  loan_amount: number | null
  loan_type: string | null
  property_address: string | null
  credit_score_range: string | null
  guest_token: string | null
  first_opened_at: string | null
  created_at: string
  submitted_at: string | null
  lead_id: string | null
}

interface LeadDetail {
  lead: Record<string, unknown>
  events: Record<string, unknown>[]
  notes: Record<string, unknown>[]
  tasks: Record<string, unknown>[]
  enrollments: Record<string, unknown>[]
  interactions: Record<string, unknown>[]
  application: ApplicationRecord | null
  emailEvents: EmailEvent[]
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
  max_units: number | null
  ltv: Record<string, number>
  states: string[]
  total_lender_fees: number | null
  max_term: string | null
  ppp: string | null
  recourse: string | null
}

interface MatchResult {
  lender: DscrLender
  qualified: boolean
  reasons: string[]
}

interface LoanApplication {
  id: string
  applicant_name: string
  applicant_email: string
  applicant_phone: string
  application_number: string
  loan_amount: number
  loan_purpose: string
  loan_type: string
  property_type: string
  property_value: number
  property_address: string
  credit_score_range: string
  annual_income: number
}

interface ConditionsData {
  conditions: Condition[]
  lenderMatch: {
    matches: MatchResult[]
    application: LoanApplication | null
    stats: { qualified: number; total: number }
  }
  progress: { total: number; received: number; approved: number; pending: number }
  templates: Record<string, string[]>
  application: LoanApplication | null
}

const STATUS_OPTIONS = [
  "new", "contacting", "calling", "contacted", "qualified",
  "not_qualified", "application", "processing", "closed_won", "closed_lost", "dead",
]

const DQ_REASONS = [
  { value: "bad_credit", label: "Bad Credit", followUp: "90-day credit fix nurture → Riley re-qualifies at Day 90" },
  { value: "not_ready", label: "Not Ready / Timing", followUp: "30-day check-in → Riley calls at Day 30" },
  { value: "no_budget", label: "No Budget / Can't Qualify", followUp: "6-month reserve builder → Riley re-qualifies at Day 180" },
  { value: "wrong_market", label: "Wrong Market / Location", followUp: "Referral close text → no further follow-up" },
  { value: "no_interest", label: "Not Interested", followUp: "30-day soft re-engage text" },
  { value: "duplicate", label: "Duplicate Lead", followUp: "No follow-up — marked as dead" },
  { value: "other", label: "Other", followUp: "60-day general nurture → Riley calls at Day 60" },
]

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacting: "bg-indigo-100 text-indigo-800",
  calling: "bg-yellow-100 text-yellow-800",
  contacted: "bg-green-100 text-green-800",
  qualified: "bg-emerald-100 text-emerald-800",
  application: "bg-purple-100 text-purple-800",
  processing: "bg-orange-100 text-orange-800",
  closed_won: "bg-green-100 text-green-800",
  closed_lost: "bg-red-100 text-red-800",
  handed_off: "bg-teal-100 text-teal-800",
  converted: "bg-green-100 text-green-800",
  dead: "bg-gray-100 text-gray-800",
  not_qualified: "bg-red-100 text-red-800",
}

const TEMP_COLORS: Record<string, string> = {
  hot: "bg-red-100 text-red-800",
  warm: "bg-yellow-100 text-yellow-800",
  cold: "bg-blue-100 text-blue-800",
}

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { getHealth } = useNumberHealth()
  const [newNote, setNewNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [smsText, setSmsText] = useState("")
  const [sendingSms, setSendingSms] = useState(false)
  const [smsStatus, setSmsStatus] = useState<"idle" | "sent" | "error">("idle")
  const [condData, setCondData] = useState<ConditionsData | null>(null)
  const [newCondLabel, setNewCondLabel] = useState("")
  const [addingCond, setAddingCond] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [portalUrl, setPortalUrl] = useState("")
  const [showLenderDetail, setShowLenderDetail] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  // Inline contact editor (name / email / phone)
  const [editingContact, setEditingContact] = useState(false)
  const [editFirstName, setEditFirstName] = useState("")
  const [editLastName, setEditLastName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [savingContact, setSavingContact] = useState(false)
  const [contactError, setContactError] = useState("")
  const [activeTab, setActiveTab] = useState<"conversation" | "activity" | "notes" | "sequence">("conversation")
  const [callingBridge, setCallingBridge] = useState(false)
  const [valuation, setValuation] = useState<{ estimatedValue: number; sqft: number; bedrooms: number; bathrooms: number; yearBuilt: number; lastSoldPrice: number; lastSoldDate: string; source: string } | null>(null)
  const [fetchingValuation, setFetchingValuation] = useState(false)
  const [sendingApp, setSendingApp] = useState(false)
  const [appLink, setAppLink] = useState<string | null>(null)
  const [appSent, setAppSent] = useState<"idle" | "texted" | "emailed" | "copied" | "error">("idle")
  const [appError, setAppError] = useState<string | null>(null)
  const [showDqMenu, setShowDqMenu] = useState(false)
  const [dqSaving, setDqSaving] = useState(false)
  const [expandedPastSeq, setExpandedPastSeq] = useState<string | null>(null)

  async function callBridge() {
    if (!data?.lead) return
    setCallingBridge(true)
    try {
      const res = await fetch("/api/pipeline/call-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: data.lead.id,
          leadPhone: data.lead.phone,
          leadName: `${data.lead.first_name} ${data.lead.last_name}`,
        }),
      })
      if (!res.ok) throw new Error("Call bridge failed")
      // Call initiated — your phone will ring
    } catch (err) {
      console.error("[call-bridge]", err)
    } finally {
      setTimeout(() => setCallingBridge(false), 5000)
    }
  }

  async function sendApp(mode: "sms" | "email" | "copy") {
    if (!data?.lead) return
    setSendingApp(true)
    setAppSent("idle")
    setAppError(null)
    try {
      const res = await fetch(`/api/pipeline/leads/${params.id}/send-app`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendViaSms: mode === "sms",
          sendViaEmail: mode === "email",
        }),
      })
      const result = await res.json()
      if (result.appUrl) {
        setAppLink(result.appUrl)
        if (mode === "sms") {
          if (result.smsSent) {
            setAppSent("texted")
          } else {
            setAppSent("error")
            setAppError(result.smsError || "SMS failed to send")
          }
        } else if (mode === "email") {
          if (result.emailSent) {
            setAppSent("emailed")
          } else {
            setAppSent("error")
            setAppError(result.emailError || "Email failed to send")
          }
        } else {
          await navigator.clipboard.writeText(result.appUrl)
          setAppSent("copied")
        }
        fetchLead()
      } else {
        setAppSent("error")
        setAppError(result.error || "Failed to generate application")
      }
    } catch {
      setAppSent("error")
    } finally {
      setSendingApp(false)
      setTimeout(() => setAppSent("idle"), 4000)
    }
  }

  async function fetchValuation(address: string) {
    setFetchingValuation(true)
    try {
      const res = await fetch("/api/pipeline/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      })
      const result = await res.json()
      if (result.success) setValuation(result)
    } catch {
      // ignore
    } finally {
      setFetchingValuation(false)
    }
  }

  async function markSpoken() {
    if (!data?.lead) return
    // Cancel all active sequences + update status to contacted
    await Promise.all([
      fetch(`/api/pipeline/leads/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_sequences", reason: "spoke_with_lead" }),
      }),
      fetch(`/api/pipeline/leads/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "contacted" }),
      }),
    ])
    fetchLead()
  }

  async function disqualifyLead(reason: string) {
    setDqSaving(true)
    setShowDqMenu(false)
    await fetch(`/api/pipeline/leads/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disqualify", reason }),
    })
    setDqSaving(false)
    fetchLead()
  }

  const fetchLead = useCallback(async () => {
    const res = await fetch(`/api/pipeline/leads/${params.id}`)
    if (res.ok) {
      const json = await res.json()
      setData(json)
    }
    setLoading(false)
  }, [params.id])

  const fetchConditions = useCallback(async () => {
    const res = await fetch(`/api/pipeline/leads/${params.id}/conditions`)
    if (res.ok) setCondData(await res.json())
  }, [params.id])

  useEffect(() => {
    fetchLead()
    fetchConditions()
  }, [fetchLead, fetchConditions])

  async function updateStatus(status: string) {
    await fetch(`/api/pipeline/leads/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    fetchLead()
  }

  function startEditContact() {
    if (!data?.lead) return
    setEditFirstName((data.lead.first_name as string) || "")
    setEditLastName((data.lead.last_name as string) || "")
    setEditEmail((data.lead.email as string) || "")
    setEditPhone((data.lead.phone as string) || "")
    setContactError("")
    setEditingContact(true)
  }

  function cancelEditContact() {
    setEditingContact(false)
    setContactError("")
  }

  async function saveContact() {
    setContactError("")
    // Lightweight client-side validation
    if (!editFirstName.trim() || !editLastName.trim()) {
      setContactError("First and last name are required")
      return
    }
    if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      setContactError("Invalid email format")
      return
    }
    if (editPhone && editPhone.replace(/\D/g, "").length < 10) {
      setContactError("Phone must be at least 10 digits")
      return
    }
    setSavingContact(true)
    try {
      const res = await fetch(`/api/pipeline/leads/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          email: editEmail.trim().toLowerCase(),
          phone: editPhone.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setContactError(json.error || `Save failed (${res.status})`)
        return
      }
      setEditingContact(false)
      await fetchLead()
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSavingContact(false)
    }
  }

  async function addNote() {
    if (!newNote.trim()) return
    setSaving(true)
    await fetch(`/api/pipeline/leads/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_note", content: newNote }),
    })
    setNewNote("")
    setSaving(false)
    fetchLead()
  }

  async function completeTask(taskId: string) {
    await fetch("/api/pipeline/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: "completed" }),
    })
    fetchLead()
  }

  async function sendSmsToLead() {
    if (!smsText.trim()) return
    setSendingSms(true)
    setSmsStatus("idle")
    try {
      const res = await fetch(`/api/pipeline/leads/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_sms", message: smsText }),
      })
      if (res.ok) {
        setSmsText("")
        setSmsStatus("sent")
        fetchLead()
        setTimeout(() => setSmsStatus("idle"), 3000)
      } else {
        setSmsStatus("error")
      }
    } catch {
      setSmsStatus("error")
    }
    setSendingSms(false)
  }

  async function toggleSequence(action: "pause" | "resume") {
    await fetch(`/api/pipeline/leads/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: action === "pause" ? "pause_sequence" : "resume_sequence",
        reason: "manual",
      }),
    })
    fetchLead()
  }

  async function addConditionItem(label: string) {
    if (!label.trim()) return
    setAddingCond(true)
    await fetch(`/api/pipeline/leads/${params.id}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", label }),
    })
    setNewCondLabel("")
    setAddingCond(false)
    fetchConditions()
  }

  async function addConditionBatch(labels: string[]) {
    await fetch(`/api/pipeline/leads/${params.id}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_batch", labels }),
    })
    setShowTemplates(false)
    fetchConditions()
  }

  async function updateCondStatus(conditionId: string, status: string) {
    await fetch(`/api/pipeline/leads/${params.id}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", condition_id: conditionId, status }),
    })
    fetchConditions()
  }

  async function deleteCond(conditionId: string) {
    await fetch(`/api/pipeline/leads/${params.id}/conditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", condition_id: conditionId }),
    })
    fetchConditions()
  }

  async function sendConditionsEmail() {
    setSendingEmail(true)
    try {
      const res = await fetch(`/api/pipeline/leads/${params.id}/conditions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_request_email" }),
      })
      const json = await res.json()
      if (json.portal_url) setPortalUrl(json.portal_url)
      fetchLead()
    } catch { /* ignore */ }
    setSendingEmail(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-gray-500">
        Lead not found.{" "}
        <Link href="/pipeline/leads" className="text-blue-600 underline">Back to leads</Link>
      </div>
    )
  }

  const { lead, events, notes, tasks, enrollments, interactions, application, emailEvents } = data

  // Build unified timeline
  const timeline = buildTimeline(events, notes, tasks, interactions)
  const activeEnrollment = enrollments.find((e) => e.status === "active")
  const loanType = (lead.custom_fields as Record<string, unknown>)?.loan_type as string || "—"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pipeline/leads" className="rounded-lg p-2 hover:bg-gray-100 transition">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {lead.first_name as string} {lead.last_name as string}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status as string] || "bg-gray-100"}`}>
              {(lead.status as string).replace("_", " ")}
            </span>
            {lead.temperature ? (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TEMP_COLORS[lead.temperature as string] || ""}`}>
                {String(lead.temperature)}
              </span>
            ) : null}
            {lead.score ? (
              <span className="text-xs">Score: {Number(lead.score)}/100</span>
            ) : null}
            <span className="text-xs">{loanType}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={callBridge}
            disabled={callingBridge}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
          >
            <Phone className="h-4 w-4" /> {callingBridge ? "Calling you..." : "Call"}
          </button>
          <button
            onClick={() => {
              const el = document.getElementById("sms-compose")
              if (el) { el.scrollIntoView({ behavior: "smooth" }); el.querySelector("textarea")?.focus() }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            <MessageSquare className="h-4 w-4" /> Text
          </button>
          {/* Send Application — SMS, Email, or Copy */}
          <div className="relative flex items-center gap-1">
            <button
              onClick={() => sendApp("sms")}
              disabled={sendingApp}
              className="inline-flex items-center gap-2 rounded-l-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 transition disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {sendingApp ? "..." : appSent === "texted" ? "Texted!" : "Text App"}
            </button>
            <button
              onClick={() => sendApp("email")}
              disabled={sendingApp}
              className="inline-flex items-center gap-1.5 bg-purple-500 px-3 py-2 text-sm font-medium text-white hover:bg-purple-600 transition disabled:opacity-50"
            >
              <Mail className="h-4 w-4" /> {appSent === "emailed" ? "Emailed!" : "Email"}
            </button>
            <button
              onClick={() => { if (appLink) { navigator.clipboard.writeText(appLink); setAppSent("copied") } else { sendApp("copy") } }}
              className="inline-flex items-center gap-1.5 rounded-r-lg bg-purple-400 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 transition"
            >
              <Copy className="h-3.5 w-3.5" /> {appSent === "copied" ? "Copied!" : "Copy"}
            </button>
            {appError && (
              <div className="absolute top-full mt-1 left-0 right-0 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700 z-50">
                {appError}
              </div>
            )}
          </div>
          {/* Mark as Spoken / Pause Sequences */}
          {activeEnrollment && (
            <button
              onClick={markSpoken}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition"
            >
              <Pause className="h-4 w-4" /> Spoke with Lead
            </button>
          )}
          {/* Not Qualified — disqualify with reason */}
          <div className="relative">
            <button
              onClick={() => setShowDqMenu(!showDqMenu)}
              disabled={dqSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> {dqSaving ? "Saving..." : "Not Qualified"}
            </button>
            {showDqMenu && (
              <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border bg-white shadow-lg z-50">
                <div className="p-1.5 border-b bg-gray-50 rounded-t-lg">
                  <p className="text-xs font-medium text-gray-500 px-2">Select reason — auto-enrolls in follow-up</p>
                </div>
                <div className="p-1">
                  {DQ_REASONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => disqualifyLead(r.value)}
                      className="flex w-full flex-col items-start rounded-md px-3 py-2.5 text-left hover:bg-red-50 transition"
                    >
                      <span className="text-sm font-medium text-gray-800">{r.label}</span>
                      <span className="text-xs text-gray-400 mt-0.5">{r.followUp}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline status */}
      <div className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                lead.status === s
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: GHL-style tabbed view */}
        <div className="lg:col-span-2 flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b bg-white rounded-t-xl">
            {(["conversation", "activity", "notes", "sequence"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition border-b-2 ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "conversation" && <MessageSquare className="h-4 w-4 inline mr-1.5 -mt-0.5" />}
                {tab === "activity" && <Clock className="h-4 w-4 inline mr-1.5 -mt-0.5" />}
                {tab === "notes" && <FileText className="h-4 w-4 inline mr-1.5 -mt-0.5" />}
                {tab === "sequence" && <ListOrdered className="h-4 w-4 inline mr-1.5 -mt-0.5" />}
                {tab === "sequence" ? "Follow-Up" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "conversation" && interactions.filter((i) => (i.channel as string) === "sms").length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs text-blue-600">
                    {interactions.filter((i) => (i.channel as string) === "sms").length}
                  </span>
                )}
                {tab === "sequence" && activeEnrollment && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-green-100 px-1.5 text-xs text-green-600">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ═══ CONVERSATION TAB ═══ */}
          {activeTab === "conversation" && (
            <div id="sms-compose" className="flex flex-col rounded-b-xl border border-t-0 bg-white" style={{ height: "calc(100vh - 320px)", minHeight: "500px" }}>
              {/* Lead source + time banner */}
              <div className="border-b px-4 py-2.5 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-gray-700">Lead came in from</span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ${
                      (lead.source as string)?.includes("inbound_call") ? "bg-green-100 text-green-700" :
                      (lead.source as string)?.includes("landing:") ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {(lead.source as string)?.includes("inbound_call") ? "Inbound Call" :
                       (lead.source as string)?.startsWith("landing:") ? `Google Ads → ${(lead.source as string).replace("landing:", "").replace(/-/g, " ")}` :
                       (lead.source as string) || "Direct"}
                    </span>
                    <span className="text-gray-400">at</span>
                    <span className="font-medium text-gray-700">
                      {new Date(lead.created_at as string).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                    </span>
                    {lead.utm_campaign ? (
                      <span className="text-gray-400">({String(lead.utm_campaign)})</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{lead.phone as string}</span>
                    {enrollments.length > 0 && activeEnrollment && (
                      <button
                        onClick={() => toggleSequence("pause")}
                        className="inline-flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600"
                      >
                        <Pause className="h-3 w-3" /> Pause
                      </button>
                    )}
                  </div>
                </div>
                {/* First call timing */}
                {(() => {
                  const firstCallEvent = events.find((e) => (e.event_type as string) === "retell_call_initiated" || (e.event_type as string) === "call_started")
                  if (firstCallEvent) {
                    const leadTime = new Date(lead.created_at as string)
                    const callTime = new Date(firstCallEvent.created_at as string)
                    const diffMs = callTime.getTime() - leadTime.getTime()
                    const diffSec = Math.round(diffMs / 1000)
                    const diffLabel = diffSec < 60 ? `${diffSec}s` : diffSec < 3600 ? `${Math.round(diffSec / 60)}m` : `${Math.round(diffSec / 3600)}h`
                    return (
                      <div className="flex items-center gap-1.5 mt-1 text-xs">
                        <Phone className="h-3 w-3 text-green-500" />
                        <span className="text-gray-500">Riley called</span>
                        <span className={`font-medium ${diffSec <= 120 ? "text-green-600" : diffSec <= 300 ? "text-yellow-600" : "text-red-600"}`}>{diffLabel} later</span>
                        <span className="text-gray-400">at {callTime.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}</span>
                      </div>
                    )
                  }
                  return (
                    <div className="flex items-center gap-1.5 mt-1 text-xs">
                      <AlertCircle className="h-3 w-3 text-red-400" />
                      <span className="text-red-500 font-medium">No call triggered yet</span>
                    </div>
                  )
                })()}
              </div>

              {/* Number health legend */}
              <div className="border-b px-4 py-1.5 bg-gray-50/50 flex items-center gap-3 text-[10px] text-gray-400">
                <span>Number health:</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" /> Healthy</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" /> Warning</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" /> Burned</span>
              </div>

              {/* Message thread — scrollable */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {(() => {
                  // Merge SMS + calls + emails into one thread, sorted chronologically
                  const leadFirstName = (lead.first_name as string) || "Lead"

                  function getActor(type: "sms" | "call" | "email" | "system", direction: string, meta?: Record<string, unknown>): { label: string; color: string } {
                    if (type === "sms") {
                      if (meta?.call_type === "manual_bridge" || meta?.type === "application_link") return { label: "Nyalls", color: "text-green-600" }
                      if (meta?.template || meta?.sequence_step) return { label: "Riley (Auto)", color: "text-blue-600" }
                      if (direction === "inbound") return { label: leadFirstName, color: "text-gray-600" }
                      return { label: "Riley", color: "text-blue-600" }
                    }
                    if (type === "call") {
                      if (meta?.call_type === "manual_bridge") return { label: "Nyalls", color: "text-green-600" }
                      if (typeof meta?.call_id === "string" && meta.call_id.startsWith("call_")) return { label: "Riley", color: "text-blue-600" }
                      if (direction === "inbound") return { label: `${leadFirstName} (Inbound)`, color: "text-gray-600" }
                      return { label: "Riley", color: "text-blue-600" }
                    }
                    if (type === "email") {
                      if (direction === "inbound") return { label: leadFirstName, color: "text-gray-600" }
                      return { label: "Riley (Auto)", color: "text-blue-600" }
                    }
                    return { label: "System", color: "text-gray-400" }
                  }

                  const thread: { type: "sms" | "call" | "email" | "system"; direction: string; content: string; time: string; meta?: Record<string, unknown>; summary?: string; recordingUrl?: string; duration?: number; transcript?: string; actor?: { label: string; color: string }; fromNumber?: string }[] = []

                  for (const i of interactions) {
                    const ch = i.channel as string
                    const meta = (i.metadata || {}) as Record<string, unknown>
                    if (ch === "sms") {
                      thread.push({
                        type: "sms",
                        direction: i.direction as string,
                        content: (i.content as string) || "",
                        time: i.created_at as string,
                        meta,
                        actor: getActor("sms", i.direction as string, meta),
                        fromNumber: (meta.from_number as string) || undefined,
                      })
                    } else if (ch === "voice") {
                      thread.push({
                        type: "call",
                        direction: i.direction as string,
                        content: (i.summary as string) || (i.content as string) || "",
                        time: i.created_at as string,
                        meta,
                        summary: (i.summary as string) || "",
                        recordingUrl: (meta.recording_url as string) || "",
                        duration: (meta.duration_ms as number) || 0,
                        transcript: (i.content as string) || "",
                        actor: getActor("call", i.direction as string, meta),
                        fromNumber: (meta.from_number as string) || undefined,
                      })
                    } else if (ch === "email") {
                      thread.push({
                        type: "email",
                        direction: i.direction as string,
                        content: (i.content as string) || "",
                        time: i.created_at as string,
                        meta,
                        actor: getActor("email", i.direction as string, meta),
                      })
                    }
                  }

                  // Add call events with recording URLs from lead data
                  for (const e of events) {
                    const et = e.event_type as string
                    const data = (e.event_data || {}) as Record<string, unknown>
                    if (et === "call_analyzed" && data.recording_url) {
                      // Only add if not already in interactions
                      const callId = data.call_id as string
                      const alreadyInThread = thread.some(t => t.meta?.call_id === callId)
                      if (!alreadyInThread) {
                        thread.push({
                          type: "call",
                          direction: "outbound",
                          content: (data.summary as string) || "Call completed",
                          time: e.created_at as string,
                          meta: data,
                          summary: (data.summary as string) || "",
                          recordingUrl: (data.recording_url as string) || "",
                          duration: (data.duration_ms as number) || 0,
                          actor: getActor("call", "outbound", data),
                          fromNumber: (data.from_number as string) || undefined,
                        })
                      }
                    }
                    if (et === "call_started" || et === "call_ended" || et === "retell_call_initiated" || et === "double_dial_triggered") {
                      // Skip if we have a richer call_analyzed entry for same call
                      const callId = data.call_id as string
                      const hasAnalyzed = events.some(ev => (ev.event_type as string) === "call_analyzed" && ((ev.event_data || {}) as Record<string, unknown>).call_id === callId)
                      if (!hasAnalyzed) {
                        thread.push({
                          type: "system",
                          direction: "system",
                          content: et === "call_started" ? "Riley call connected"
                            : et === "retell_call_initiated" ? "Riley call initiated"
                            : et === "double_dial_triggered" ? "Double-dial: second call triggered"
                            : `Call ended — ${data.disconnection_reason || "completed"}`,
                          time: e.created_at as string,
                        })
                      }
                    }
                    if (et === "app_sent_via_sms" || et === "app_sent_via_email" || et === "app_sms_failed" || et === "app_email_failed") {
                      thread.push({
                        type: "system",
                        direction: "system",
                        content: et === "app_sent_via_sms" ? `📱 Application sent via text (${data.app_number || ""})`
                          : et === "app_sent_via_email" ? `📧 Application sent via email to ${data.email || "lead"} (${data.app_number || ""})`
                          : et === "app_sms_failed" ? `❌ Application text failed to send`
                          : `❌ Application email failed to send`,
                        time: e.created_at as string,
                      })
                    }
                    if (et === "conditions_email_sent" || et === "sequence_sms_sent") {
                      const alreadyInThread = et === "sequence_sms_sent" && thread.some(t => t.type === "sms" && Math.abs(new Date(t.time).getTime() - new Date(e.created_at as string).getTime()) < 5000)
                      if (!alreadyInThread) {
                        const evtType = et === "sequence_sms_sent" ? "sms" as const : "email" as const
                        thread.push({
                          type: evtType,
                          direction: "outbound",
                          content: et === "conditions_email_sent" ? "Document request email sent with portal link" : `Sequence text sent (Step ${(data.step_number as number) || "?"})`,
                          time: e.created_at as string,
                          actor: getActor(evtType, "outbound", { ...data, template: true }),
                        })
                      }
                    }
                  }

                  thread.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

                  if (thread.length === 0) {
                    return <p className="text-sm text-gray-400 text-center py-12">No messages yet. Send the first text below.</p>
                  }

                  let lastDate = ""
                  return thread.map((msg, idx) => {
                    const msgDate = new Date(msg.time).toLocaleDateString()
                    const showDate = msgDate !== lastDate
                    lastDate = msgDate

                    const dateHeader = showDate ? (
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 border-t" />
                        <span className="text-xs text-gray-400">{msgDate}</span>
                        <div className="flex-1 border-t" />
                      </div>
                    ) : null

                    const timeStr = new Date(msg.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

                    // System messages (status events)
                    if (msg.direction === "system" || msg.type === "system") {
                      return (
                        <div key={idx}>
                          {dateHeader}
                          <div className="flex justify-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                              {msg.type === "call" && <Phone className="h-3 w-3" />}
                              {msg.type === "system" && <Mail className="h-3 w-3" />}
                              {msg.content}
                              <span className="text-gray-400 ml-1">{timeStr}</span>
                            </span>
                          </div>
                        </div>
                      )
                    }

                    // Call messages — with recording player, summary, transcript
                    if (msg.type === "call") {
                      const durationSec = msg.duration ? Math.round(msg.duration / 1000) : 0
                      const durationStr = durationSec > 0 ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, "0")}` : ""
                      const isInbound = msg.direction === "inbound"
                      const callFromNumber = msg.fromNumber || (msg.meta?.from_number as string) || null
                      const callHealth = getHealth(callFromNumber)
                      const callHealthDisplay = callHealth ? getHealthDisplay(callHealth.status) : null
                      const isVoicemail = msg.meta?.disconnection_reason === "voicemail_reached"
                      const isSpamLikelyVm = isVoicemail && callHealth && callHealth.status !== "healthy"

                      return (
                        <div key={idx}>
                          {dateHeader}
                          <div className={`mx-2 rounded-xl border p-3 space-y-2 ${callHealthDisplay && callHealth!.status !== "healthy" ? `${callHealthDisplay.bgColor} ${callHealthDisplay.borderColor}` : "bg-gray-50"}`}>
                            {/* Call header */}
                            <div className="flex items-center gap-2">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isInbound ? "bg-green-100" : "bg-blue-100"}`}>
                                <Phone className={`h-4 w-4 ${isInbound ? "text-green-600" : "text-blue-600"}`} />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">
                                  {isInbound ? "Inbound Call" : "Outbound Call"}
                                  {durationStr && <span className="ml-2 text-gray-400 font-normal">{durationStr}</span>}
                                  {msg.actor && <span className={`ml-2 text-xs font-medium ${msg.actor.color}`}>{msg.actor.label}</span>}
                                  {isVoicemail && (
                                    <span className={`ml-2 text-xs font-medium ${isSpamLikelyVm ? "text-red-500" : "text-gray-400"}`}>
                                      VM{isSpamLikelyVm ? " (spam likely)" : ""}
                                    </span>
                                  )}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-gray-400">{timeStr}</span>
                                  {callFromNumber && (
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${callHealthDisplay ? callHealthDisplay.badgeBg : "bg-gray-100 text-gray-500 border-gray-200"}`} title={callHealth ? `${callHealth.status} — Contact rate: ${callHealth.contact_rate !== null ? callHealth.contact_rate + "%" : "N/A"}` : "No health data"}>
                                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${callHealthDisplay ? callHealthDisplay.dotColor : "bg-gray-400"}`} />
                                      {callFromNumber.replace(/^\+1/, "").replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {!!msg.meta?.temperature && (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  String(msg.meta.temperature) === "hot" ? "bg-red-100 text-red-700" :
                                  String(msg.meta.temperature) === "warm" ? "bg-yellow-100 text-yellow-700" :
                                  "bg-gray-100 text-gray-600"
                                }`}>
                                  {String(msg.meta.temperature).charAt(0).toUpperCase() + String(msg.meta.temperature).slice(1)}
                                </span>
                              )}
                            </div>

                            {/* Call summary — collapsed if long */}
                            {msg.summary && (
                              msg.summary.length > 120 ? (
                                <details className="group">
                                  <summary className="cursor-pointer text-sm text-gray-700 leading-relaxed list-none">
                                    <span className="line-clamp-1">{msg.summary.slice(0, 120)}…</span>
                                    <span className="text-xs text-blue-600 group-open:hidden"> Show more</span>
                                  </summary>
                                  <p className="mt-1 text-sm text-gray-700 leading-relaxed">{msg.summary}</p>
                                </details>
                              ) : (
                                <p className="text-sm text-gray-700 leading-relaxed">{msg.summary}</p>
                              )
                            )}

                            {/* Audio player for recording — proxy Twilio URLs for auth */}
                            {msg.recordingUrl && (() => {
                              const src = msg.recordingUrl!.includes("api.twilio.com")
                                ? `/api/pipeline/recording?url=${encodeURIComponent(msg.recordingUrl!)}`
                                : msg.recordingUrl!
                              return (
                                <audio controls preload="none" className="w-full h-10 rounded-lg" style={{ filter: "sepia(20%) saturate(70%) grayscale(1) contrast(99%) invert(12%)" }}>
                                  <source src={src} type="audio/mpeg" />
                                  <source src={src} type="audio/wav" />
                                  Your browser does not support the audio element.
                                </audio>
                              )
                            })()}

                            {/* Expandable transcript */}
                            {msg.transcript && msg.transcript.length > 10 && (
                              <details className="group">
                                <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                  <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                                  View transcript
                                </summary>
                                <div className="mt-2 max-h-60 overflow-y-auto rounded-lg bg-white border p-3 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                                  {msg.transcript.slice(0, 3000)}
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // Email messages
                    if (msg.type === "email") {
                      return (
                        <div key={idx}>
                          {dateHeader}
                          <div className="mx-2 rounded-xl border bg-purple-50 p-3 space-y-1">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-purple-600" />
                              <span className="text-sm font-medium text-purple-800">Email</span>
                              {msg.actor && <span className={`text-xs font-medium ${msg.actor.color}`}>{msg.actor.label}</span>}
                              <span className="text-xs text-purple-400">{timeStr}</span>
                            </div>
                            <p className="text-sm text-gray-700">{msg.content?.slice(0, 500)}</p>
                          </div>
                        </div>
                      )
                    }

                    // SMS messages — chat bubbles
                    const isOutbound = msg.direction === "outbound"
                    const smsFromNumber = msg.fromNumber || (msg.meta?.from_number as string) || null
                    const smsHealth = isOutbound ? getHealth(smsFromNumber) : null
                    const smsHealthDisplay = smsHealth ? getHealthDisplay(smsHealth.status) : null
                    return (
                      <div key={idx}>
                        {dateHeader}
                        <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                          {!isOutbound && (
                            <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                              {(lead.first_name as string)?.[0] || "?"}
                            </div>
                          )}
                          <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                            isOutbound
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-gray-100 text-gray-800 rounded-bl-md"
                          }`}>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <MessageSquare className={`h-3 w-3 ${isOutbound ? "text-blue-200" : "text-gray-400"}`} />
                              <span className={`text-xs ${isOutbound ? "text-blue-200" : "text-gray-400"}`}>SMS</span>
                              {msg.actor && (
                                <span className={`text-xs font-medium ${isOutbound ? (msg.actor.label === "Nyalls" ? "text-green-200" : "text-blue-200") : msg.actor.color}`}>
                                  {msg.actor.label}
                                </span>
                              )}
                              {isOutbound && smsFromNumber && smsHealthDisplay && (
                                <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                                  smsHealth!.status === "healthy" ? "text-green-200" :
                                  smsHealth!.status === "warning" ? "text-yellow-200" :
                                  "text-red-200"
                                }`} title={`${smsHealth!.status} — Contact rate: ${smsHealth!.contact_rate !== null ? smsHealth!.contact_rate + "%" : "N/A"}`}>
                                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${smsHealthDisplay.dotColor}`} />
                                  {smsFromNumber.replace(/^\+1/, "").replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}
                                </span>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap">{msg.content?.slice(0, 1000)}</p>
                            <p className={`text-xs mt-1 ${isOutbound ? "text-blue-200" : "text-gray-400"}`}>
                              {timeStr}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>

              {/* Compose bar — fixed at bottom */}
              <div className="border-t bg-white px-4 py-3 rounded-b-xl">
                {smsStatus === "sent" && <p className="mb-2 text-xs text-green-600">Message sent</p>}
                {smsStatus === "error" && <p className="mb-2 text-xs text-red-600">Failed to send — SMS may not be enabled yet</p>}
                <div className="flex items-end gap-2">
                  <textarea
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendSmsToLead() } }}
                    placeholder="Type a message... (Enter to send)"
                    rows={1}
                    className="flex-1 rounded-xl border bg-gray-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    style={{ minHeight: "40px", maxHeight: "120px" }}
                    onInput={(e) => { const t = e.currentTarget; t.style.height = "40px"; t.style.height = t.scrollHeight + "px" }}
                  />
                  <button
                    onClick={callBridge}
                    disabled={callingBridge}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                    title="Call via bridge (rings your phone)"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                  <button
                    onClick={sendSmsToLead}
                    disabled={sendingSms || !smsText.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
                    title="Send SMS"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ACTIVITY TAB ═══ */}
          {activeTab === "activity" && (
            <div className="rounded-b-xl border border-t-0 bg-white p-4 space-y-6" style={{ minHeight: "500px" }}>
              {/* Sequence status */}
              {enrollments.length > 0 && (
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Follow-Up Sequence</h3>
                    {activeEnrollment ? (
                      <button onClick={() => toggleSequence("pause")} className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700">
                        <Pause className="h-3 w-3" /> Pause
                      </button>
                    ) : (
                      <button onClick={() => toggleSequence("resume")} className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700">
                        <Play className="h-3 w-3" /> Resume
                      </button>
                    )}
                  </div>
                  {enrollments.map((e) => (
                    <div key={e.id as string} className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">{(e.sequences as Record<string, string>)?.name || "Sequence"}</span>
                      {" — "}
                      <span className={e.status === "active" ? "text-green-600" : e.status === "paused" ? "text-orange-500" : "text-gray-400"}>
                        {e.status as string}
                      </span>
                      {" — Step "}{e.current_step as number}/15
                      {e.pause_reason ? <span className="text-xs text-gray-400"> ({String(e.pause_reason)})</span> : null}
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-4">
                {timeline.length === 0 && <p className="text-sm text-gray-400">No activity yet.</p>}
                {timeline.map((item, i) => (
                  <TimelineItem key={i} item={item} onCompleteTask={completeTask} />
                ))}
              </div>
            </div>
          )}

          {/* ═══ SEQUENCE / FOLLOW-UP TAB ═══ */}
          {activeTab === "sequence" && (
            <div className="rounded-b-xl border border-t-0 bg-white p-4 space-y-4" style={{ minHeight: "500px" }}>
              {enrollments.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ListOrdered className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No follow-up sequence active</p>
                  <p className="text-xs mt-1">Sequences are auto-assigned when leads are created or disqualified</p>
                </div>
              ) : (
                <div className="space-y-4">
                {/* Past sequences — clickable to expand */}
                {enrollments.filter((e) => e.status === "cancelled" || e.status === "completed").map((pastEnrollment) => {
                  const pastSeq = pastEnrollment.sequences as Record<string, unknown> | null
                  const pastName = (pastSeq?.name as string) || "Previous Sequence"
                  const pastId = pastEnrollment.id as string
                  const isExpanded = expandedPastSeq === pastId
                  const pastSteps = ((pastSeq?.sequence_steps as unknown[]) || [])
                    .filter((s: any) => s.active)
                    .sort((a: any, b: any) => a.step_number - b.step_number) as any[]
                  const pastCurrentStep = pastEnrollment.current_step as number
                  const pastEnrolledAt = new Date(pastEnrollment.enrolled_at as string)
                  const pastReason = pastEnrollment.pause_reason as string | null

                  return (
                    <div key={pastId} className="border-b pb-3 mb-1">
                      <button
                        onClick={() => setExpandedPastSeq(isExpanded ? null : pastId)}
                        className="flex items-center justify-between w-full text-left group"
                      >
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <XCircle className="h-3.5 w-3.5 text-gray-300" />
                          <span className="line-through">{pastName}</span>
                          <span className="text-red-400">({pastEnrollment.status as string})</span>
                          {pastReason && <span className="text-gray-300">— {pastReason.replace(/_/g, " ")}</span>}
                        </div>
                        <ChevronDown className={`h-3.5 w-3.5 text-gray-300 transition ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isExpanded && (
                        <div className="mt-3 ml-5 opacity-70">
                          {pastSteps.map((step: any, idx: number) => {
                            const stepNum = step.step_number as number
                            const isDone = stepNum <= pastCurrentStep
                            const channel = step.channel as string
                            const delayMin = step.delay_minutes as number
                            const template = step.message_templates as Record<string, string> | null
                            const scheduledAt = new Date(pastEnrolledAt.getTime() + delayMin * 60 * 1000)
                            let delayLabel = ""
                            if (delayMin < 60) delayLabel = `${delayMin}m`
                            else if (delayMin < 1440) delayLabel = `${Math.round(delayMin / 60)}h`
                            else delayLabel = `Day ${Math.round(delayMin / 1440)}`
                            const channelIcons: Record<string, string> = { auto_sms: "💬", auto_call: "📞", manual_call: "☎️", auto_email: "📧" }
                            const channelLabels: Record<string, string> = { auto_sms: "SMS", auto_call: "Riley Call", manual_call: "Manual Call", auto_email: "Email" }

                            return (
                              <div key={stepNum} className="flex gap-3 mb-0.5">
                                <div className="flex flex-col items-center w-5">
                                  <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${isDone ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                                    {isDone ? <CheckCircle2 className="h-3 w-3" /> : <span>{stepNum}</span>}
                                  </div>
                                  {idx < pastSteps.length - 1 && <div className={`w-px flex-1 min-h-[16px] ${isDone ? "bg-green-200" : "bg-gray-200"}`} />}
                                </div>
                                <div className="flex-1 pb-2 flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span>{channelIcons[channel] || "•"}</span>
                                    <span className="text-gray-600">{channelLabels[channel] || channel}</span>
                                    <span className="text-gray-300">{delayLabel}</span>
                                    {template && <span className="text-gray-400">— {template.name || template.slug}</span>}
                                  </div>
                                  <span className={`text-[10px] ${isDone ? "text-green-500" : "text-gray-300"}`}>
                                    {isDone ? "Sent" : "Skipped"}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* Only show active/paused enrollments — not cancelled ones */}
                {enrollments
                  .filter((e) => e.status === "active" || e.status === "paused")
                  .map((enrollment) => {
                  const seq = enrollment.sequences as Record<string, unknown> | null
                  const seqName = (seq?.name as string) || "Unknown Sequence"
                  const seqSlug = (seq?.slug as string) || ""
                  const steps = ((seq?.sequence_steps as unknown[]) || [])
                    .filter((s: any) => s.active)
                    .sort((a: any, b: any) => a.step_number - b.step_number) as any[]
                  const currentStep = enrollment.current_step as number
                  const enrolledAt = new Date(enrollment.enrolled_at as string)
                  const status = enrollment.status as string
                  const pauseReason = enrollment.pause_reason as string | null

                  // Friendly labels for DQ sequences
                  const isDq = seqSlug.startsWith("dq-")
                  const dqLabel = isDq ? seqSlug.replace("dq-", "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null
                  return (
                    <div key={enrollment.id as string} className="space-y-4">
                      {/* Sequence header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800">{seqName}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Enrolled {enrolledAt.toLocaleDateString()} at {enrolledAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {isDq && dqLabel && <span className="ml-2 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-xs">DQ: {dqLabel}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            status === "active" ? "bg-green-100 text-green-700" :
                            status === "paused" ? "bg-orange-100 text-orange-700" :
                            status === "completed" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {status}
                          </span>
                          {status === "active" && (
                            <button onClick={() => toggleSequence("pause")} className="text-xs text-orange-500 hover:text-orange-600">
                              <Pause className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {status === "paused" && (
                            <button onClick={() => toggleSequence("resume")} className="text-xs text-green-500 hover:text-green-600">
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {pauseReason && (
                        <p className="text-xs text-orange-500 -mt-2">Paused: {pauseReason.replace(/_/g, " ")}</p>
                      )}

                      {/* Step timeline */}
                      <div className="relative">
                        {steps.map((step: any, idx: number) => {
                          const stepNum = step.step_number as number
                          const isDone = stepNum <= currentStep
                          const isCurrent = stepNum === currentStep + 1
                          const channel = step.channel as string
                          const delayMin = step.delay_minutes as number
                          const template = step.message_templates as Record<string, string> | null

                          // Calculate scheduled time
                          const scheduledAt = new Date(enrolledAt.getTime() + delayMin * 60 * 1000)
                          const now = new Date()
                          const isPast = scheduledAt < now
                          const isUpcoming = !isDone && scheduledAt > now

                          // Format delay as human-readable
                          let delayLabel = ""
                          if (delayMin < 60) delayLabel = `${delayMin}m`
                          else if (delayMin < 1440) delayLabel = `${Math.round(delayMin / 60)}h`
                          else delayLabel = `Day ${Math.round(delayMin / 1440)}`

                          // Channel icon + label
                          const channelConfig: Record<string, { icon: string; label: string; color: string }> = {
                            auto_sms: { icon: "💬", label: "Auto SMS", color: "text-blue-600" },
                            auto_call: { icon: "📞", label: "Riley Call", color: "text-green-600" },
                            manual_call: { icon: "☎️", label: "Manual Call", color: "text-purple-600" },
                            auto_email: { icon: "📧", label: "Auto Email", color: "text-indigo-600" },
                          }
                          const ch = channelConfig[channel] || { icon: "•", label: channel, color: "text-gray-500" }

                          return (
                            <div key={stepNum} className="flex gap-3 mb-0.5">
                              {/* Vertical line + dot */}
                              <div className="flex flex-col items-center w-6">
                                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                                  isDone ? "bg-green-100 text-green-600" :
                                  isCurrent ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300" :
                                  "bg-gray-100 text-gray-400"
                                }`}>
                                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNum}
                                </div>
                                {idx < steps.length - 1 && (
                                  <div className={`w-px flex-1 min-h-[24px] ${isDone ? "bg-green-200" : "bg-gray-200"}`} />
                                )}
                              </div>

                              {/* Step content */}
                              <div className={`flex-1 pb-3 ${isDone ? "opacity-60" : ""}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{ch.icon}</span>
                                    <span className={`text-sm font-medium ${isCurrent ? ch.color : "text-gray-700"}`}>
                                      {ch.label}
                                    </span>
                                    <span className="text-xs text-gray-400">{delayLabel}</span>
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {isDone ? (
                                      <span className="text-green-500">Sent</span>
                                    ) : isCurrent ? (
                                      <span className="font-medium text-blue-600">
                                        {isPast ? "Due now" : scheduledAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + scheduledAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    ) : (
                                      <span>
                                        {scheduledAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Show template preview for SMS steps */}
                                {template && (channel === "auto_sms" || channel === "auto_email") && (
                                  <p className={`text-xs mt-1 leading-relaxed ${isCurrent ? "text-gray-600" : "text-gray-400"} line-clamp-2`}>
                                    {template.name || template.slug}
                                    {isCurrent && template.body && (
                                      <span className="block text-gray-400 mt-0.5 italic">
                                        &ldquo;{(template.body as string).slice(0, 120)}...&rdquo;
                                      </span>
                                    )}
                                  </p>
                                )}
                                {channel === "auto_call" && (
                                  <p className={`text-xs mt-0.5 ${isCurrent ? "text-gray-500" : "text-gray-400"}`}>
                                    Riley re-qualification call
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {steps.length === 0 && (
                          <p className="text-sm text-gray-400">No steps configured for this sequence</p>
                        )}
                      </div>
                    </div>
                  )
                })}
                </div>
              )}
            </div>
          )}

          {/* ═══ NOTES TAB ═══ */}
          {activeTab === "notes" && (
            <div className="rounded-b-xl border border-t-0 bg-white p-4 space-y-4" style={{ minHeight: "500px" }}>
              {/* Add note */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                  placeholder="Type a note..."
                  className="flex-1 rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={addNote}
                  disabled={saving || !newNote.trim()}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Notes list */}
              <div className="space-y-3">
                {notes.length === 0 && <p className="text-sm text-gray-400">No notes yet.</p>}
                {notes.map((n) => (
                  <div key={n.id as string} className="rounded-lg bg-gray-50 p-3">
                    <p className="text-sm text-gray-800">{n.content as string}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {n.author as string} — {new Date(n.created_at as string).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Contact info + Lender Match + Conditions + Tasks */}
        <div className="space-y-6">
          {/* Contact card */}
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Contact Info</h3>
              {!editingContact ? (
                <button
                  onClick={startEditContact}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 transition"
                >
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEditContact}
                    disabled={savingContact}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveContact}
                    disabled={savingContact}
                    className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded px-2.5 py-1 transition disabled:opacity-50"
                  >
                    {savingContact ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
            {editingContact && contactError && (
              <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {contactError}
              </div>
            )}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                {editingContact ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="First"
                      className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="Last"
                      className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                ) : (
                  <span>{lead.first_name as string} {lead.last_name as string}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                {editingContact ? (
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Phone"
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone as string}</a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                {editingContact ? (
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email"
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline break-all">{lead.email as string}</a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span>{loanType}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>{new Date(lead.created_at as string).toLocaleString()}</span>
              </div>
              {lead.source ? (
                <div className="text-xs text-gray-400">
                  Source: {String(lead.source)}
                  {lead.utm_campaign ? ` / ${String(lead.utm_campaign)}` : ""}
                </div>
              ) : null}
            </div>
          </div>

          {/* Application Status */}
          {application && (
            <div className="rounded-xl border bg-white p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-500" />
                Loan Application
              </h3>
              <div className="space-y-3">
                {/* App number + status badge */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-mono">{application.application_number}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    application.status === "draft" ? "bg-gray-100 text-gray-700" :
                    application.status === "submitted" ? "bg-blue-100 text-blue-700" :
                    application.status === "under_review" ? "bg-yellow-100 text-yellow-700" :
                    application.status === "approved" ? "bg-green-100 text-green-700" :
                    application.status === "funded" ? "bg-emerald-100 text-emerald-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {application.status.replace("_", " ")}
                  </span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {application.loan_type && (
                    <div className="rounded bg-gray-50 p-2">
                      <span className="text-gray-400">Type</span>
                      <p className="font-medium text-gray-700">{application.loan_type}</p>
                    </div>
                  )}
                  {application.loan_amount && (
                    <div className="rounded bg-gray-50 p-2">
                      <span className="text-gray-400">Amount</span>
                      <p className="font-medium text-gray-700">${application.loan_amount.toLocaleString()}</p>
                    </div>
                  )}
                  {application.credit_score_range && (
                    <div className="rounded bg-gray-50 p-2">
                      <span className="text-gray-400">Credit</span>
                      <p className="font-medium text-gray-700">{application.credit_score_range}</p>
                    </div>
                  )}
                  {application.property_address && (
                    <div className="rounded bg-gray-50 p-2 col-span-2">
                      <span className="text-gray-400">Property</span>
                      <p className="font-medium text-gray-700">{application.property_address}</p>
                    </div>
                  )}
                  {/* Estimated Value from Zillow */}
                  {application.property_address && (
                    <div className="rounded bg-gray-50 p-2 col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Est. Value</span>
                        {!valuation && !fetchingValuation && (
                          <button
                            onClick={() => fetchValuation(application.property_address!)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Get Estimate
                          </button>
                        )}
                      </div>
                      {fetchingValuation && (
                        <p className="text-xs text-gray-400 mt-1">Looking up on Zillow...</p>
                      )}
                      {valuation && (
                        <div className="mt-1">
                          <p className="font-bold text-green-700 text-lg">${valuation.estimatedValue.toLocaleString()}</p>
                          <div className="flex gap-3 text-gray-500 mt-0.5">
                            {valuation.sqft > 0 && <span>{valuation.sqft.toLocaleString()} sqft</span>}
                            {valuation.bedrooms > 0 && <span>{valuation.bedrooms}bd</span>}
                            {valuation.bathrooms > 0 && <span>{valuation.bathrooms}ba</span>}
                            {valuation.yearBuilt > 0 && <span>Built {valuation.yearBuilt}</span>}
                          </div>
                          {valuation.lastSoldPrice > 0 && (
                            <p className="text-gray-400 mt-0.5">Last sold: ${valuation.lastSoldPrice.toLocaleString()} ({valuation.lastSoldDate})</p>
                          )}
                          <p className="text-gray-300 mt-0.5">via Zillow</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Timestamps */}
                <div className="space-y-1.5 text-xs">
                  {application.first_opened_at && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-gray-600">Opened: {new Date(application.first_opened_at).toLocaleString()}</span>
                    </div>
                  )}
                  {!application.first_opened_at && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-400">Not opened yet</span>
                    </div>
                  )}
                  {application.submitted_at && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-gray-600">Submitted: {new Date(application.submitted_at).toLocaleString()}</span>
                    </div>
                  )}
                  {emailEvents.some((e) => e.event_type === "email.opened") && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-purple-500" />
                      <span className="text-gray-600">App email opened</span>
                    </div>
                  )}
                </div>

                {/* Open application link */}
                {application.guest_token && (
                  <a
                    href={`https://premerealestate.com/apply?guest=1&token=${application.guest_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 transition w-full justify-center"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Application
                  </a>
                )}

                {/* Email Events Timeline */}
                {emailEvents.length > 0 && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Email Activity</p>
                    <div className="space-y-1.5">
                      {emailEvents.map((ev) => {
                        const evType = ev.event_type.replace("email.", "")
                        const icon = evType === "sent" ? "text-gray-400" :
                          evType === "delivered" ? "text-blue-400" :
                          evType === "opened" ? "text-green-500" :
                          evType === "clicked" ? "text-purple-500" :
                          evType === "bounced" ? "text-red-500" : "text-gray-400"
                        return (
                          <div key={ev.id} className="flex items-center gap-2 text-xs">
                            <div className={`h-1.5 w-1.5 rounded-full ${icon.replace("text-", "bg-")}`} />
                            <span className={`font-medium ${icon}`}>{evType}</span>
                            {ev.subject && <span className="text-gray-400 truncate">{ev.subject}</span>}
                            <span className="text-gray-300 ml-auto shrink-0">
                              {new Date(ev.event_timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DSCR Lender Match */}
          {condData?.lenderMatch && (
            <div className="rounded-xl border bg-white p-4">
              <button
                onClick={() => setShowLenderDetail(!showLenderDetail)}
                className="flex w-full items-center justify-between"
              >
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-500" />
                  Lender Match
                  {condData.lenderMatch.matches.length > 0 && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {condData.lenderMatch.matches.filter((m) => m.qualified).length} qualified
                    </span>
                  )}
                </h3>
                {showLenderDetail ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>

              {/* Borrower data summary */}
              {condData.lenderMatch.application && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {condData.lenderMatch.application.credit_score_range ? (
                    <div className="rounded bg-gray-50 p-2">
                      <span className="text-gray-400">Credit</span>
                      <p className="font-medium">{condData.lenderMatch.application.credit_score_range}</p>
                    </div>
                  ) : null}
                  {condData.lenderMatch.application.loan_amount ? (
                    <div className="rounded bg-gray-50 p-2">
                      <span className="text-gray-400">Loan</span>
                      <p className="font-medium">${condData.lenderMatch.application.loan_amount.toLocaleString()}</p>
                    </div>
                  ) : null}
                  {condData.lenderMatch.application.property_value ? (
                    <div className="rounded bg-gray-50 p-2">
                      <span className="text-gray-400">Property</span>
                      <p className="font-medium">${condData.lenderMatch.application.property_value.toLocaleString()}</p>
                    </div>
                  ) : null}
                  {condData.lenderMatch.application.loan_type ? (
                    <div className="rounded bg-gray-50 p-2">
                      <span className="text-gray-400">Type</span>
                      <p className="font-medium">{condData.lenderMatch.application.loan_type}</p>
                    </div>
                  ) : null}
                </div>
              )}

              {showLenderDetail && (
                <div className="mt-3 space-y-2">
                  {condData.lenderMatch.matches.length === 0 ? (
                    <p className="text-xs text-gray-400">No lender programs found for this loan type.</p>
                  ) : (
                    condData.lenderMatch.matches.map((m) => (
                      <div
                        key={m.lender.id}
                        className={`rounded-lg border p-3 text-xs ${
                          m.qualified ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50 opacity-70"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{m.lender.name}</p>
                            <p className="text-gray-500">{m.lender.short_name}</p>
                          </div>
                          {m.qualified ? (
                            <Shield className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-gray-500">
                          <span>DSCR {"\u2265"} {m.lender.min_dscr}</span>
                          <span>FICO {"\u2265"} {m.lender.min_fico}</span>
                          <span>Loan ${m.lender.min_loan.toLocaleString()}+</span>
                          {m.lender.max_loan && <span>Max ${m.lender.max_loan.toLocaleString()}</span>}
                          {m.lender.max_term && <span>{m.lender.max_term}</span>}
                        </div>
                        {m.reasons.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {m.reasons.map((r, i) => (
                              <p key={i} className="text-red-500 text-xs">{r}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Conditions Tracker */}
          <div className="rounded-xl border bg-white p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Conditions & Documents
            </h3>

            {/* Progress bar */}
            {condData && condData.progress.total > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>{condData.progress.received} of {condData.progress.total} received</span>
                  <span>{condData.progress.approved} approved</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${condData.progress.total > 0 ? (condData.progress.received / condData.progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Conditions list */}
            <div className="space-y-2 mb-3">
              {condData?.conditions.length === 0 && (
                <p className="text-xs text-gray-400">No conditions added yet.</p>
              )}
              {condData?.conditions.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2.5 text-sm">
                  <button
                    onClick={() => {
                      const next = c.status === "outstanding" ? "submitted" : c.status === "submitted" ? "approved" : c.status
                      if (next !== c.status) updateCondStatus(c.id, next)
                    }}
                    className={`shrink-0 ${
                      c.status === "approved" ? "text-green-500" :
                      c.status === "submitted" ? "text-blue-500" :
                      c.status === "waived" ? "text-gray-400" :
                      "text-gray-300 hover:text-blue-400"
                    } transition`}
                    title={`Status: ${c.status}. Click to advance.`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs ${c.status === "approved" || c.status === "waived" ? "line-through text-gray-400" : "text-gray-700"}`}>
                      {c.title}
                    </span>
                  </div>
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${
                    c.status === "outstanding" ? "bg-orange-100 text-orange-600" :
                    c.status === "submitted" ? "bg-blue-100 text-blue-600" :
                    c.status === "approved" ? "bg-green-100 text-green-600" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {c.status}
                  </span>
                  <button onClick={() => deleteCond(c.id)} className="shrink-0 text-gray-300 hover:text-red-400 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add condition */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newCondLabel}
                onChange={(e) => setNewCondLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addConditionItem(newCondLabel)}
                placeholder="Add condition..."
                className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => addConditionItem(newCondLabel)}
                disabled={addingCond || !newCondLabel.trim()}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Quick-add templates */}
            <div className="mb-3">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {showTemplates ? "Hide templates" : "+ Add from template"}
              </button>
              {showTemplates && condData?.templates && (
                <div className="mt-2 space-y-1">
                  {Object.entries(condData.templates).map(([key, labels]) => (
                    <button
                      key={key}
                      onClick={() => addConditionBatch(labels)}
                      className="block w-full text-left rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 hover:bg-blue-100 transition"
                    >
                      <span className="font-medium">{key.toUpperCase()}</span>
                      <span className="text-blue-400 ml-2">({labels.length} items)</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send email / Portal link */}
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <button
                onClick={sendConditionsEmail}
                disabled={sendingEmail || !condData?.conditions.some((c) => c.status === "outstanding")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                <Mail className="h-3.5 w-3.5" />
                {sendingEmail ? "Sending..." : "Email Request"}
              </button>
              {portalUrl && (
                <button
                  onClick={() => { navigator.clipboard.writeText(portalUrl) }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition"
                  title={portalUrl}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy Portal Link
                </button>
              )}
            </div>
          </div>

          {/* Tasks */}
          <div className="rounded-xl border bg-white p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Tasks</h3>
            <div className="space-y-2">
              {tasks.filter((t) => t.status === "pending" || t.status === "overdue").length === 0 ? (
                <p className="text-sm text-gray-400">No pending tasks.</p>
              ) : null}
              {tasks
                .filter((t) => t.status === "pending" || t.status === "overdue")
                .map((task) => (
                  <div key={String(task.id)} className="flex items-start gap-2 rounded-lg bg-gray-50 p-3">
                    <button
                      onClick={() => completeTask(String(task.id))}
                      className="mt-0.5 text-gray-400 hover:text-green-600 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{String(task.title)}</p>
                      {task.description ? (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{String(task.description)}</p>
                      ) : null}
                      <p className="text-xs text-gray-400 mt-1">
                        Due: {new Date(String(task.due_at)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Retell Summary */}
          {lead.retell_summary ? (
            <div className="rounded-xl border bg-white p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Riley Call Summary</h3>
              <p className="text-sm text-gray-600 italic">{String(lead.retell_summary)}</p>
            </div>
          ) : null}

          {/* Qualification Data */}
          {lead.qualification_data && Object.keys(lead.qualification_data as object).length > 0 ? (
            <div className="rounded-xl border bg-white p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Qualification Data</h3>
              <div className="space-y-1 text-sm text-gray-600">
                {Object.entries(lead.qualification_data as Record<string, unknown>).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400">{k.replace(/_/g, " ")}</span>
                    <span>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Timeline Builder ───

interface TimelineEntry {
  type: "event" | "note" | "task" | "sms" | "call"
  icon: "phone" | "sms" | "note" | "status" | "task" | "system"
  title: string
  description: string
  timestamp: string
  meta?: Record<string, unknown>
}

function buildTimeline(
  events: Record<string, unknown>[],
  notes: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
  interactions: Record<string, unknown>[],
): TimelineEntry[] {
  const items: TimelineEntry[] = []

  // Events
  for (const e of events) {
    const eventType = e.event_type as string
    const data = (e.event_data || {}) as Record<string, unknown>
    let title = eventType.replace(/_/g, " ")
    let icon: TimelineEntry["icon"] = "system"

    if (eventType === "created") { title = "Lead captured"; icon = "system" }
    else if (eventType === "call_started") { title = "Riley call started"; icon = "phone" }
    else if (eventType === "call_ended") { title = `Riley call ended (${data.disconnection_reason || "completed"})`; icon = "phone" }
    else if (eventType === "call_analyzed") { title = `Riley qualified: ${data.qualified ? "YES" : "No"}`; icon = "phone" }
    else if (eventType === "retell_call_initiated") { title = "Riley call initiated"; icon = "phone" }
    else if (eventType === "retell_call_failed") { title = "Riley call failed"; icon = "phone" }
    else if (eventType === "sequence_sms_sent") { title = `Auto SMS sent (Step ${data.step_number})`; icon = "sms" }
    else if (eventType === "sequence_task_created") { title = `Call task created (Step ${data.step_number})`; icon = "task" }
    else if (eventType === "status_changed") { title = `Status → ${data.new_status}`; icon = "status" }
    else if (eventType === "handoff_attempted") { title = `Handoff ${data.success ? "sent" : "failed"}`; icon = "system" }

    items.push({ type: "event", icon, title, description: "", timestamp: e.created_at as string, meta: data })
  }

  // Notes
  for (const n of notes) {
    items.push({
      type: "note",
      icon: "note",
      title: "Note",
      description: n.content as string,
      timestamp: n.created_at as string,
    })
  }

  // Tasks
  for (const t of tasks) {
    items.push({
      type: "task",
      icon: "task",
      title: t.title as string,
      description: `${t.status as string} — ${t.description || ""}`,
      timestamp: t.due_at as string,
      meta: { task_id: t.id, status: t.status },
    })
  }

  // SMS/Call interactions
  for (const i of interactions) {
    const channel = i.channel as string
    const direction = i.direction as string
    items.push({
      type: channel === "sms" ? "sms" : "call",
      icon: channel === "sms" ? "sms" : "phone",
      title: `${direction === "inbound" ? "Received" : "Sent"} ${channel.toUpperCase()}`,
      description: (i.content as string)?.slice(0, 200) || "",
      timestamp: i.created_at as string,
    })
  }

  // Sort by timestamp descending
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return items
}

// ─── Timeline Item Component ───

function TimelineItem({
  item,
  onCompleteTask,
}: {
  item: TimelineEntry
  onCompleteTask: (id: string) => void
}) {
  const iconMap = {
    phone: <Phone className="h-4 w-4" />,
    sms: <MessageSquare className="h-4 w-4" />,
    note: <FileText className="h-4 w-4" />,
    status: <AlertCircle className="h-4 w-4" />,
    task: <CheckCircle2 className="h-4 w-4" />,
    system: <Clock className="h-4 w-4" />,
  }

  const colorMap = {
    phone: "bg-green-50 text-green-600",
    sms: "bg-blue-50 text-blue-600",
    note: "bg-yellow-50 text-yellow-600",
    status: "bg-purple-50 text-purple-600",
    task: "bg-orange-50 text-orange-600",
    system: "bg-gray-50 text-gray-600",
  }

  const isCompletableTask = item.type === "task" && item.meta?.status === "pending"

  return (
    <div className="flex gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorMap[item.icon]}`}>
        {iconMap[item.icon]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{item.title}</p>
          {isCompletableTask && (
            <button
              onClick={() => onCompleteTask(item.meta?.task_id as string)}
              className="text-xs text-green-600 hover:text-green-700 underline"
            >
              Complete
            </button>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 text-sm text-gray-500">{item.description}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          {new Date(item.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  )
}
