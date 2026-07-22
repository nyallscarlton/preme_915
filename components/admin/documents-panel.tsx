"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react"

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

export function DocumentsPanel({ applicationId }: { applicationId: string }) {
  const [docs, setDocs] = useState<DocFile[]>([])
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
          <Badge variant="secondary">{uploadedCount}/{requiredCount}</Badge>
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
            {DOC_SLOTS.map((slot) => {
              const slotDocs = docs.filter((d) => d.category === slot.id)
              const has = slotDocs.length > 0
              return (
                <div key={slot.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <CheckCircle className={`h-4 w-4 shrink-0 ${has ? "text-green-500" : "text-muted-foreground/30"}`} />
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
