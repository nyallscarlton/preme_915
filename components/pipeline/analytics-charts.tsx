"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts"

interface AnalyticsData {
  totalLeads: number
  statusCounts: Record<string, number>
  sourceCounts: Record<string, number>
  dailyCounts: Record<string, number>
  pagePerformance: { slug: string; headline: string; leads: number }[]
}

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#6b7280"]

export function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  const dailyData = Object.entries(data.dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: date.slice(5), leads: count }))

  const statusData = Object.entries(data.statusCounts).map(([name, value]) => ({ name, value }))
  const sourceData = Object.entries(data.sourceCounts).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      {/* Daily leads chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Lead Volume</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Source breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No data yet</p>
            ) : (
              <div className="space-y-3">
                {sourceData.sort((a, b) => b.value - a.value).map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm">{s.name}</span>
                    </div>
                    <span className="text-sm font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Landing page performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Landing Page Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {data.pagePerformance.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No landing pages configured</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Page</th>
                    <th className="pb-2 font-medium">Slug</th>
                    <th className="pb-2 font-medium text-right">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pagePerformance
                    .sort((a, b) => b.leads - a.leads)
                    .map((page) => (
                      <tr key={page.slug} className="border-b last:border-0">
                        <td className="py-2 font-medium">{page.headline}</td>
                        <td className="py-2 text-gray-500">/p/{page.slug}</td>
                        <td className="py-2 text-right font-medium">{page.leads}</td>
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
