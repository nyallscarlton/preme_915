"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, DollarSign, FileText, CheckCircle } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

interface MetricsData {
  statusBreakdown: { name: string; value: number; status: string }[]
  monthlyApplications: { month: string; count: number }[]
  totalVolume: number
  approvalRate: number
  counts: {
    total: number
    submitted: number
    under_review: number
    approved: number
    rejected: number
    on_hold: number
  }
  days: number
}

const STATUS_COLORS: Record<string, string> = {
  submitted: "#3b82f6",
  under_review: "#eab308",
  approved: "#22c55e",
  rejected: "#ef4444",
  on_hold: "#f97316",
  unknown: "#6b7280",
}

export function MetricsDashboard() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [days, setDays] = useState(90)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/metrics?days=${days}`)
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error || "Failed to fetch")
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics")
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 mb-4">{error}</p>
        <Button variant="outline" onClick={fetchMetrics}>
          Retry
        </Button>
      </div>
    )
  }

  if (!data) return null

  const pieColors = data.statusBreakdown.map(
    (s) => STATUS_COLORS[s.status] || STATUS_COLORS.unknown
  )

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Period:</span>
        {[30, 60, 90].map((d) => (
          <Button
            key={d}
            variant={days === d ? "default" : "outline"}
            size="sm"
            className={
              days === d
                ? "bg-[#997100] hover:bg-[#b8850a] text-black"
                : "border-border text-foreground hover:bg-muted bg-transparent"
            }
            onClick={() => setDays(d)}
          >
            {d} Days
          </Button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-[#997100]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{data.counts.total}</div>
            <p className="text-xs text-muted-foreground">Last {data.days} days</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approval Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{data.approvalRate}%</div>
            <p className="text-xs text-muted-foreground">
              {data.counts.approved} of {data.counts.total} approved
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-[#997100]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.totalVolume >= 1000000
                ? `$${(data.totalVolume / 1000000).toFixed(1)}M`
                : `$${data.totalVolume.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground">Last {data.days} days</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Pipeline</CardTitle>
            <CheckCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.counts.submitted + data.counts.under_review}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.counts.submitted} new, {data.counts.under_review} in review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Bar Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Monthly Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyApplications.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.monthlyApplications}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="count" fill="#997100" radius={[4, 4, 0, 0]} name="Applications" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Pie Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {data.statusBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.statusBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {data.statusBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
