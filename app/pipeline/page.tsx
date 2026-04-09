import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Phone, CheckCircle, ArrowRight, TrendingUp, DollarSign, Shield, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { PhoneHealthPanel } from "@/components/pipeline/phone-health"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "preme" } }
)

async function getStats() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [total, today, qualified, handedOff, recent] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "qualified"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "handed_off"),
    supabase.from("leads").select("*, zx_verticals(name)").order("created_at", { ascending: false }).limit(10),
  ])

  return {
    totalLeads: total.count || 0,
    todayLeads: today.count || 0,
    qualifiedLeads: qualified.count || 0,
    handedOffLeads: handedOff.count || 0,
    recentLeads: recent.data || [],
  }
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  calling: "bg-yellow-100 text-yellow-800",
  contacted: "bg-purple-100 text-purple-800",
  qualified: "bg-green-100 text-green-800",
  handed_off: "bg-emerald-100 text-emerald-800",
  converted: "bg-teal-100 text-teal-800",
  dead: "bg-gray-100 text-gray-800",
}

export default async function AdminOverview() {
  const stats = await getStats()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-500">Lead arbitrage overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5 text-blue-600" />} label="Total Leads" value={stats.totalLeads} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-green-600" />} label="Today" value={stats.todayLeads} />
        <StatCard icon={<Phone className="h-5 w-5 text-purple-600" />} label="Qualified" value={stats.qualifiedLeads} />
        <StatCard icon={<DollarSign className="h-5 w-5 text-emerald-600" />} label="Handed Off" value={stats.handedOffLeads} />
      </div>

      {/* Phone Health */}
      <PhoneHealthPanel />

      {/* Conversion funnel */}
      {stats.totalLeads > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <FunnelStep label="Captured" count={stats.totalLeads} />
              <ArrowRight className="h-4 w-4 text-gray-300" />
              <FunnelStep label="Qualified" count={stats.qualifiedLeads} pct={stats.totalLeads > 0 ? Math.round((stats.qualifiedLeads / stats.totalLeads) * 100) : 0} />
              <ArrowRight className="h-4 w-4 text-gray-300" />
              <FunnelStep label="Handed Off" count={stats.handedOffLeads} pct={stats.qualifiedLeads > 0 ? Math.round((stats.handedOffLeads / stats.qualifiedLeads) * 100) : 0} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Leads</CardTitle>
          <Link href="/pipeline/leads" className="text-sm text-blue-600 hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          {stats.recentLeads.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No leads yet. Share your landing pages to start capturing leads.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Contact</th>
                    <th className="pb-2 font-medium">Source</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentLeads.map((lead: any) => (
                    <tr key={lead.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{lead.first_name} {lead.last_name}</td>
                      <td className="py-3 text-gray-500">{lead.email}</td>
                      <td className="py-3 text-gray-500">{lead.source || "direct"}</td>
                      <td className="py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[lead.status] || "bg-gray-100"}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400">{new Date(lead.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="rounded-lg bg-gray-50 p-3">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function FunnelStep({ label, count, pct }: { label: string; count: number; pct?: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold">{count}</p>
      <p className="text-gray-500">{label}</p>
      {pct !== undefined && <p className="text-xs text-gray-400">{pct}%</p>}
    </div>
  )
}
