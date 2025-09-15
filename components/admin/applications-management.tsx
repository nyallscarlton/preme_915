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
} from "lucide-react"

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
}

interface ApplicationsManagementProps {
  applications: Application[]
}

export function ApplicationsManagement({ applications }: ApplicationsManagementProps) {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [reviewNotes, setReviewNotes] = useState("")

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    const matchesSearch =
      app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
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
    // In a real app, this would update the application status in the database
    console.log(`Updating application ${appId} to status: ${newStatus}`)
    console.log(`Review notes: ${reviewNotes}`)
    setReviewNotes("")
  }

  if (selectedApp) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-800 bg-transparent"
            onClick={() => setSelectedApp(null)}
          >
            ← Back to Applications
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-800 bg-transparent">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-800 bg-transparent">
              <MessageSquare className="mr-2 h-4 w-4" />
              Message Applicant
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Application Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white text-2xl">{selectedApp.id}</CardTitle>
                    <CardDescription className="text-gray-400 text-lg">
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
                    <div className="flex items-center space-x-2 text-gray-400">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Loan Amount</span>
                    </div>
                    <p className="text-xl font-semibold text-white">${selectedApp.loanAmount.toLocaleString()}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-gray-400">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">Property Type</span>
                    </div>
                    <p className="text-xl font-semibold text-white">{selectedApp.loanType}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Submitted</span>
                    </div>
                    <p className="text-xl font-semibold text-white">{formatDate(selectedApp.submittedAt)}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-gray-400">
                      <User className="h-4 w-4" />
                      <span className="text-sm">Assigned To</span>
                    </div>
                    <p className="text-xl font-semibold text-white">{selectedApp.assignedTo || "Unassigned"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">Property Address</span>
                  </div>
                  <p className="text-lg text-white">{selectedApp.propertyAddress}</p>
                </div>
              </CardContent>
            </Card>

            {/* Documents Section */}
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Documents</CardTitle>
                <CardDescription className="text-gray-400">Uploaded application documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {["Income Verification", "Bank Statements", "Credit Report", "Property Appraisal"].map((doc) => (
                    <div key={doc} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-[#997100]" />
                        <span className="text-white">{doc}</span>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
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
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Review Application</CardTitle>
                <CardDescription className="text-gray-400">Update status and add notes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Update Status</label>
                  <Select defaultValue={selectedApp.status}>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Review Notes</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white min-h-[120px]"
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

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Application Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Application Submitted</p>
                      <p className="text-xs text-gray-400">{formatDate(selectedApp.submittedAt)}</p>
                    </div>
                  </div>

                  {selectedApp.status !== "submitted" && (
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center">
                        <Clock className="h-3 w-3 text-black" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Under Review</p>
                        <p className="text-xs text-gray-400">Review in progress</p>
                      </div>
                    </div>
                  )}

                  {selectedApp.status === "approved" && (
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Approved</p>
                        <p className="text-xs text-gray-400">Application approved</p>
                      </div>
                    </div>
                  )}
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
          <h2 className="text-2xl font-bold text-white">Applications Management</h2>
          <p className="text-gray-400">Review and manage loan applications</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search applications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-600 text-white"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-600 text-white">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      <div className="grid gap-4">
        {filteredApplications.map((app) => (
          <Card key={app.id} className="bg-gray-900 border-gray-800 hover:border-gray-600 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(app.status)}
                  <div>
                    <h3 className="font-semibold text-white">{app.id}</h3>
                    <p className="text-sm text-gray-400">
                      {app.applicantName} • {app.applicantEmail}
                    </p>
                    <p className="text-sm text-gray-500">{app.propertyAddress}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-white">${app.loanAmount.toLocaleString()}</p>
                    <p className="text-sm text-gray-400">{formatDate(app.submittedAt)}</p>
                    <Badge className={getStatusColor(app.status)}>{formatStatus(app.status)}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-black bg-transparent"
                    onClick={() => setSelectedApp(app)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Review
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredApplications.length === 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No applications found</p>
            <p className="text-sm text-gray-500">Try adjusting your search or filter criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
