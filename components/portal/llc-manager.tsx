"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, ExternalLink, Loader2, Plus, Trash2, Upload, X } from "lucide-react"

interface Llc {
  id: string
  legal_name: string
  org_type: string
  state_of_formation: string | null
  formation_date: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  has_ein?: boolean
}

interface LlcDoc {
  name: string
  path: string
  url: string
  created_at: string
}

const EMPTY_FORM = { legal_name: "", ein: "", state_of_formation: "", formation_date: "", address: "", city: "", state: "", zip: "" }

export function LlcManager() {
  const [llcs, setLlcs] = useState<Llc[]>([])
  const [docs, setDocs] = useState<Record<string, LlcDoc[]>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchLlcs = useCallback(async () => {
    try {
      const res = await fetch("/api/llcs")
      const data = await res.json()
      const list: Llc[] = data.llcs || []
      setLlcs(list)
      const docEntries = await Promise.all(
        list.map(async (l) => {
          const r = await fetch(`/api/llcs/${l.id}/documents`)
          const d = r.ok ? await r.json() : { documents: [] }
          return [l.id, d.documents || []] as const
        })
      )
      setDocs(Object.fromEntries(docEntries))
    } catch {
      setError("Failed to load LLCs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLlcs()
  }, [fetchLlcs])

  const save = async () => {
    if (!form.legal_name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(editingId ? `/api/llcs/${editingId}` : "/api/llcs", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Save failed")
      }
      setShowForm(false)
      setForm({ ...EMPTY_FORM })
      setEditingId(null)
      await fetchLlcs()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Remove this LLC and its documents?")) return
    await fetch(`/api/llcs/${id}`, { method: "DELETE" })
    fetchLlcs()
  }

  const upload = async (llcId: string, file: File) => {
    setUploadingFor(llcId)
    try {
      const fd = new FormData()
      fd.append("file", file)
      await fetch(`/api/llcs/${llcId}/documents`, { method: "POST", body: fd })
      await fetchLlcs()
    } finally {
      setUploadingFor(null)
    }
  }

  const startEdit = (l: Llc) => {
    setEditingId(l.id)
    setForm({
      legal_name: l.legal_name,
      ein: "",
      state_of_formation: l.state_of_formation || "",
      formation_date: l.formation_date || "",
      address: l.address || "",
      city: l.city || "",
      state: l.state || "",
      zip: l.zip || "",
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">My LLCs</h2>
          <p className="text-sm text-muted-foreground">
            Save each entity once — pick it from a dropdown on any future application
          </p>
        </div>
        <Button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...EMPTY_FORM }) }}
          className="bg-[#997100] text-black hover:bg-[#b8850a]"
        >
          <Plus className="mr-2 h-4 w-4" /> Add LLC
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {showForm && (
        <Card className="border-[#997100] bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-foreground">{editingId ? "Edit LLC" : "New LLC"}</CardTitle>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-foreground">Legal name *</Label>
                <Input value={form.legal_name} placeholder="Sunrise Holdings LLC" onChange={(e) => setForm({ ...form, legal_name: e.target.value })} className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">EIN {editingId && <span className="text-xs text-muted-foreground">(leave blank to keep current)</span>}</Label>
                <Input value={form.ein} placeholder="12-3456789" onChange={(e) => setForm({ ...form, ein: e.target.value })} className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">State of formation</Label>
                <Input value={form.state_of_formation} placeholder="GA" maxLength={2} onChange={(e) => setForm({ ...form, state_of_formation: e.target.value.toUpperCase() })} className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">Formation date</Label>
                <Input type="date" value={form.formation_date} onChange={(e) => setForm({ ...form, formation_date: e.target.value })} className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">Business address</Label>
                <Input value={form.address} placeholder="123 Main St" onChange={(e) => setForm({ ...form, address: e.target.value })} className="bg-input border-border" />
              </div>
            </div>
            <Button onClick={save} disabled={saving || !form.legal_name.trim()} className="bg-[#997100] text-black hover:bg-[#b8850a]">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? "Save Changes" : "Add LLC"}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : llcs.length === 0 && !showForm ? (
        <Card className="border-dashed bg-card border-border">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Building2 className="h-8 w-8" />
            <p className="text-sm">No LLCs saved yet — add one and reuse it on every deal</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {llcs.map((l) => (
            <Card key={l.id} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base text-foreground">
                      <Building2 className="h-4 w-4 text-[#997100]" />
                      {l.legal_name}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {l.org_type}
                      {l.state_of_formation ? ` · ${l.state_of_formation}` : ""}
                      {l.has_ein ? " · EIN on file" : " · no EIN yet"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => startEdit(l)}>Edit</Button>
                    <button onClick={() => remove(l.id)} className="p-1 text-muted-foreground/60 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    Documents ({(docs[l.id] || []).length}) — EIN letter, operating agreement, articles
                  </p>
                  <input
                    ref={(el) => { inputRefs.current[l.id] = el }}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) upload(l.id, f)
                      e.target.value = ""
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 border-border px-2 text-xs"
                    disabled={uploadingFor === l.id}
                    onClick={() => inputRefs.current[l.id]?.click()}
                  >
                    {uploadingFor === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Upload
                  </Button>
                </div>
                {(docs[l.id] || []).map((d) => (
                  <div key={d.path} className="flex items-center justify-between gap-2 pl-1">
                    <a href={d.url} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-1 text-xs text-blue-500 hover:underline">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{d.name}</span>
                    </a>
                    <button
                      onClick={async () => {
                        await fetch(`/api/llcs/${l.id}/documents?path=${encodeURIComponent(d.path)}`, { method: "DELETE" })
                        fetchLlcs()
                      }}
                      className="shrink-0 text-muted-foreground/60 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {(docs[l.id] || []).length === 0 && (
                  <Badge variant="secondary" className="text-[10px]">No docs uploaded</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
