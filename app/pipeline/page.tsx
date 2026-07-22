import { createClient } from "@supabase/supabase-js"
import { Badge } from "@/components/ui/badge"
import { FileText } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "preme" } }
)

// Kanban columns in loan-lifecycle order. Applications land in the column
// matching their status; archived/rejected stay off the board.
const COLUMNS: { key: string; title: string; statuses: string[]; accent: string }[] = [
  { key: "pre_qual", title: "Pre-Qual Review", statuses: ["pre_qualified"], accent: "border-t-amber-500" },
  { key: "sent", title: "1003 Out", statuses: ["sent"], accent: "border-t-blue-500" },
  { key: "submitted", title: "1003 Submitted", statuses: ["submitted"], accent: "border-t-purple-500" },
  { key: "under_review", title: "With Lender", statuses: ["under_review"], accent: "border-t-orange-500" },
  { key: "approved", title: "Approved / CTC", statuses: ["approved"], accent: "border-t-green-500" },
  { key: "funded", title: "Funded", statuses: ["funded"], accent: "border-t-emerald-600" },
]

type AppRow = {
  id: string
  application_number: string | null
  applicant_name: string | null
  loan_amount: number | null
  loan_purpose: string | null
  property_city: string | null
  property_state: string | null
  property_address: string | null
  status: string
  is_pre_qual: boolean
  updated_at: string
  created_at: string
}

async function getApplications(): Promise<AppRow[]> {
  const { data } = await supabase
    .from("loan_applications")
    .select(
      "id, application_number, applicant_name, loan_amount, loan_purpose, property_city, property_state, property_address, status, is_pre_qual, updated_at, created_at"
    )
    .not("status", "in", "(archived,rejected)")
    .order("updated_at", { ascending: false })
  return (data as AppRow[]) || []
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "1 day"
  return `${days} days`
}

function money(n: number | null): string {
  return n ? `$${Number(n).toLocaleString("en-US")}` : "—"
}

export default async function ApplicationsBoard() {
  const apps = await getApplications()

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-sm text-gray-500">
            {apps.length} active file{apps.length === 1 ? "" : "s"} — click a card to open the full workspace (docs, conditions, lender, messages)
          </p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colApps = apps.filter((a) => col.statuses.includes(a.status))
          return (
            <div key={col.key} className="w-72 shrink-0">
              <div className={`rounded-t-lg border border-b-0 border-t-4 ${col.accent} bg-gray-50 px-3 py-2`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">{col.title}</span>
                  <Badge variant="secondary" className="text-xs">{colApps.length}</Badge>
                </div>
              </div>
              <div className="min-h-[200px] space-y-2 rounded-b-lg border border-gray-200 bg-gray-50/50 p-2">
                {colApps.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-gray-400">No files</p>
                )}
                {colApps.map((app) => (
                  <Link
                    key={app.id}
                    href={`https://www.premerealestate.com/admin?app=${app.id}`}
                    target="_blank"
                    rel="noopener"
                    className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-[#997100] hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {app.applicant_name || "Unknown"}
                      </span>
                      {app.is_pre_qual && (
                        <Badge className="shrink-0 bg-amber-100 text-amber-800 hover:bg-amber-100">quick</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {app.property_city || app.property_address || "No address"}
                      {app.property_state ? `, ${app.property_state}` : ""}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{money(app.loan_amount)}</span>
                      <span className="text-[11px] capitalize text-gray-400">{(app.loan_purpose || "").replace(/-/g, " ")}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                      <span className="font-mono text-[10px] text-gray-400">{app.application_number}</span>
                      <span className="text-[10px] text-gray-400">{daysAgo(app.updated_at)} in stage</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {apps.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 py-16 text-gray-400">
          <FileText className="h-8 w-8" />
          <p className="text-sm">No active applications yet</p>
        </div>
      )}
    </div>
  )
}
