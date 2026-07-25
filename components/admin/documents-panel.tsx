"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { BellRing, CheckCircle, ExternalLink, FileText, Loader2, Send, Trash2, Upload, X } from "lucide-react"

// Pre-lender document checklist — what a DSCR file needs before submission.
// Category ids match the borrower upload form where the slots overlap, so
// borrower-side and admin-side uploads land in the same folders.
const DOC_SLOTS = [
  { id: "identification", name: "Identification", hint: "Driver's license or passport" },
  { id: "income_verification", name: "Income", hint: "Tax returns, W-2s, pay stubs" },
  { id: "bank_statement", name: "Bank Statements", hint: "Last 2 months, all accounts" },
  { id: "llc_docs", name: "LLC Docs", hint: "EIN letter, operating agreement, articles" },
  { id: "purchase_contract", name: "Purchase Contract", hint: "Or current mortgage statement if refi" },
  { id: "lease_rent_roll", name: "Lease / Rent Roll", hint: "If property is leased" },
  { id: "insurance", name: "Insurance", hint: "Quote or policy for the property" },
  { id: "other", name: "Other", hint: "Anything else for the file" },
]

interface DocFile {
  name: string
  path: string
  url: string
  category: string
  created_at: string
}

interface GeneratedFile {
  name: string
  url: string
  signed: boolean
  created_at: string | null
}

export function DocumentsPanel({ applicationId }: { applicationId: string }) {
  const [docs, setDocs] = useState<DocFile[]>([])
  const [generated, setGenerated] = useState<GeneratedFile[]>([])
  const [docRequest, setDocRequest] = useState<{ items?: string[]; custom?: string | null; requested_at?: string } | null>(null)
  const [requestMode, setRequestMode] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [customAsk, setCustomAsk] = useState("")
  const [sendingRequest, setSendingRequest] = useState(false)
  const [requestResult, setRequestResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?applicationId=${applicationId}`)
      if (!res.ok) throw new Error("Failed to load documents")
      const data = await res.json()
      setDocs(data.documents || [])
      setGenerated(data.generated || [])
      setDocRequest(data.docRequest || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents")
    } finally {
      setLoading(false)
    }
  }, [applicationId])

  useEffect(() => {
    setLoading(true)
    setDocs([])
    fetchDocs()
  }, [fetchDocs])

  const handleUpload = async (slotId: string, file: File) => {
    setUploadingSlot(slotId)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("applicationId", applicationId)
      fd.append("category", slotId)
      const res = await fetch("/api/documents", { method: "POST", body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Upload failed")
      }
      await fetchDocs()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploadingSlot(null)
    }
  }

  const handleDelete = async (path: string) => {
    setError(null)
    const res = await fetch(`/api/documents?path=${encodeURIComponent(path)}&applicationId=${applicationId}`, {
      method: "DELETE",
    })
    if (res.ok) await fetchDocs()
    else setError("Delete failed")
  }

  const startRequestMode = () => {
    // Pre-check everything still missing
    const missing: Record<string, boolean> = {}
    for (const slot of DOC_SLOTS) {
      if (slot.id !== "other" && !docs.some((d) => d.category === slot.id)) missing[slot.id] = true
    }
    setSelected(missing)
    setCustomAsk("")
    setRequestResult(null)
    setRequestMode(true)
  }

  const sendRequest = async () => {
    const items = Object.keys(selected).filter((k) => selected[k])
    if (items.length === 0 && !customAsk.trim()) return
    setSendingRequest(true)
    setRequestResult(null)
    try {
      const res = await fetch(`/api/applications/${applicationId}/request-docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, custom: customAsk.trim(), method: "both" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")
      setRequestResult(
        `Request sent${data.smsSent ? " · text ✓" : ""}${data.emailSent ? " · email ✓" : ""}`
      )
      setRequestMode(false)
      await fetchDocs()
    } catch (e) {
      setRequestResult(e instanceof Error ? e.message : "Request failed")
    } finally {
      setSendingRequest(false)
    }
  }

  const uploadedCount = DOC_SLOTS.filter(
    (s) => s.id !== "other" && docs.some((d) => d.category === s.id)
  ).length
  const requiredCount = DOC_SLOTS.length - 1

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#997100]" />
            Documents
          </span>
          <span className="flex items-center gap-2">
            {!requestMode && (
              <Button
                size="sm"
                variant="outline"
                onClick={startRequestMode}
                className="h-7 gap-1.5 border-[#997100] px-2 text-xs text-[#997100] hover:bg-[#997100] hover:text-black"
              >
                <BellRing className="h-3.5 w-3.5" />
                Request
              </Button>
            )}
            <Badge variant="secondary">{uploadedCount}/{requiredCount}</Badge>
          </span>
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Pre-lender package — borrower uploads after pre-qual, or add files here
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {error && <p className="text-xs text-red-500">{error}</p>}

            {generated.length > 0 && (
              <div className="rounded-md border border-[#997100]/50 bg-[#997100]/5 px-3 py-2">
                <p className="mb-1.5 text-xs font-semibold text-foreground">Loan file</p>
                {generated.map((gf) => (
                  <a
                    key={gf.name}
                    href={gf.url}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center justify-between gap-2 py-1 text-xs text-blue-500 hover:underline"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{gf.name}</span>
                    </span>
                    {gf.signed && <Badge className="shrink-0 bg-green-100 text-green-800 hover:bg-green-100">Signed</Badge>}
                  </a>
                ))}
              </div>
            )}

            {requestResult && <p className="text-xs text-[#997100]">{requestResult}</p>}
            {docRequest?.requested_at && !requestMode && (
              <p className="text-[11px] text-muted-foreground">
                Last requested {new Date(docRequest.requested_at).toLocaleDateString()} —{" "}
                {(docRequest.items || []).length + (docRequest.custom ? 1 : 0)} item(s)
              </p>
            )}
            {requestMode && (
              <div className="rounded-md border border-[#997100]/50 bg-[#997100]/5 px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Pick what you need — Riley texts + emails the borrower an upload link</p>
                  <button onClick={() => setRequestMode(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
                <Input
                  placeholder="Custom ask (e.g. 2023 K-1, HOA statement)…"
                  value={customAsk}
                  onChange={(e) => setCustomAsk(e.target.value)}
                  className="mt-2 h-8 bg-input border-border text-xs"
                />
                <Button
                  size="sm"
                  onClick={sendRequest}
                  disabled={sendingRequest || (Object.values(selected).every((v) => !v) && !customAsk.trim())}
                  className="mt-2 h-8 w-full gap-1.5 bg-[#997100] text-black hover:bg-[#b8850a]"
                >
                  {sendingRequest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send Request (SMS + Email)
                </Button>
              </div>
            )}
            {DOC_SLOTS.map((slot) => {
              const slotDocs = docs.filter((d) => d.category === slot.id)
              const has = slotDocs.length > 0
              return (
                <div key={slot.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {requestMode && slot.id !== "other" ? (
                        <input
                          type="checkbox"
                          checked={!!selected[slot.id]}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [slot.id]: e.target.checked }))}
                          className="h-4 w-4 shrink-0 accent-[#997100]"
                        />
                      ) : (
                        <CheckCircle className={`h-4 w-4 shrink-0 ${has ? "text-green-500" : "text-muted-foreground/30"}`} />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{slot.name}</p>
                        {!has && <p className="truncate text-[11px] text-muted-foreground">{slot.hint}</p>}
                      </div>
                    </div>
                    <input
                      ref={(el) => { inputRefs.current[slot.id] = el }}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUpload(slot.id, f)
                        e.target.value = ""
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 px-2 text-muted-foreground hover:text-foreground"
                      disabled={uploadingSlot === slot.id}
                      onClick={() => inputRefs.current[slot.id]?.click()}
                    >
                      {uploadingSlot === slot.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {slotDocs.map((d) => (
                    <div key={d.path} className="mt-1.5 flex items-center justify-between gap-2 pl-6">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener"
                        className="flex min-w-0 items-center gap-1 text-xs text-blue-500 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{d.name}</span>
                      </a>
                      <button
                        onClick={() => handleDelete(d.path)}
                        className="shrink-0 text-muted-foreground/60 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}
      </CardContent>
    </Card>
  )
}
