"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { SendApplicationModal } from "@/components/lead-portal/send-application-modal"
import { CallButton } from "@/components/lead-portal/call-button"
import { SmsThread } from "@/components/lead-portal/sms-thread"
import {
  Phone,
  Mail,
  MessageSquare,
  UserPlus,
  Flame,
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
  type: string
  direction: string
  summary: string | null
  created_at: string
  recording_url: string | null
  transcript: string | null
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

export function LeadDetail({
  leadId,
  onClose,
  onStatusChange,
  onConvert,
  onDelete,
  initialTab = "messages",
}: LeadDetailProps) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
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

  const fetchLead = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${leadId}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to fetch lead")
      setLead(data.lead)
      setInteractions(data.interactions || [])
      // Load notes from qualification_data
      if (data.lead?.qualification_data?.notes) {
        setNotes(data.lead.qualification_data.notes)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch lead")
    } finally {
      setIsLoading(false)
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
      // Non-critical — ignore
    } finally {
      setAppStatusLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchLead()
    fetchAppStatus()
    return () => {
      // Cleanup audio on unmount
      if (audioRef) {
        audioRef.pause()
        audioRef.src = ""
      }
    }
  }, [fetchLead, fetchAppStatus])

  const handlePlayRecording = (url: string) => {
    if (audioRef) {
      if (isPlaying) {
        audioRef.pause()
        setIsPlaying(false)
        return
      }
    }
    const audio = new Audio(url)
    audio.addEventListener("ended", () => setIsPlaying(false))
    audio.play()
    setIsPlaying(true)
    setAudioRef(audio)
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

          {/* Call Button — prominent */}
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

          {/* Tabbed Section: Messages | Activity */}
          <Tabs defaultValue={initialTab} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="messages" className="flex-1">
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex-1">
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Activity
              </TabsTrigger>
            </TabsList>

            {/* Messages Tab */}
            <TabsContent value="messages">
              {lead.phone ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  <SmsThread
                    leadId={lead.id}
                    phone={lead.phone}
                    firstName={lead.first_name}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No phone number on file. Cannot send SMS.</p>
                </div>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              {/* Lead Message */}
              {lead.message && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Lead Message
                    </p>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{lead.message}</p>
                </div>
              )}

              {/* Call Summary */}
              {lead.call_summary && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Call Summary
                    </p>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{lead.call_summary}</p>
                </div>
              )}

              {/* Call Recording */}
              {lead.call_recording_url && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Call Recording
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-foreground hover:bg-muted bg-transparent h-8"
                      onClick={() => handlePlayRecording(lead.call_recording_url!)}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="h-3.5 w-3.5 mr-1.5" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 mr-1.5" /> Play
                        </>
                      )}
                    </Button>
                  </div>
                  <audio
                    controls
                    className="w-full mt-2"
                    src={lead.call_recording_url}
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {/* Call Transcript */}
              {lead.call_transcript && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Call Transcript
                    </p>
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap max-h-64 overflow-y-auto rounded bg-background p-3 border border-border">
                    {lead.call_transcript}
                  </div>
                </div>
              )}

              {/* Interactions Timeline */}
              {interactions.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Interaction History
                    </p>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {interactions.map((interaction) => (
                      <div
                        key={interaction.id}
                        className="flex items-start gap-3 p-2 rounded bg-background border border-border"
                      >
                        <div className="shrink-0 mt-0.5">
                          {interaction.type === "call" ? (
                            <Phone className="h-3.5 w-3.5 text-[#997100]" />
                          ) : interaction.type === "sms" ? (
                            <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                          ) : (
                            <Mail className="h-3.5 w-3.5 text-purple-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground capitalize">
                              {interaction.type}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {interaction.direction}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {formatDate(interaction.created_at)}
                            </span>
                          </div>
                          {interaction.summary && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {interaction.summary}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

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
                {/* Status badges */}
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

                {/* Progress bar */}
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

                {/* Resend button */}
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
