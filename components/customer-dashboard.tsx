"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DollarSign,
  FileText,
  User,
  MessageSquare,
  Bell,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"
import { PortalToggle } from "@/components/portal-toggle"
import { ApplicationsList } from "@/components/dashboard/applications-list"
import { DocumentsManager } from "@/components/dashboard/documents-manager"
import { MessagingCenter } from "@/components/dashboard/messaging-center"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import type { LoanApplication } from "@/lib/applications-service"

export function CustomerDashboard() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [applications, setApplications] = useState<LoanApplication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const response = await fetch("/api/applications")
        const data = await response.json()
        if (data.success && data.applications) {
          setApplications(data.applications)
        }
      } catch {
        // Failed to load
      } finally {
        setLoading(false)
      }
    }

    fetchApplications()
  }, [])

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

  // Derive stats from real data
  const totalLoanAmount = applications.reduce(
    (sum, app) => sum + (app.loan_amount || 0),
    0
  )
  const approvedAmount = applications
    .filter((app) => app.status === "approved")
    .reduce((sum, app) => sum + (app.loan_amount || 0), 0)

  // Map to the shape ApplicationsList expects
  const mappedApplications = applications.map((app) => ({
    id: app.application_number || app.id,
    propertyAddress: [app.property_address, app.property_city, app.property_state]
      .filter(Boolean)
      .join(", ") || "No address",
    loanAmount: app.loan_amount || 0,
    status: app.status,
    submittedAt: app.submitted_at || app.created_at || new Date().toISOString(),
    loanType: app.loan_type || app.property_type || "Loan",
    progress:
      app.status === "approved"
        ? 100
        : app.status === "under_review"
          ? 65
          : app.status === "submitted"
            ? 30
            : app.status === "rejected"
              ? 100
              : 10,
  }))

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
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
                <p className="text-sm text-muted-foreground">
                  Welcome back, {user?.firstName || user?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <PortalToggle />
              <Button
                variant="outline"
                className="border-border text-muted-foreground hover:bg-muted bg-transparent"
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Loan Application Portal</h1>
          <p className="text-muted-foreground">Manage your loan applications and track progress</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-muted border border-border">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <User className="w-4 h-4 mr-2" />
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
              value="documents"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <Upload className="w-4 h-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Applications
                  </CardTitle>
                  <FileText className="h-4 w-4 text-[#997100]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{applications.length}</div>
                  <p className="text-xs text-muted-foreground">Active loan applications</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Loan Amount
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-[#997100]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    ${totalLoanAmount > 0 ? (totalLoanAmount / 1000).toFixed(0) + "K" : "0"}
                  </div>
                  <p className="text-xs text-muted-foreground">Across all applications</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Approved Amount
                  </CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    ${approvedAmount > 0 ? (approvedAmount / 1000).toFixed(0) + "K" : "0"}
                  </div>
                  <p className="text-xs text-muted-foreground">Ready for closing</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Under Review
                  </CardTitle>
                  <Clock className="h-4 w-4 text-[#997100]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {applications.filter((a) => a.status === "under_review").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Being processed</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Applications */}
            {applications.length > 0 ? (
              <Card className="bg-card border-border mb-6">
                <CardHeader>
                  <CardTitle className="text-foreground">Recent Applications</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Your latest loan application activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mappedApplications.slice(0, 5).map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-4 bg-muted rounded-lg"
                      >
                        <div className="flex items-center space-x-4">
                          {getStatusIcon(app.status)}
                          <div>
                            <p className="font-medium text-foreground">{app.id}</p>
                            <p className="text-sm text-muted-foreground">{app.propertyAddress}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-medium text-foreground">
                              ${app.loanAmount.toLocaleString()}
                            </p>
                            <Badge className={getStatusColor(app.status)}>
                              {formatStatus(app.status)}
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-border text-foreground hover:bg-muted bg-transparent"
                            onClick={() => setActiveTab("applications")}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border mb-6">
                <CardContent className="p-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No Applications Yet
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Get started by submitting your first loan application.
                  </p>
                  <Button className="bg-[#997100] hover:bg-[#b8850a] text-black" asChild>
                    <Link href="/start?next=/apply">
                      <FileText className="mr-2 h-4 w-4" />
                      Start Application
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Quick Actions</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Common tasks and shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    className="bg-[#997100] hover:bg-[#b8850a] text-black font-semibold"
                    asChild
                  >
                    <Link href="/start?next=/apply">
                      <FileText className="mr-2 h-4 w-4" />
                      New Application
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border text-foreground hover:bg-muted bg-transparent"
                    onClick={() => setActiveTab("documents")}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Documents
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border text-foreground hover:bg-muted bg-transparent"
                    onClick={() => setActiveTab("messages")}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Send Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="mt-6">
            <ApplicationsList applications={mappedApplications} />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-6">
            <DocumentsManager applications={mappedApplications} />
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-6">
            <MessagingCenter applications={mappedApplications} />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-6">
            <NotificationsPanel notifications={[]} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
