"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard,
  FileText,
  Users,
  MessageSquare,
  Settings,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Loader2,
  RefreshCw,
  BarChart3,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"
import { PortalToggle } from "@/components/portal-toggle"
import { ApplicationsManagement } from "@/components/admin/applications-management"
import { ConditionsManagement } from "@/components/admin/conditions-management"
import { UsersManagement } from "@/components/admin/users-management"
import { AdminMessaging } from "@/components/admin/admin-messaging"
import { SystemSettings } from "@/components/admin/system-settings"
import { MetricsDashboard } from "@/components/admin/metrics-dashboard"

interface Application {
  id: string
  dbId: string
  applicantName: string
  applicantEmail: string
  applicantPhone: string
  propertyAddress: string
  loanAmount: number
  status: string
  submittedAt: string
  loanType: string
  creditScoreRange: string
  propertyValue: number
  progress: number
  assignedTo: string | null
}

export function AdminDashboard() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingAppId, setPendingAppId] = useState<string | null>(null)

  const fetchApplications = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log("[v0] Fetching applications from API...")
      const response = await fetch("/api/applications")
      const result = await response.json()

      console.log("[v0] API response:", result)

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch applications")
      }

      // Transform API data to match component interface
      const transformedApps = (result.applications || []).map((app: any) => ({
        id: app.application_number || app.id,
        dbId: app.id,
        applicantName: app.applicant_name || "Unknown",
        applicantEmail: app.applicant_email || "",
        applicantPhone: app.applicant_phone || "",
        propertyAddress:
          [app.property_address, app.property_city, app.property_state].filter(Boolean).join(", ") || "N/A",
        loanAmount: app.loan_amount || 0,
        status: app.status || "submitted",
        submittedAt: app.submitted_at || app.created_at || new Date().toISOString(),
        loanType: app.loan_type || app.property_type || "N/A",
        creditScoreRange: app.credit_score_range || "N/A",
        propertyValue: app.property_value || 0,
        progress: app.status === "approved" ? 100 : app.status === "under_review" ? 65 : 25,
        assignedTo: null,
      }))

      console.log("[v0] Transformed applications:", transformedApps)
      setApplications(transformedApps)
    } catch (err) {
      console.error("[v0] Error fetching applications:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch applications")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  const stats = {
    totalApplications: applications.length,
    pendingReview: applications.filter((a) => a.status === "submitted" || a.status === "under_review").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
    totalLoanVolume: applications.reduce((sum, a) => sum + (a.loanAmount || 0), 0),
    avgProcessingTime: 7.5,
    approvalRate:
      applications.length > 0
        ? Math.round((applications.filter((a) => a.status === "approved").length / applications.length) * 100 * 10) / 10
        : 0,
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = "/"
  }

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
      case "archived":
        return "bg-gray-500 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4" />
      case "under_review":
        return <Clock className="h-4 w-4" />
      case "submitted":
        return <FileText className="h-4 w-4" />
      case "rejected":
        return <AlertCircle className="h-4 w-4" />
      case "on_hold":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="flex items-center">
                <div className="relative">
                  <span className="text-2xl font-bold tracking-wide text-foreground">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
                </div>
              </Link>
              <div className="hidden md:block">
                <Badge className="bg-[#997100] text-black">Admin Portal</Badge>
              </div>
              <div className="hidden md:block">
                <p className="text-sm text-muted-foreground">Welcome, {user?.firstName || user?.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <PortalToggle />
              <Button
                variant="outline"
                className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-black bg-transparent"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage loan applications and system operations</p>
          </div>
          <Button
            variant="outline"
            onClick={fetchApplications}
            disabled={isLoading}
            className="border-border text-foreground hover:bg-muted bg-transparent"
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="text-sm font-medium">Error: {error}</p>
            <Button variant="link" className="text-red-800 underline p-0 h-auto" onClick={fetchApplications}>
              Try again
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7 bg-muted border border-border">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="applications"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <FileText className="w-4 h-4 mr-2" />
              Applications
            </TabsTrigger>
            <TabsTrigger
              value="conditions"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Conditions
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger
              value="metrics"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Metrics
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6">
            {/* Key Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
                  <FileText className="h-4 w-4 text-[#997100]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalApplications}
                  </div>
                  <p className="text-xs text-muted-foreground">All time applications</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.pendingReview}
                  </div>
                  <p className="text-xs text-muted-foreground">Awaiting review</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Loan Volume</CardTitle>
                  <DollarSign className="h-4 w-4 text-[#997100]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : stats.totalLoanVolume >= 1000000 ? (
                      `$${(stats.totalLoanVolume / 1000000).toFixed(1)}M`
                    ) : (
                      `$${stats.totalLoanVolume.toLocaleString()}`
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Total processed</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Approval Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${stats.approvalRate}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">Overall rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Applications */}
            <Card className="bg-card border-border mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">Recent Applications</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Latest loan applications requiring attention
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    className="border-border text-foreground hover:bg-muted bg-transparent"
                    onClick={() => setActiveTab("applications")}
                  >
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : applications.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No applications yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.slice(0, 5).map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-4 bg-muted rounded-lg cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => { setPendingAppId(app.id); setActiveTab("applications") }}
                      >
                        <div className="flex items-center space-x-4">
                          {getStatusIcon(app.status)}
                          <div>
                            <p className="font-medium text-foreground">{app.id}</p>
                            <p className="text-sm text-muted-foreground">
                              {app.applicantName} • {app.propertyAddress}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-medium text-foreground">${app.loanAmount.toLocaleString()}</p>
                            <Badge className={getStatusColor(app.status)}>{formatStatus(app.status)}</Badge>
                          </div>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Quick Actions</CardTitle>
                  <CardDescription className="text-muted-foreground">Common administrative tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button
                      className="w-full justify-start bg-[#997100] hover:bg-[#b8850a] text-black font-semibold"
                      onClick={() => setActiveTab("applications")}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Review Pending Applications
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-border text-foreground hover:bg-muted bg-transparent"
                      onClick={() => setActiveTab("users")}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Manage Users
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-border text-foreground hover:bg-muted bg-transparent"
                      onClick={() => setActiveTab("messages")}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Send Messages
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">System Status</CardTitle>
                  <CardDescription className="text-muted-foreground">Current system performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Database</span>
                      <Badge className="bg-green-600 text-white">Online</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Document Storage</span>
                      <Badge className="bg-green-600 text-white">Online</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Email Service</span>
                      <Badge className="bg-green-600 text-white">Online</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Avg Processing Time</span>
                      <span className="text-foreground font-medium">{stats.avgProcessingTime} days</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Applications Tab - Pass real applications and refresh callback */}
          <TabsContent value="applications" className="mt-6">
            <ApplicationsManagement applications={applications} onRefresh={fetchApplications} initialSelectedId={pendingAppId} onSelectedCleared={() => setPendingAppId(null)} />
          </TabsContent>

          {/* Conditions Tab */}
          <TabsContent value="conditions" className="mt-6">
            <ConditionsManagement applications={applications} />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6">
            <UsersManagement />
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-6">
            <AdminMessaging applications={applications} />
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="mt-6">
            <MetricsDashboard />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            <SystemSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
