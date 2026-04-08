import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LeadsTable } from "@/components/pipeline/leads-table"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "zentryx" } }
)

export default async function LeadsPage() {
  // Get current Monday for number_health week_start
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const mondayStr = monday.toISOString().split("T")[0]

  const [leadsRes, verticalsRes, poolRes, healthRes] = await Promise.all([
    supabase
      .from("zx_leads")
      .select("*, zx_verticals(slug, name), zx_buyers(name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("zx_verticals")
      .select("slug, name")
      .eq("active", true),
    supabase
      .from("number_pool")
      .select("phone_number, status")
      .in("status", ["burned", "retired"]),
    supabase
      .from("number_health")
      .select("phone_number, status, contact_rate")
      .gte("week_start", mondayStr)
      .in("status", ["burned", "warning"]),
  ])

  const leads = leadsRes.data || []
  const verticals = verticalsRes.data || []

  // Build a set of burned/warning numbers
  const burnedNumbers = new Set<string>()
  const warningNumbers = new Set<string>()
  for (const row of poolRes.data || []) {
    if (row.status === "burned" || row.status === "retired") {
      burnedNumbers.add(row.phone_number)
    }
  }
  for (const row of healthRes.data || []) {
    if (row.status === "burned" || (row.contact_rate !== null && row.contact_rate < 10)) {
      burnedNumbers.add(row.phone_number)
    } else if (row.status === "warning" || (row.contact_rate !== null && row.contact_rate < 25)) {
      warningNumbers.add(row.phone_number)
    }
  }

  // For each lead, check if there was a recent outbound call from a burned number
  // by querying zx_contact_interactions for the lead phones
  const leadPhones = leads
    .filter((l: any) => l.phone)
    .map((l: any) => l.phone.replace(/\D/g, "").slice(-10))
    .filter(Boolean)

  const burnedCallLeadIds = new Set<string>()
  if (leadPhones.length > 0 && (burnedNumbers.size > 0 || warningNumbers.size > 0)) {
    // Fetch recent outbound voice interactions
    const { data: recentCalls } = await supabase
      .from("zx_contact_interactions")
      .select("phone, channel, direction, metadata, created_at")
      .eq("channel", "voice")
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(500)

    if (recentCalls) {
      // For each lead, find the most recent call and check its from_number
      for (const lead of leads) {
        const leadDigits = (lead as any).phone?.replace(/\D/g, "").slice(-10)
        if (!leadDigits) continue
        const lastCall = recentCalls.find((c: any) =>
          c.phone?.replace(/\D/g, "").slice(-10) === leadDigits
        )
        if (lastCall) {
          const meta = (lastCall.metadata || {}) as Record<string, unknown>
          const fromNum = meta.from_number as string
          if (fromNum && burnedNumbers.has(fromNum)) {
            burnedCallLeadIds.add((lead as any).id)
          }
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-sm text-gray-500">All captured leads across verticals</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <LeadsTable
            leads={leads}
            verticals={verticals}
            burnedCallLeadIds={Array.from(burnedCallLeadIds)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
