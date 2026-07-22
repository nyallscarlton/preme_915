"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Archive, Loader2, RotateCcw, Search } from "lucide-react"

interface ArchivedApp {
  id: string
  dbId: string
  applicantName: string
  applicantEmail: string
  propertyAddress: string
  loanAmount: number
  status: string
  submittedAt: string
  raw: Record<string, any>
}

function money(n: number): string {
  return n ? `$${Number(n).toLocaleString("en-US")}` : "—"
}

export function ArchiveList({
  applications,
  onOpen,
  onRefresh,
}: {
  applications: ArchivedApp[]
  onOpen: (dbId: string) => void
  onRefresh: () => void
}) {
  const [search, setSearch] = useState("")
  const [restoring, setRestoring] = useState<string | null>(null)

  const archived = applications
    .filter((a) => ["archived", "rejected"].includes(a.status))
    .filter(
      (a) =>
        !search ||
        a.applicantName.toLowerCase().includes(search.toLowerCase()) ||
        a.id.toLowerCase().includes(search.toLowerCase()) ||
        a.applicantEmail.toLowerCase().includes(search.toLowerCase())
    )

  const restore = async (app: ArchivedApp) => {
    setRestoring(app.dbId)
    try {
      // Back onto the board in the stage matching what kind of file it is
      const status = app.raw?.is_pre_qual ? "pre_qualified" : "submitted"
      await fetch(`/api/applications/${app.dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      onRefresh()
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {archived.length} archived file{archived.length === 1 ? "" : "s"} — click a row to open, Restore puts it back on the board
        </p>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, app #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-card border-border pl-8"
          />
        </div>
      </div>

      {archived.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-muted-foreground">
          <Archive className="h-8 w-8" />
          <p className="text-sm">Archive is empty</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Applicant</th>
                <th className="px-4 py-2.5 font-medium">Property</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">App #</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {archived.map((app) => (
                <tr
                  key={app.dbId}
                  onClick={() => onOpen(app.dbId)}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">{app.applicantName}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-muted-foreground">{app.propertyAddress}</td>
                  <td className="px-4 py-2.5">{money(app.loanAmount)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{app.id}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary" className="capitalize">{app.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {new Date(app.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restoring === app.dbId}
                      onClick={(e) => {
                        e.stopPropagation()
                        restore(app)
                      }}
                      className="h-7 gap-1.5 border-border text-muted-foreground hover:text-foreground"
                    >
                      {restoring === app.dbId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Restore
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
