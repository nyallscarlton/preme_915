"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

interface SentMessage {
  text: string
  sentAt: string
  chatId?: string
}

export default function PremeSmsComposePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useSearchParams()

  const contactId = params.get("contact_id") || ""
  const phone = params.get("phone") || ""
  const firstName = params.get("first_name") || ""

  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState<SentMessage[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [user, loading, router])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function handleSend() {
    if (!message.trim() || !phone) return
    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/admin/preme-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId || undefined,
          to_phone: phone,
          first_name: firstName || undefined,
          message: message.trim(),
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error || "Send failed")
      } else {
        setSent(prev => [
          { text: message.trim(), sentAt: new Date().toLocaleTimeString(), chatId: data.chat_id },
          ...prev,
        ])
        setMessage("")
        textareaRef.current?.focus()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSend()
  }

  if (loading || !user) return null

  const displayName = firstName || phone

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-start p-4 pt-10">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Send SMS via Riley</h1>
          <p className="text-gray-400 text-sm mt-1">
            Sends from <span className="text-white font-mono">+14709425787</span>
          </p>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 mb-4 space-y-1 text-sm">
          {displayName && (
            <div>
              <span className="text-gray-500">To: </span>
              <span className="text-white">{displayName}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Phone: </span>
            <span className="font-mono text-white">{phone || <span className="text-red-400">missing — add ?phone= to URL</span>}</span>
          </div>
          {contactId && (
            <div>
              <span className="text-gray-500">Contact ID: </span>
              <span className="font-mono text-gray-300 text-xs">{contactId}</span>
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-xl p-4 mb-3">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message…"
            rows={5}
            disabled={sending || !phone}
            className="w-full bg-transparent text-white placeholder-gray-600 resize-none outline-none text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
            <span className="text-gray-600 text-xs">⌘↵ to send</span>
            <button
              onClick={handleSend}
              disabled={sending || !message.trim() || !phone}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-3">
            {error}
          </div>
        )}

        {sent.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Sent this session</p>
            {sent.map((s, i) => (
              <div key={i} className="bg-gray-900 rounded-xl px-4 py-3 text-sm">
                <p className="text-white">{s.text}</p>
                <p className="text-gray-600 text-xs mt-1">{s.sentAt}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
