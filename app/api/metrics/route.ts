import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Parse date range from query params (default 90 days)
    const url = new URL(request.url)
    const days = parseInt(url.searchParams.get("days") || "90", 10)
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data: applications, error } = await supabase
      .from("loan_applications")
      .select("id, status, loan_amount, loan_type, submitted_at, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const apps = applications || []

    // Status breakdown (pie chart)
    const statusCounts: Record<string, number> = {}
    for (const app of apps) {
      const s = app.status || "unknown"
      statusCounts[s] = (statusCounts[s] || 0) + 1
    }
    const statusBreakdown = Object.entries(statusCounts).map(([name, value]) => ({
      name: name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      value,
      status: name,
    }))

    // Monthly breakdown (bar chart)
    const monthlyMap: Record<string, number> = {}
    for (const app of apps) {
      const d = new Date(app.submitted_at || app.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      monthlyMap[key] = (monthlyMap[key] || 0) + 1
    }
    const monthlyApplications = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => {
        const [y, m] = month.split("-")
        const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        })
        return { month: label, count }
      })

    // KPIs
    const total = apps.length
    const approved = apps.filter((a) => a.status === "approved").length
    const totalVolume = apps.reduce((sum, a) => sum + (a.loan_amount || 0), 0)
    const approvalRate = total > 0 ? Math.round((approved / total) * 1000) / 10 : 0

    // Counts by status
    const counts = {
      total,
      submitted: apps.filter((a) => a.status === "submitted").length,
      under_review: apps.filter((a) => a.status === "under_review").length,
      approved,
      rejected: apps.filter((a) => a.status === "rejected").length,
      on_hold: apps.filter((a) => a.status === "on_hold").length,
    }

    return NextResponse.json({
      success: true,
      statusBreakdown,
      monthlyApplications,
      totalVolume,
      approvalRate,
      counts,
      days,
    })
  } catch (error) {
    console.error("[metrics] API error:", error)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
