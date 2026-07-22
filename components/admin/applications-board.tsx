"use client"

import { Badge } from "@/components/ui/badge"
import { FileText } from "lucide-react"

// Kanban columns in loan-lifecycle order — same stages as the pipeline board.
const COLUMNS: { key: string; title: string; statuses: string[]; accent: string }[] = [
  { key: "pre_qual", title: "Pre-Qual Review", statuses: ["pre_qualified"], accent: "border-t-amber-500" },
  { key: "sent", title: "1003 Out", statuses: ["sent"], accent: "border-t-blue-500" },
  { key: "submitted", title: "1003 Submitted", statuses: ["submitted"], accent: "border-t-purple-500" },
  { key: "under_review", title: "With Lender", statuses: ["under_review"], accent: "border-t-orange-500" },
  { key: "approved", title: "Approved / CTC", statuses: ["approved"], accent: "border-t-green-500" },
  { key: "funded", title: "Funded", statuses: ["funded"], accent: "border-t-emerald-600" },
]

interface BoardApp {
  id: string
  dbId: string
  applicantName: string
  propertyAddress: string
  loanAmount: number
  status: string
  submittedAt: string
  loanType: string
  raw: Record<string, any>
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (!isFinite(days) || days < 0) return ""
  if (days === 0) return "today"
  if (days === 1) return "1 day"
  return `${days} days`
}

function money(n: number): string {
  return n ? `$${Number(n).toLocaleString("en-US")}` : "—"
}

export function ApplicationsBoard({
  applications,
  onOpen,
}: {
  applications: BoardApp[]
  onOpen: (dbId: string) => void
}) {
  const active = applications.filter((a) => !["archived", "rejected"].includes(a.status))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {active.length} active file{active.length === 1 ? "" : "s"} — click a card for details, docs, conditions, and messages
      </p>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colApps = active.filter((a) => col.statuses.includes(a.status))
          return (
            <div key={col.key} className="w-72 shrink-0">
              <div className={`rounded-t-lg border border-b-0 border-t-4 ${col.accent} bg-muted px-3 py-2`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{col.title}</span>
                  <Badge variant="secondary" className="text-xs">{colApps.length}</Badge>
                </div>
              </div>
              <div className="min-h-[200px] space-y-2 rounded-b-lg border border-border bg-muted/40 p-2">
                {colApps.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">No files</p>
                )}
                {colApps.map((app) => (
                  <button
                    key={app.dbId}
                    onClick={() => onOpen(app.dbId)}
                    className="block w-full rounded-lg border border-border bg-background p-3 text-left shadow-sm transition hover:border-[#997100] hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">{app.applicantName || "Unknown"}</span>
                      {app.raw?.is_pre_qual && (
                        <Badge className="shrink-0 bg-amber-100 text-amber-800 hover:bg-amber-100">quick</Badge>
                      )}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {app.propertyAddress || "No address"}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-medium">{money(app.loanAmount)}</span>
                      <span className="text-[11px] capitalize text-muted-foreground">
                        {(app.loanType === "N/A" ? "" : app.loanType || "").replace(/-/g, " ")}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{app.id}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {daysAgo(app.submittedAt) && `${daysAgo(app.submittedAt)} in stage`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {active.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p className="text-sm">No active applications yet</p>
        </div>
      )}
    </div>
  )
}
