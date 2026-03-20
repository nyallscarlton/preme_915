"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, RefreshCw, MessageSquare, Phone, Play } from "lucide-react"

interface Message {
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

interface SmsThreadProps {
  leadId: string
  phone: string
  firstName: string
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

export function SmsThread({ leadId, phone, firstName }: SmsThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  const fetchMessages = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/messages`)
      const data = await res.json()
      if (data.success) {
        setMessages(data.messages || [])
        setError(null)
      }
    } catch {
      if (showLoading) setError("Failed to load messages")
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [leadId])

  // Initial fetch
  useEffect(() => {
    fetchMessages(true)
  }, [fetchMessages])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Poll every 10 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => fetchMessages(false), 10000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchMessages])

  const handleSend = async () => {
    const body = draft.trim()
    if (!body || isSending) return

    setIsSending(true)
    setDraft("")

    // Optimistic update
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      lead_id: leadId,
      direction: "outbound",
      body,
      from_number: "+14709425787",
      to_number: phone,
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
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send")
      }
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? data.message : m))
      )
    } catch (err) {
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, status: "failed" } : m
        )
      )
      setError(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <p className="text-xs text-muted-foreground">
          SMS with {firstName} &middot; {phone}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => fetchMessages(false)}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Send the first text!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            // Call entry rendering
            if (msg.type === "call") {
              const meta = msg.metadata
              const hasRecording = !!meta?.recording_url
              const isCompleted = meta?.status === "completed"
              const isNoAnswer = meta?.status === "no_answer"
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 max-w-[90%] w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <Phone className={`h-3.5 w-3.5 ${isCompleted ? "text-emerald-500" : isNoAnswer ? "text-red-400" : "text-[#997100]"}`} />
                      <span className="text-sm font-medium text-foreground">{msg.body}</span>
                    </div>
                    {hasRecording && (
                      <div className="mt-2">
                        <audio controls className="w-full h-8" preload="none">
                          <source src={meta.recording_url} type="audio/wav" />
                        </audio>
                      </div>
                    )}
                    {meta?.transcript && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          View transcript
                        </summary>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                          {meta.transcript}
                        </p>
                      </details>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatTime(msg.created_at)}
                      {meta?.duration_str ? ` · ${meta.duration_str}` : ""}
                    </p>
                  </div>
                </div>
              )
            }

            // SMS rendering
            return (
              <div
                key={msg.id}
                className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                    msg.direction === "outbound"
                      ? "bg-[#997100] text-white rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {msg.body}
                  </p>
                  <div
                    className={`flex items-center gap-1.5 mt-1 ${
                      msg.direction === "outbound"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <span
                      className={`text-[10px] ${
                        msg.direction === "outbound"
                          ? "text-white/60"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(msg.created_at)}
                    </span>
                    {msg.status === "sending" && (
                      <Loader2 className="h-2.5 w-2.5 animate-spin text-white/60" />
                    )}
                    {msg.status === "failed" && (
                      <span className="text-[10px] text-red-300 font-medium">
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 bg-red-950/50 border-t border-red-800">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder={`Text ${firstName}...`}
            className="bg-background border-border min-h-[40px] max-h-[120px] resize-none text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <Button
            size="sm"
            className="bg-[#997100] hover:bg-[#b8850a] text-black h-10 px-3 shrink-0"
            onClick={handleSend}
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
    </div>
  )
}
