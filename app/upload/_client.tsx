"use client"

/**
 * Borrower document upload — reached from a Riley "we need these docs" text
 * or email. Token-authenticated, shows exactly what was requested (plus the
 * full checklist), multi-file per category, done in a couple of taps.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle, ExternalLink, Loader2, Trash2, Upload } from "lucide-react"

const DOC_SLOTS: { id: string; name: string; hint: string }[] = [
  { id: "identification", name: "Identification", hint: "Driver's license or passport" },
  { id: "income_verification", name: "Income", hint: "Tax returns, W-2s, or pay stubs" },
  { id: "bank_statement", name: "Bank Statements", hint: "Last 2 months, all accounts" },
  { id: "llc_docs", name: "LLC Documents", hint: "EIN letter, operating agreement, articles" },
  { id: "purchase_contract", name: "Purchase Contract", hint: "Or current mortgage statement if refinancing" },
  { id: "lease_rent_roll", name: "Lease / Rent Roll", hint: "If the property is leased" },
  { id: "insurance", name: "Insurance", hint: "Quote or policy for the property" },
  { id: "other", name: "Other", hint: "Anything else we asked for" },
]

interface DocFile {
  name: string
  path: string
  url: string
  category: string
}

export default function UploadClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [firstName, setFirstName] = useState("")
  const [requested, setRequested] = useState<string[]>([])
  const [customAsk, setCustomAsk] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocFile[]>([])
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchDocs = useCallback(async (appId: string, tok: string) => {
    const res = await fetch(`/api/documents?applicationId=${appId}&guest_token=${encodeURIComponent(tok)}`)
    if (res.ok) {
      const data = await res.json()
      setDocs(data.documents || [])
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setLoadError("This link is missing its access code. Text us at (470) 942-5787 and we'll send a fresh one.")
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/guest/verify-token?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!data.ok || !data.application) {
          setLoadError("This link is invalid or has expired. Text us at (470) 942-5787 and we'll send a fresh one.")
          return
        }
        const app = data.application
        setApplicationId(app.applicationId)
        setFirstName(app.firstName || "")
        setRequested(app.docRequest?.items || [])
        setCustomAsk(app.docRequest?.custom || null)
        await fetchDocs(app.applicationId, token)
      } catch {
        setLoadError("Something went wrong. Text us at (470) 942-5787.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, fetchDocs])

  const handleUpload = async (slotId: string, file: File) => {
    if (!applicationId || !token) return
    if (file.size > 10 * 1024 * 1024) {
      setError("Files need to be under 10MB.")
      return
    }
    setUploadingSlot(slotId)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("applicationId", applicationId)
      fd.append("category", slotId)
      fd.append("guest_token", token)
      const res = await fetch("/api/documents", { method: "POST", body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Upload failed — try again")
      }
      await fetchDocs(applicationId, token)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — try again")
    } finally {
      setUploadingSlot(null)
    }
  }

  const handleDelete = async (path: string) => {
    if (!applicationId || !token) return
    await fetch(`/api/documents?path=${encodeURIComponent(path)}&applicationId=${applicationId}&guest_token=${encodeURIComponent(token)}`, { method: "DELETE" })
    await fetchDocs(applicationId, token)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-[#997100]" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
        <p className="max-w-md text-center text-gray-600">{loadError}</p>
      </div>
    )
  }

  const requestedSlots = DOC_SLOTS.filter((s) => requested.includes(s.id))
  const otherSlots = DOC_SLOTS.filter((s) => !requested.includes(s.id))
  const requestedDone = requestedSlots.every((s) => docs.some((d) => d.category === s.id))

  const renderSlot = (slot: { id: string; name: string; hint: string }, highlight: boolean) => {
    const slotDocs = docs.filter((d) => d.category === slot.id)
    const has = slotDocs.length > 0
    return (
      <div
        key={slot.id}
        className={`rounded-lg border bg-white p-4 ${highlight && !has ? "border-[#997100] shadow-sm" : "border-gray-200"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              {slot.name}
              {has && <CheckCircle className="h-4 w-4 text-green-500" />}
              {highlight && !has && (
                <span className="rounded-full bg-[#997100]/10 px-2 py-0.5 text-[10px] font-medium text-[#997100]">Needed</span>
              )}
            </p>
            <p className="text-xs text-gray-500">{slot.hint}</p>
          </div>
          <input
            ref={(el) => { inputRefs.current[slot.id] = el }}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleUpload(slot.id, f)
              e.target.value = ""
            }}
          />
          <button
            onClick={() => inputRefs.current[slot.id]?.click()}
            disabled={uploadingSlot === slot.id}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
              highlight && !has ? "bg-[#997100] text-white hover:bg-[#b8850a]" : "border border-gray-300 text-gray-700 hover:border-gray-400"
            }`}
          >
            {uploadingSlot === slot.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {has ? "Add" : "Upload"}
          </button>
        </div>
        {slotDocs.map((d) => (
          <div key={d.path} className="mt-2 flex items-center justify-between gap-2 pl-1">
            <a href={d.url} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-1 text-xs text-blue-600 hover:underline">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{d.name}</span>
            </a>
            <button onClick={() => handleDelete(d.path)} className="shrink-0 text-gray-400 hover:text-red-500" title="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="mx-auto max-w-xl px-4">
        <div className="mb-6 text-center">
          <span className="text-3xl font-bold tracking-wide text-gray-900">
            PR<span className="relative">E<span className="absolute -top-1 left-1/2 h-1 w-4 -translate-x-1/2 bg-[#997100]"></span></span>ME
          </span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            {firstName ? `${firstName}, ` : ""}upload your documents
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {requestedSlots.length > 0
              ? requestedDone
                ? "Everything we asked for is in — you're all set. Add anything else below."
                : "These keep your loan moving — snap a photo or upload a file, takes a couple of minutes."
              : "Upload whatever you have handy — every document helps your file move faster."}
          </p>
        </div>

        {customAsk && (
          <div className="mb-4 rounded-lg border border-[#997100]/40 bg-[#997100]/5 p-3 text-sm text-gray-800">
            <span className="font-semibold">Also requested:</span> {customAsk}
            <p className="mt-1 text-xs text-gray-500">Upload this under "Other" below.</p>
          </div>
        )}

        {error && <p className="mb-3 text-center text-sm text-red-600">{error}</p>}

        <div className="space-y-3">
          {requestedSlots.map((s) => renderSlot(s, true))}
          {requestedSlots.length > 0 && otherSlots.length > 0 && (
            <p className="pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">Everything else</p>
          )}
          {otherSlots.map((s) => renderSlot(s, false))}
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Files upload securely to your loan file. Questions? Text (470) 942-5787.
        </p>
      </div>
    </div>
  )
}
