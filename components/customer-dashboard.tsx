"use client"

import { useState } from "react"
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
import { ApplicationsList } from "@/components/dashboard/applications-list"
import { DocumentsManager } from "@/components/dashboard/documents-manager"
import { MessagingCenter } from "@/components/dashboard/messaging-center"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"

// Mock data for dashboard
const mockApplications = [
  {
    id: "PREME-2024-001",
    propertyAddress: "123 Main Street, Beverly Hills, CA 90210",
    loanAmount: 450000,
    status: "under_review",
    submittedAt: "2024-01-15T10:30:00Z",
    loanType: "Single Family Home",
    progress: 65,
  },
  {
    id: "PREME-2024-002",
    propertyAddress: "456 Oak Avenue, Manhattan Beach, CA 90266",
    loanAmount: 750000,
    status: "approved",
    submittedAt: "2024-01-10T14:20:00Z",
    loanType: "Condominium",
    progress: 100,
  },
]

const mockNotifications = [
  {
    id: "1",
    type: "status_update",
    title: "Application Status Updated",
    message: "Your application PREME-2024-001 has moved to 'Under Review' status.",
    isRead: false,
    createdAt: "2024-01-16T09:15:00Z",
  },
  {
    id: "2",
    type: "document_request",
    title: "Additional Documents Required",
    message: "Please upload your recent bank statements for application PREME-2024-001.",
    isRead: false,
    createdAt: "2024-01-15T16:45:00Z",
  },
  {
    id: "3",
    type: "approval",
    title: "Application Approved!",
    message: "Congratulations! Your application PREME-2024-002 has been approved.",
    isRead: true,
    createdAt: "2024-01-12T11:30:00Z",
  },
]

export function CustomerDashboard() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState("dashboard")

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

  const totalLoanAmount = mockApplications.reduce((sum, app) => sum + app.loanAmount, 0)
  const unreadNotifications = mockNotifications.filter((n) => !n.isRead).length

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center">
                <div className="relative">
                  <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                  <span className="text-2xl font-bold tracking-wide text-foreground">PREME</span>
                </div>
              </Link>
              <div className="hidden md:block">
                <p className="text-sm text-muted-foreground">Welcome back, {user?.firstName || user?.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/account"
                className="text-sm text-[#997100] hover:text-[#b8850a] underline"
              >
                Account Settings
              </Link>
              {unreadNotifications > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative text-muted-foreground hover:text-foreground"
                  onClick={() => setActiveTab("notifications")}
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 bg-[#997100] text-black text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                </Button>
              )}
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
              className="data-[state=active]:bg-[#997100] data-[state=active]:text-black text-muted-foreground relative"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notifications
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
                  <FileText className="h-4 w-4 text-[#997100]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{mockApplications.length}</div>
                  <p className="text-xs text-muted-foreground">Active loan applications</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Loan Amount</CardTitle>
                  <DollarSign className="h-4 w-4 text-[#997100]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">${(totalLoanAmount / 1000000).toFixed(2)}M</div>
                  <p className="text-xs text-muted-foreground">Across all applications</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Approved Amount</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">$750K</div>
                  <p className="text-xs text-muted-foreground">Ready for closing</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Notifications</CardTitle>
                  <Bell className="h-4 w-4 text-[#997100]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{unreadNotifications}</div>
                  <p className="text-xs text-muted-foreground">Unread messages</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Applications */}
            <Card className="bg-card border-border mb-6">
              <CardHeader>
                <CardTitle className="text-foreground">Recent Applications</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Your latest loan application activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockApplications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(app.status)}
                        <div>
                          <p className="font-medium text-foreground">{app.id}</p>
                          <p className="text-sm text-muted-foreground">{app.propertyAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="font-medium text-foreground">${app.loanAmount.toLocaleString()}</p>
                          <Badge className={getStatusColor(app.status)}>{formatStatus(app.status)}</Badge>
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

            {/* Quick Actions */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Quick Actions</CardTitle>
                <CardDescription className="text-muted-foreground">Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button className="bg-[#997100] hover:bg-[#b8850a] text-black font-semibold" asChild>
                    <Link href="/apply">
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
            <ApplicationsList applications={mockApplications} />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-6">
            <DocumentsManager applications={mockApplications} />
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-6">
            <MessagingCenter applications={mockApplications} />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-6">
            <NotificationsPanel notifications={mockNotifications} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
