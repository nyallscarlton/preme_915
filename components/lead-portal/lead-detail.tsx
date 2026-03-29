"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { SendApplicationModal } from "@/components/lead-portal/send-application-modal"
import { CallButton } from "@/components/lead-portal/call-button"
import {
  Phone,
  Mail,
  MessageSquare,
  UserPlus,
  Clock,
  Loader2,
  ExternalLink,
  Trash2,
  Play,
  Pause,
  FileText,
  Globe,
  Tag,
  DollarSign,
  Calendar,
  X,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronRight,
  Home,
  Search,
} from "lucide-react"

interface Lead {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  loan_type: string | null
  loan_amount: number | null
  message: string | null
  source: string | null
  status: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  retell_call_id: string | null
  call_transcript: string | null
  call_recording_url: string | null
  call_summary: string | null
  qualification_data: Record<string, any> | null
  created_at: string
  updated_at: string | null
}

interface Interaction {
  id: string
  phone?: string
  channel: string
  direction: string
  content: string | null
  summary: string | null
  metadata: Record<string, any> | null
  created_at: string
  // Legacy fields (kept for backward compat)
  type?: string
  recording_url?: string | null
  transcript?: string | null
}

interface LeadMessage {
  id: string
  lead_id: string
  direction: "inbound" | "outbound"
  type?: "sms" | "call"
  body: string
  from_number: string
  to_number: string
  twilio_sid: string | null
  status: string
  metadata?: {
    call_id?: string
    status?: string
    duration_ms?: number
    duration_str?: string
    recording_url?: string
    transcript?: string
    disconnection_reason?: string
  } | null
  created_at: string
}

// Unified thread item — merges SMS, calls from lead_messages + interactions
interface ThreadItem {
  id: string
  timestamp: string
  channel: "sms" | "voice" | "email" | "call_review" | "form"
  direction: "inbound" | "outbound"
  // SMS fields
  body?: string
  smsStatus?: string
  // Call fields
  callSummary?: string
  recordingUrl?: string | null
  transcript?: string | null
  durationMs?: number
  durationStr?: string
  callStatus?: string
  callType?: string
  // Email fields
  subject?: string
  emailStatus?: string
  // Who did it
  actor: string
  // Temperature from call analysis
  temperature?: string
}

interface ValuationData {
  estimatedValue: number
  sqft: number
  bedrooms: number
  bathrooms: number
  yearBuilt: number
  lastSoldPrice: number
  lastSoldDate: string
}

interface LeadDetailProps {
  leadId: string
  onClose: () => void
  onStatusChange: (leadId: string, status: string) => Promise<void>
  onConvert: (leadId: string) => Promise<void>
  onDelete: (leadId: string) => Promise<void>
  initialTab?: string
}

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-600 text-white" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-600 text-black" },
  { value: "qualified", label: "Qualified", color: "bg-emerald-600 text-white" },
  { value: "nurturing", label: "Nurturing", color: "bg-purple-600 text-white" },
  { value: "converted", label: "Converted", color: "bg-green-600 text-white" },
  { value: "dead", label: "Dead", color: "bg-gray-600 text-white" },
] as const

function formatPhone(phone: string | null): string {
  if (!phone) return "-"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  )
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  if (diffDays === 0) return `Today ${time}`
  if (diffDays === 1) return `Yesterday ${time}`
  if (diffDays < 7) {
    return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${time}`
  }
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

/** Determine the recording URL, proxying Twilio URLs through our endpoint */
function getRecordingUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.includes("api.twilio.com")) {
    return `/api/admin/recording?url=${encodeURIComponent(url)}`
  }
  return url
}

/** Determine who performed this interaction */
function resolveActor(
  item: { direction: string; channel: string; metadata?: Record<string, any> | null; callType?: string },
  leadFirstName: string
): string {
  if (item.direction === "inbound") return leadFirstName || "Lead"
  // Check metadata for clues
  const meta = item.metadata || {}
  if (meta.is_training) return "Riley (Training)"
  if (meta.call_type === "sequence" || meta.call_type === "auto") return "Riley (Auto)"
  if (meta.call_type === "manual" || meta.call_type === "bridge") return "Nyalls"
  // Default outbound
  if (item.channel === "voice") return "Riley"
  if (item.channel === "sms") return "Riley"
  if (item.channel === "email") return "System"
  return "System"
}

export function LeadDetail({
  leadId,
  onClose,
  onStatusChange,
  onConvert,
  onDelete,
}: LeadDetailProps) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [messages, setMessages] = useState<LeadMessage[]>([])
  const [threadItems, setThreadItems] = useState<ThreadItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
  const [notes, setNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const [showSendApp, setShowSendApp] = useState(false)
  const [appStatus, setAppStatus] = useState<{
    has_application: boolean
    application_number?: string
    status?: string
    sent_via?: string
    sent_at?: string
    opened?: boolean
    first_opened_at?: string
    progress?: number
    submitted?: boolean
    guest_token?: string
    application_id?: string
  } | null>(null)
  const [appStatusLoading, setAppStatusLoading] = useState(false)
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set())
  const [lenderMatchOpen, setLenderMatchOpen] = useState(false)

  // SMS draft
  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Valuation
  const [valuation, setValuation] = useState<ValuationData | null>(null)
  const [valuationLoading, setValuationLoading] = useState(false)
  const [valuationError, setValuationError] = useState<string | null>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  const fetchLead = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${leadId}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to fetch lead")
      setLead(data.lead)
      setInteractions(data.interactions || [])
      if (data.lead?.qualification_data?.notes) {
        setNotes(data.lead.qualification_data.notes)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch lead")
    } finally {
      setIsLoading(false)
    }
  }, [leadId])

  const fetchMessages = useCallback(async (showLoading = false) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/messages`)
      const data = await res.json()
      if (data.success) {
        setMessages(data.messages || [])
      }
    } catch {
      // Non-critical
    }
  }, [leadId])

  const fetchAppStatus = useCallback(async () => {
    setAppStatusLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/application-status`)
      const data = await res.json()
      if (res.ok && data.success) {
        setAppStatus(data)
      }
    } catch {
      // Non-critical
    } finally {
      setAppStatusLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchLead()
    fetchMessages(true)
    fetchAppStatus()
    return () => {
      if (audioRef) {
        audioRef.pause()
        audioRef.src = ""
      }
    }
  }, [fetchLead, fetchMessages, fetchAppStatus])

  // Poll messages every 10s
  useEffect(() => {
    pollRef.current = setInterval(() => fetchMessages(false), 10000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchMessages])

  // Build unified thread from messages + interactions
  useEffect(() => {
    if (!lead) return

    const items: ThreadItem[] = []
    const seenIds = new Set<string>()

    // Add lead_messages (SMS and calls from the messages table)
    for (const msg of messages) {
      if (seenIds.has(msg.id)) continue
      seenIds.add(msg.id)

      if (msg.type === "call") {
        const meta = msg.metadata
        items.push({
          id: msg.id,
          timestamp: msg.created_at,
          channel: "voice",
          direction: msg.direction,
          body: msg.body,
          callSummary: undefined,
          recordingUrl: meta?.recording_url || null,
          transcript: meta?.transcript || null,
          durationMs: meta?.duration_ms,
          durationStr: meta?.duration_str,
          callStatus: meta?.status,
          actor: resolveActor(
            { direction: msg.direction, channel: "voice", metadata: meta },
            lead.first_name
          ),
        })
      } else {
        items.push({
          id: msg.id,
          timestamp: msg.created_at,
          channel: "sms",
          direction: msg.direction,
          body: msg.body,
          smsStatus: msg.status,
          actor: resolveActor(
            { direction: msg.direction, channel: "sms" },
            lead.first_name
          ),
        })
      }
    }

    // Add interactions from zx_contact_interactions (may have calls, emails, etc.)
    for (const ix of interactions) {
      if (seenIds.has(ix.id)) continue
      seenIds.add(ix.id)

      const channel = (ix.channel || ix.type || "voice") as ThreadItem["channel"]
      if (channel === "call_review" || channel === "form") continue // Skip review entries

      const meta = ix.metadata || {}
      items.push({
        id: ix.id,
        timestamp: ix.created_at,
        channel: channel === "voice" || channel === ("call" as string) ? "voice" : channel as ThreadItem["channel"],
        direction: ix.direction as "inbound" | "outbound",
        body: channel === "sms" ? (ix.content || undefined) : undefined,
        callSummary: channel === "voice" || channel === ("call" as string) ? (ix.summary || undefined) : undefined,
        recordingUrl: meta.recording_url || ix.recording_url || null,
        transcript: ix.content || ix.transcript || null,
        durationMs: meta.duration_ms,
        callStatus: meta.status,
        callType: meta.call_type,
        temperature: meta.temperature,
        subject: channel === "email" ? (ix.summary || undefined) : undefined,
        emailStatus: channel === "email" ? (meta.status || undefined) : undefined,
        actor: resolveActor(
          { direction: ix.direction, channel, metadata: meta },
          lead.first_name
        ),
      })
    }

    // Sort chronologically ascending
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    setThreadItems(items)
  }, [messages, interactions, lead])

  // Auto-scroll thread when items change
  useEffect(() => {
    scrollToBottom()
  }, [threadItems, scrollToBottom])

  const handlePlayRecording = (itemId: string, url: string) => {
    if (audioRef) {
      audioRef.pause()
      audioRef.src = ""
    }
    if (playingId === itemId) {
      setPlayingId(null)
      setAudioRef(null)
      return
    }
    const proxiedUrl = getRecordingUrl(url) || url
    const audio = new Audio(proxiedUrl)
    audio.addEventListener("ended", () => {
      setPlayingId(null)
      setAudioRef(null)
    })
    audio.play()
    setPlayingId(itemId)
    setAudioRef(audio)
  }

  const toggleTranscript = (id: string) => {
    setExpandedTranscripts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSaveNotes = async () => {
    if (!lead) return
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualification_data: {
            ...(lead.qualification_data || {}),
            notes,
            notes_updated_at: new Date().toISOString(),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error)
      setLead(data.lead)
    } catch (err) {
      console.error("Failed to save notes:", err)
    } finally {
      setSavingNotes(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    await onStatusChange(leadId, newStatus)
    if (lead) {
      setLead({ ...lead, status: newStatus, updated_at: new Date().toISOString() })
    }
  }

  const handleSendSms = async () => {
    const body = draft.trim()
    if (!body || isSending || !lead?.phone) return

    setIsSending(true)
    setDraft("")
    setSendError(null)

    // Optimistic update
    const optimistic: LeadMessage = {
      id: `temp-${Date.now()}`,
      lead_id: leadId,
      direction: "outbound",
      body,
      from_number: "+14709425787",
      to_number: lead.phone,
      twilio_sid: null,
      status: "sending",
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch(`/api/leads/${leadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to send")
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? data.message : m))
      )
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, status: "failed" } : m
        )
      )
      setSendError(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendSms()
    }
  }

  const handleGetValuation = async () => {
    if (!lead) return
    const addr =
      lead.qualification_data?.property_address ||
      lead.qualification_data?.address ||
      null
    if (!addr) return

    setValuationLoading(true)
    setValuationError(null)
    try {
      const res = await fetch("/api/admin/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "No data found")
      setValuation({
        estimatedValue: data.estimatedValue,
        sqft: data.sqft,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        yearBuilt: data.yearBuilt,
        lastSoldPrice: data.lastSoldPrice,
        lastSoldDate: data.lastSoldDate,
      })
    } catch (err) {
      setValuationError(err instanceof Error ? err.message : "Valuation failed")
    } finally {
      setValuationLoading(false)
    }
  }

  if (!lead && isLoading) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (error || !lead) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>{error || "Lead not found"}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const statusOpt = STATUS_OPTIONS.find((s) => s.value === lead.status) || {
    value: lead.status,
    label: lead.status,
    color: "bg-gray-600 text-white",
  }

  const propertyAddress =
    lead.qualification_data?.property_address ||
    lead.qualification_data?.address ||
    null

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">
                {lead.first_name} {lead.last_name}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Lead created {formatDate(lead.created_at)}
              </DialogDescription>
            </div>
            <Badge className={`${statusOpt.color} ml-4 shrink-0`}>{statusOpt.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="h-4 w-4 text-[#997100] shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="text-sm text-[#997100] hover:underline">
                    {formatPhone(lead.phone)}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Not provided</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-4 w-4 text-[#997100] shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-sm text-[#997100] hover:underline break-all"
                  >
                    {lead.email}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Not provided</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Source</p>
                <p className="text-sm text-foreground capitalize">
                  {lead.source?.replace(/_/g, " ") || "Unknown"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Loan Type / Amount</p>
                <p className="text-sm text-foreground">
                  {lead.loan_type
                    ? `${lead.loan_type.charAt(0).toUpperCase() + lead.loan_type.slice(1).replace(/_/g, " ")}`
                    : "N/A"}
                  {lead.loan_amount ? ` / $${lead.loan_amount.toLocaleString()}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* UTM Data */}
          {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Campaign Data
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {lead.utm_source && (
                  <Badge variant="outline" className="text-xs">
                    Source: {lead.utm_source}
                  </Badge>
                )}
                {lead.utm_medium && (
                  <Badge variant="outline" className="text-xs">
                    Medium: {lead.utm_medium}
                  </Badge>
                )}
                {lead.utm_campaign && (
                  <Badge variant="outline" className="text-xs">
                    Campaign: {lead.utm_campaign}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Call Button */}
          {lead.phone && (
            <div className="flex items-center gap-3">
              <CallButton
                leadId={lead.id}
                phone={lead.phone}
                firstName={lead.first_name}
                lastName={lead.last_name}
                loanType={lead.loan_type || undefined}
              />
            </div>
          )}

          {/* Zillow Valuation */}
          {propertyAddress && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Property
                    </p>
                    <p className="text-sm text-foreground">{propertyAddress}</p>
                  </div>
                </div>
                {!valuation && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border text-foreground hover:bg-muted bg-transparent h-7 text-xs"
                    onClick={handleGetValuation}
                    disabled={valuationLoading}
                  >
                    {valuationLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Search className="h-3 w-3 mr-1" />
                    )}
                    Get Estimate
                  </Button>
                )}
              </div>

              {valuationError && (
                <p className="text-xs text-red-400 mt-1">{valuationError}</p>
              )}

              {valuation && (
                <div className="mt-3 space-y-2">
                  <p className="text-2xl font-bold text-emerald-400">
                    ${valuation.estimatedValue.toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {valuation.bedrooms > 0 && <span>{valuation.bedrooms} bed</span>}
                    {valuation.bathrooms > 0 && <span>{valuation.bathrooms} bath</span>}
                    {valuation.sqft > 0 && <span>{valuation.sqft.toLocaleString()} sqft</span>}
                    {valuation.yearBuilt > 0 && <span>Built {valuation.yearBuilt}</span>}
                    {valuation.lastSoldPrice > 0 && (
                      <span>
                        Last sold ${valuation.lastSoldPrice.toLocaleString()}
                        {valuation.lastSoldDate ? ` (${valuation.lastSoldDate})` : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">Source: Zillow Zestimate</p>
                </div>
              )}
            </div>
          )}

          {/* ====== COMMUNICATION THREAD — Front and center ====== */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#997100]" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Communication Thread
                </p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {threadItems.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  fetchMessages(false)
                  fetchLead()
                }}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>

            {/* Thread body */}
            <div
              ref={scrollRef}
              className="overflow-y-auto px-3 py-3 space-y-3"
              style={{ maxHeight: "420px" }}
            >
              {threadItems.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No interactions yet.</p>
                  {lead.phone && (
                    <p className="text-xs text-muted-foreground/70 mt-1">Send the first text below.</p>
                  )}
                </div>
              ) : (
                threadItems.map((item) => {
                  // --- SMS ---
                  if (item.channel === "sms") {
                    return (
                      <div
                        key={item.id}
                        className={`flex ${item.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                            item.direction === "outbound"
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{item.body}</p>
                          <div
                            className={`flex items-center gap-1.5 mt-1 ${
                              item.direction === "outbound" ? "justify-end" : "justify-start"
                            }`}
                          >
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 border-0 ${
                                item.direction === "outbound"
                                  ? "text-white/50 bg-white/10"
                                  : "text-muted-foreground bg-muted"
                              }`}
                            >
                              SMS
                            </Badge>
                            <span
                              className={`text-[10px] ${
                                item.direction === "outbound" ? "text-white/60" : "text-muted-foreground"
                              }`}
                            >
                              {item.actor}
                            </span>
                            <span
                              className={`text-[10px] ${
                                item.direction === "outbound" ? "text-white/50" : "text-muted-foreground/70"
                              }`}
                            >
                              {formatTime(item.timestamp)}
                            </span>
                            {item.smsStatus === "sending" && (
                              <Loader2 className="h-2.5 w-2.5 animate-spin text-white/60" />
                            )}
                            {item.smsStatus === "failed" && (
                              <span className="text-[10px] text-red-300 font-medium">Failed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // --- VOICE / CALL ---
                  if (item.channel === "voice") {
                    const hasRecording = !!item.recordingUrl
                    const isPlaying = playingId === item.id
                    const isExpanded = expandedTranscripts.has(item.id)
                    const isCompleted = item.callStatus === "completed" || item.callStatus === "ended"
                    const isNoAnswer = item.callStatus === "no_answer"

                    return (
                      <div key={item.id} className="flex justify-center">
                        <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 max-w-[95%] w-full">
                          <div className="flex items-center gap-2 mb-1">
                            <Phone
                              className={`h-3.5 w-3.5 ${
                                isCompleted
                                  ? "text-emerald-500"
                                  : isNoAnswer
                                    ? "text-red-400"
                                    : "text-[#997100]"
                              }`}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {item.direction === "inbound" ? "Inbound" : "Outbound"} Call
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0"
                            >
                              {item.actor}
                            </Badge>
                            {item.temperature && (
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ${
                                  item.temperature === "hot"
                                    ? "border-red-700 text-red-400"
                                    : item.temperature === "warm"
                                      ? "border-yellow-700 text-yellow-400"
                                      : "border-blue-700 text-blue-400"
                                }`}
                              >
                                {item.temperature}
                              </Badge>
                            )}
                          </div>

                          {/* Call summary */}
                          {item.callSummary && (
                            <p className="text-xs text-muted-foreground mt-1">{item.callSummary}</p>
                          )}
                          {item.body && !item.callSummary && (
                            <p className="text-xs text-muted-foreground mt-1">{item.body}</p>
                          )}

                          {/* Recording */}
                          {hasRecording && (
                            <div className="mt-2">
                              <audio
                                controls
                                className="w-full h-8"
                                preload="none"
                                src={getRecordingUrl(item.recordingUrl) || undefined}
                              >
                                Your browser does not support audio.
                              </audio>
                            </div>
                          )}

                          {/* Transcript toggle */}
                          {item.transcript && (
                            <div className="mt-2">
                              <button
                                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
                                onClick={() => toggleTranscript(item.id)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                {isExpanded ? "Hide transcript" : "View transcript"}
                              </button>
                              {isExpanded && (
                                <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap max-h-[200px] overflow-y-auto rounded bg-background p-2 border border-border">
                                  {item.transcript}
                                </div>
                              )}
                            </div>
                          )}

                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatTime(item.timestamp)}
                            {item.durationStr
                              ? ` · ${item.durationStr}`
                              : item.durationMs
                                ? ` · ${formatDuration(item.durationMs)}`
                                : ""}
                          </p>
                        </div>
                      </div>
                    )
                  }

                  // --- EMAIL ---
                  if (item.channel === "email") {
                    return (
                      <div key={item.id} className="flex justify-center">
                        <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 max-w-[95%] w-full">
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="h-3.5 w-3.5 text-purple-500" />
                            <span className="text-sm font-medium text-foreground">
                              {item.direction === "inbound" ? "Inbound" : "Outbound"} Email
                            </span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              {item.actor}
                            </Badge>
                            {item.emailStatus && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                {item.emailStatus}
                              </Badge>
                            )}
                          </div>
                          {item.subject && (
                            <p className="text-xs text-muted-foreground mt-1">{item.subject}</p>
                          )}
                          {item.body && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{item.body}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatTime(item.timestamp)}
                          </p>
                        </div>
                      </div>
                    )
                  }

                  // --- Fallback ---
                  return (
                    <div key={item.id} className="flex justify-center">
                      <div className="bg-muted/50 border border-border rounded-xl px-4 py-2 max-w-[95%] w-full">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-foreground capitalize">{item.channel}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {item.direction}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {formatTime(item.timestamp)}
                          </span>
                        </div>
                        {item.body && (
                          <p className="text-xs text-muted-foreground mt-1">{item.body}</p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* SMS send error */}
            {sendError && (
              <div className="px-3 py-1.5 bg-red-950/50 border-t border-red-800">
                <p className="text-xs text-red-400">{sendError}</p>
              </div>
            )}

            {/* SMS Input */}
            {lead.phone ? (
              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    placeholder={`Text ${lead.first_name}...`}
                    className="bg-background border-border min-h-[40px] max-h-[120px] resize-none text-sm"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                  />
                  <Button
                    size="sm"
                    className="bg-[#997100] hover:bg-[#b8850a] text-black h-10 px-3 shrink-0"
                    onClick={handleSendSms}
                    disabled={!draft.trim() || isSending}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t border-border px-3 py-2">
                <p className="text-xs text-muted-foreground text-center">
                  No phone number on file. Cannot send SMS.
                </p>
              </div>
            )}
          </div>

          {/* Application Tracking */}
          {appStatus?.has_application && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#997100]" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Application Tracking
                  </p>
                </div>
                <Badge className="bg-[#997100]/20 text-[#997100] border-[#997100]/30 text-[10px]">
                  {appStatus.application_number}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs border-emerald-700 text-emerald-400"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Sent via {appStatus.sent_via === "sms" ? "Text" : "Email"}
                    {appStatus.sent_at && (
                      <span className="ml-1 text-muted-foreground">
                        {formatDate(appStatus.sent_at)}
                      </span>
                    )}
                  </Badge>

                  {appStatus.opened ? (
                    <Badge
                      variant="outline"
                      className="text-xs border-blue-700 text-blue-400"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Opened
                      {appStatus.first_opened_at && (
                        <span className="ml-1 text-muted-foreground">
                          {formatDate(appStatus.first_opened_at)}
                        </span>
                      )}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs border-gray-700 text-gray-400"
                    >
                      <EyeOff className="h-3 w-3 mr-1" />
                      Not Opened Yet
                    </Badge>
                  )}

                  {appStatus.submitted && (
                    <Badge
                      variant="outline"
                      className="text-xs border-emerald-700 text-emerald-400"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Submitted
                    </Badge>
                  )}
                </div>

                {!appStatus.submitted && typeof appStatus.progress === "number" && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        Application Completion
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {appStatus.progress}%
                      </span>
                    </div>
                    <Progress value={appStatus.progress} className="h-2" />
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border text-foreground hover:bg-muted bg-transparent h-7 text-xs"
                    onClick={() => setShowSendApp(true)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Resend
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border text-foreground hover:bg-muted bg-transparent h-7 text-xs"
                    onClick={() => {
                      if (appStatus.guest_token) {
                        const url = `${window.location.origin}/apply?guest=1&token=${appStatus.guest_token}`
                        navigator.clipboard.writeText(url)
                      }
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Link
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Notes
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-border text-foreground hover:bg-muted bg-transparent h-7 text-xs"
                onClick={handleSaveNotes}
                disabled={savingNotes}
              >
                {savingNotes ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Save Notes
              </Button>
            </div>
            <Textarea
              placeholder="Add notes about this lead..."
              className="bg-background border-border min-h-[80px] text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Lender Match — Collapsed by default */}
          {lead.qualification_data && (
            <div className="rounded-lg bg-muted/50 overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-muted/70 transition-colors"
                onClick={() => setLenderMatchOpen(!lenderMatchOpen)}
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Qualification Details
                  </p>
                </div>
                {lenderMatchOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {lenderMatchOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {Object.entries(lead.qualification_data)
                    .filter(([key]) => !["notes", "notes_updated_at"].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground text-xs min-w-[120px] capitalize">
                          {key.replace(/_/g, " ")}:
                        </span>
                        <span className="text-foreground text-xs">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Status Update */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Update Status
            </p>
            <Select value={lead.status} onValueChange={handleStatusUpdate}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <div className="flex items-center gap-2">
                      <Badge className={`${s.color} text-[10px] px-1.5 py-0`}>{s.label}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            {lead.email && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-border text-foreground hover:bg-muted bg-transparent flex-1 sm:flex-none"
              >
                <a href={`mailto:${lead.email}`}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </a>
              </Button>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="border-red-800 text-red-500 hover:bg-red-950 bg-transparent flex-1 sm:flex-none"
              onClick={() => onDelete(lead.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex-1 sm:flex-none"
              onClick={() => setShowSendApp(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              {appStatus?.has_application ? "Resend Application" : "Send Application"}
            </Button>
            {lead.status !== "converted" && (
              <Button
                size="sm"
                className="bg-[#997100] hover:bg-[#b8850a] text-black font-semibold flex-1 sm:flex-none"
                onClick={() => onConvert(lead.id)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Convert to Application
              </Button>
            )}
          </div>
        </DialogFooter>

        {/* Send Application Modal */}
        {showSendApp && lead && (
          <SendApplicationModal
            lead={lead}
            open={showSendApp}
            onOpenChange={setShowSendApp}
            onSent={() => {
              fetchAppStatus()
              fetchLead()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
