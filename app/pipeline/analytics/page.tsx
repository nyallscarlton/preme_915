import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnalyticsCharts } from "@/components/pipeline/analytics-charts"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "zentryx" } }
)

async function getAnalytics() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [leads, pages, verticals] = await Promise.all([
    supabase
      .from("zx_leads")
      .select("id, status, temperature, source, landing_page_id, created_at")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at"),
    supabase.from("zx_landing_pages").select("id, slug, headline").eq("active", true),
    supabase.from("zx_verticals").select("id, slug, name").eq("active", true),
  ])

  // Status distribution
  const statusCounts: Record<string, number> = {}
  const sourceCounts: Record<string, number> = {}
  const dailyCounts: Record<string, number> = {}
  const pageCounts: Record<string, number> = {}

  for (const lead of leads.data || []) {
    statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1
    const src = lead.source || "direct"
    sourceCounts[src] = (sourceCounts[src] || 0) + 1
    const day = new Date(lead.created_at).toISOString().split("T")[0]
    dailyCounts[day] = (dailyCounts[day] || 0) + 1
    if (lead.landing_page_id) {
      pageCounts[lead.landing_page_id] = (pageCounts[lead.landing_page_id] || 0) + 1
    }
  }

  // Page performance
  const pagePerformance = (pages.data || []).map((p) => ({
    slug: p.slug,
    headline: p.headline,
    leads: pageCounts[p.id] || 0,
  }))

  return {
    totalLeads: leads.data?.length || 0,
    statusCounts,
    sourceCounts,
    dailyCounts,
    pagePerformance,
  }
}

export default async function AnalyticsPage() {
  const analytics = await getAnalytics()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-gray-500">Last 30 days performance</p>
      </div>

      <AnalyticsCharts data={analytics} />
    </div>
  )
}
