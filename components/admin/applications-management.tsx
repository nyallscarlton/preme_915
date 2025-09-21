"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Eye,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Download,
  User,
  Calendar,
  DollarSign,
  Archive,
  ArchiveRestore,
} from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/browserClient"

interface Application {
  id: string
  applicantName: string
  applicantEmail: string
  propertyAddress: string
  loanAmount: number
  status: string
  submittedAt: string
  loanType: string
  progress: number
  assignedTo: string | null
  archived?: boolean
}

interface ApplicationsManagementProps {
  applications: Application[]
}

export function ApplicationsManagement({ applications }: ApplicationsManagementProps) {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [reviewNotes, setReviewNotes] = useState("")
  const [archivedFilter, setArchivedFilter] = useState<string>("active")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    const matchesSearch =
      app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase())
    const isArchived = !!app.archived
    const matchesArchived = archivedFilter === "all" || (archivedFilter === "active" ? !isArchived : isArchived)
    return matchesStatus && matchesSearch && matchesArchived
  })

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
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleStatusUpdate = (appId: string, newStatus: string) => {
    console.log(`Updating application ${appId} to status: ${newStatus}`)
    console.log(`Review notes: ${reviewNotes}`)
    setReviewNotes("")
  }

  const toggleArchive = async (appId: string, archived: boolean) => {
    try {
      setUpdatingId(appId)
      const { error } = await supabaseBrowser
        .from("applications")
        .update({ archived })
        .eq("id", appId)
      if (error) throw error
      // Optimistic local update
      if (selectedApp && selectedApp.id === appId) {
        setSelectedApp({ ...selectedApp, archived })
      }
      const idx = applications.findIndex((a) => a.id === appId)
      if (idx !== -1) {
        applications[idx] = { ...applications[idx], archived }
      }
    } catch (e) {
      console.error("Failed to update archive state", e)
    } finally {
      setUpdatingId(null)
    }
  }

  if (selectedApp) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-muted bg-transparent"
            onClick={() => setSelectedApp(null)}
          >
            ← Back to Applications
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" className="border-border text-foreground hover:bg-muted bg-transparent">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" className="border-border text-foreground hover:bg-muted bg-transparent">
              <MessageSquare className="mr-2 h-4 w-4" />
              Message Applicant
            </Button>
            {selectedApp.archived ? (
              <Button
                variant="outline"
                disabled={updatingId === selectedApp.id}
                className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white bg-transparent"
                onClick={() => toggleArchive(selectedApp.id, false)}
              >
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Unarchive
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={updatingId === selectedApp.id}
                className="border-gray-600 text-gray-300 hover:bg-gray-700 bg-transparent"
                onClick={() => toggleArchive(selectedApp.id, true)}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Application Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground text-2xl">{selectedApp.id}</CardTitle>
                    <CardDescription className="text-muted-foreground text-lg">
                      {selectedApp.applicantName} • {selectedApp.applicantEmail}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(selectedApp.status)}>
                    {getStatusIcon(selectedApp.status)}
                    <span className="ml-2">{formatStatus(selectedApp.status)}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Application Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Loan Amount</span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">${selectedApp.loanAmount.toLocaleString()}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">Property Type</span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">{selectedApp.loanType}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Submitted</span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">{formatDate(selectedApp.submittedAt)}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="text-sm">Assigned To</span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">{selectedApp.assignedTo || "Unassigned"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents Section */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Documents</CardTitle>
                <CardDescription className="text-muted-foreground">Uploaded application documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {["Income Verification", "Bank Statements", "Credit Report", "Property Appraisal"].map((doc) => (
                    <div key={doc} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-[#997100]" />
                        <span className="text-foreground">{doc}</span>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Review Panel */}
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Review Application</CardTitle>
                <CardDescription className="text-muted-foreground">Update status and add notes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Update Status</label>
                  <Select defaultValue={selectedApp.status}>
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Review Notes</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="bg-card border-border text-foreground min-h-[120px]"
                    placeholder="Add your review notes here..."
                  />
                </div>

                <div className="space-y-2">
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleStatusUpdate(selectedApp.id, "approved")}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve Application
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-black bg-transparent"
                    onClick={() => handleStatusUpdate(selectedApp.id, "under_review")}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Request More Info
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-red-600 text-red-600 hover:bg-red-600 hover:text-white bg-transparent"
                    onClick={() => handleStatusUpdate(selectedApp.id, "rejected")}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Applications Management</h2>
          <p className="text-muted-foreground">Review and manage loan applications</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search applications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card border-border text-foreground"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-card border-border text-foreground">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={archivedFilter} onValueChange={setArchivedFilter}>
              <SelectTrigger className="w-48 bg-card border-border text-foreground">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Archived" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      <div className="grid gap-4">
        {filteredApplications.map((app) => (
          <Card key={app.id} className="bg-card border-border hover:border-muted-foreground transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(app.status)}
                  <div>
                    <h3 className="font-semibold text-foreground">{app.id}</h3>
                    <p className="text-sm text-muted-foreground">
                      {app.applicantName} • {app.applicantEmail}
                    </p>
                    <p className="text-sm text-muted-foreground">{app.propertyAddress}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-foreground">${app.loanAmount.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(app.submittedAt)}</p>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(app.status)}>{formatStatus(app.status)}</Badge>
                      {app.archived && <Badge className="bg-gray-700 text-white">Archived</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-black bg-transparent"
                      onClick={() => setSelectedApp(app)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                    {app.archived ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingId === app.id}
                        className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white bg-transparent"
                        onClick={() => toggleArchive(app.id, false)}
                      >
                        <ArchiveRestore className="h-4 w-4 mr-1" />
                        Unarchive
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingId === app.id}
                        className="border-gray-600 text-gray-300 hover:bg-gray-700 bg-transparent"
                        onClick={() => toggleArchive(app.id, true)}
                      >
                        <Archive className="h-4 w-4 mr-1" />
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredApplications.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No applications found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
