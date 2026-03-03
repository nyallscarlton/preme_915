"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Eye,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import { PortalToggle } from "@/components/portal-toggle"

interface Application {
  id: string
  application_number: string
  applicant_name: string
  applicant_email: string
  applicant_phone: string
  status: string
  loan_amount: number
  loan_type: string
  property_address: string
  property_city: string
  property_state: string
  submitted_at: string
  created_at: string
}

export default function LenderDashboard() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

  // Protect lender route — redirect non-lender/admin users
  useEffect(() => {
    if (!authLoading && user && user.role !== "lender" && user.role !== "admin") {
      router.push("/dashboard")
    }
    if (!authLoading && !user) {
      router.push("/auth?next=/lender")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("loan_applications")
          .select("*")
          .order("created_at", { ascending: false })

        if (!error && data) {
          setApplications(data)
        }
      } catch {
        // Failed to load
      } finally {
        setLoading(false)
      }
    }

    fetchApplications()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-600 text-white"
      case "under_review":
        return "bg-yellow-600 text-black"
      case "submitted":
        return "bg-blue-600 text-white"
      case "rejected":
        return "bg-red-600 text-white"
      case "on_hold":
        return "bg-orange-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const formatStatus = (status: string) =>
    status
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")

  const filtered = applications.filter((app) => {
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    const matchesSearch =
      !searchQuery ||
      app.applicant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.applicant_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.application_number?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const stats = {
    total: applications.length,
    submitted: applications.filter((a) => a.status === "submitted").length,
    underReview: applications.filter((a) => a.status === "under_review").length,
    approved: applications.filter((a) => a.status === "approved").length,
    totalVolume: applications.reduce((sum, a) => sum + (a.loan_amount || 0), 0),
  }

  const pipelineChartData = [
    { name: "Submitted", count: stats.submitted, fill: "#3b82f6" },
    { name: "In Review", count: stats.underReview, fill: "#eab308" },
    { name: "Approved", count: stats.approved, fill: "#22c55e" },
    { name: "Rejected", count: applications.filter((a) => a.status === "rejected").length, fill: "#ef4444" },
    { name: "On Hold", count: applications.filter((a) => a.status === "on_hold").length, fill: "#f97316" },
  ].filter((d) => d.count > 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pipeline...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="flex items-center">
                <div className="relative">
                  <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                  <span className="text-2xl font-bold tracking-wide text-foreground">PREME</span>
                </div>
              </Link>
              <Badge variant="outline" className="border-[#997100] text-[#997100]">
                Lender Portal
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {user?.firstName} {user?.lastName}
              </span>
              <PortalToggle />
              <Button
                variant="outline"
                size="sm"
                className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                onClick={() => {
                  signOut()
                  window.location.href = "/"
                }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Loan Pipeline</h1>
          <p className="text-muted-foreground">Manage loan applications and borrower activity</p>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              <Users className="h-4 w-4 text-[#997100]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">New</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.submitted}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Review</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.underReview}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Volume</CardTitle>
              <DollarSign className="h-4 w-4 text-[#997100]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalVolume > 0 ? (stats.totalVolume / 1000000).toFixed(1) + "M" : "0"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Section */}
        <Card className="bg-card border-border mb-8">
          <CardHeader
            className="cursor-pointer"
            onClick={() => setAnalyticsOpen(!analyticsOpen)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">Pipeline Analytics</CardTitle>
              {analyticsOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {analyticsOpen && (
            <CardContent>
              {pipelineChartData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No application data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={pipelineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar dataKey="count" name="Applications" radius={[4, 4, 0, 0]}>
                      {pipelineChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          )}
        </Card>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or app #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 bg-card border-border">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Applications Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Application
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Borrower
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Property
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        No applications found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((app) => (
                      <tr key={app.id} className="border-b border-border hover:bg-muted/50">
                        <td className="p-4">
                          <p className="font-medium text-foreground text-sm">
                            {app.application_number}
                          </p>
                          <p className="text-xs text-muted-foreground">{app.loan_type || "—"}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-foreground">{app.applicant_name}</p>
                          <p className="text-xs text-muted-foreground">{app.applicant_email}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm font-medium text-foreground">
                            ${(app.loan_amount || 0).toLocaleString()}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-foreground truncate max-w-[200px]">
                            {[app.property_address, app.property_city, app.property_state]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </p>
                        </td>
                        <td className="p-4">
                          <Badge className={getStatusColor(app.status)}>
                            {formatStatus(app.status)}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {app.submitted_at
                            ? new Date(app.submitted_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/lender/${app.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
