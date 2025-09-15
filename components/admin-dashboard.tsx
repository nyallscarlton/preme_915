"use client"

import { useState } from "react"
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
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"
import { ApplicationsManagement } from "@/components/admin/applications-management"
import { UsersManagement } from "@/components/admin/users-management"
import { AdminMessaging } from "@/components/admin/admin-messaging"
import { SystemSettings } from "@/components/admin/system-settings"

// Mock data for admin dashboard
const mockApplications = [
  {
    id: "PREME-2024-001",
    applicantName: "John Smith",
    applicantEmail: "john.smith@email.com",
    propertyAddress: "123 Main Street, Beverly Hills, CA 90210",
    loanAmount: 450000,
    status: "under_review",
    submittedAt: "2024-01-15T10:30:00Z",
    loanType: "Single Family Home",
    progress: 65,
    assignedTo: "Sarah Johnson",
  },
  {
    id: "PREME-2024-002",
    applicantName: "Jane Doe",
    applicantEmail: "jane.doe@email.com",
    propertyAddress: "456 Oak Avenue, Manhattan Beach, CA 90266",
    loanAmount: 750000,
    status: "approved",
    submittedAt: "2024-01-10T14:20:00Z",
    loanType: "Condominium",
    progress: 100,
    assignedTo: "Mike Chen",
  },
  {
    id: "PREME-2024-003",
    applicantName: "Robert Wilson",
    applicantEmail: "robert.wilson@email.com",
    propertyAddress: "789 Pine Street, Santa Monica, CA 90401",
    loanAmount: 625000,
    status: "submitted",
    submittedAt: "2024-01-16T09:15:00Z",
    loanType: "Townhouse",
    progress: 25,
    assignedTo: null,
  },
]

const mockStats = {
  totalApplications: 15,
  pendingReview: 8,
  approved: 5,
  rejected: 2,
  totalLoanVolume: 12500000,
  avgProcessingTime: 7.5,
  approvalRate: 71.4,
}

export function AdminDashboard() {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

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
                <Badge className="bg-[#997100] text-black">Admin Portal</Badge>
              </div>
              <div className="hidden md:block">
                <p className="text-sm text-muted-foreground">Welcome, {user?.firstName || user?.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage loan applications and system operations</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-muted border border-border">
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
                  <div className="text-2xl font-bold text-foreground">{mockStats.totalApplications}</div>
                  <p className="text-xs text-muted-foreground">All time applications</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{mockStats.pendingReview}</div>
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
                    ${(mockStats.totalLoanVolume / 1000000).toFixed(1)}M
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
                  <div className="text-2xl font-bold text-foreground">{mockStats.approvalRate}%</div>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
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
                <div className="space-y-4">
                  {mockApplications.slice(0, 5).map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border text-foreground hover:bg-muted bg-transparent"
                          onClick={() => setActiveTab("applications")}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
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
                      <span className="text-foreground font-medium">{mockStats.avgProcessingTime} days</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="mt-6">
            <ApplicationsManagement applications={mockApplications} />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6">
            <UsersManagement />
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-6">
            <AdminMessaging applications={mockApplications} />
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
