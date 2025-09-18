"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Eye,
  Download,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  DollarSign,
} from "lucide-react"

interface Application {
  id: string
  propertyAddress: string
  loanAmount: number
  status: string
  submittedAt: string
  loanType: string
  progress: number
}

interface ApplicationsListProps {
  applications: Application[]
}

export function ApplicationsList({ applications }: ApplicationsListProps) {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)

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
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-2xl">{selectedApp.id}</CardTitle>
                <CardDescription className="text-muted-foreground text-lg">
                  {selectedApp.propertyAddress}
                </CardDescription>
              </div>
              <Badge className={getStatusColor(selectedApp.status)}>{formatStatus(selectedApp.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">Application Progress</span>
                <span className="text-sm text-muted-foreground">{selectedApp.progress}%</span>
              </div>
              <Progress value={selectedApp.progress} className="h-2 bg-muted" />
            </div>

            {/* Application Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            </div>

            {/* Timeline */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Application Timeline</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Application Submitted</p>
                    <p className="text-sm text-muted-foreground">{formatDate(selectedApp.submittedAt)}</p>
                  </div>
                </div>

                {selectedApp.status !== "submitted" && (
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-black" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Under Review</p>
                      <p className="text-sm text-muted-foreground">Application is being reviewed by our team</p>
                    </div>
                  </div>
                )}

                {selectedApp.status === "approved" && (
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Approved</p>
                      <p className="text-sm text-muted-foreground">Congratulations! Your loan has been approved</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
              <Button variant="outline" className="border-border text-foreground hover:bg-muted bg-transparent">
                <Download className="mr-2 h-4 w-4" />
                Download Application
              </Button>
              <Button variant="outline" className="border-border text-foreground hover:bg-muted bg-transparent">
                <MessageSquare className="mr-2 h-4 w-4" />
                Send Message
              </Button>
              {selectedApp.status === "approved" && (
                <Button className="bg-[#997100] hover:bg-[#b8850a] text-white">
                  <FileText className="mr-2 h-4 w-4" />
                  View Loan Documents
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Applications</h2>
          <p className="text-muted-foreground">Track the status of your loan applications</p>
        </div>
        <Button className="bg-[#997100] hover:bg-[#b8850a] text-white" asChild>
          <a href="/apply">
            <FileText className="mr-2 h-4 w-4" />
            New Application
          </a>
        </Button>
      </div>

      <div className="grid gap-6">
        {applications.map((app) => (
          <Card key={app.id} className="bg-card border-border hover:border-muted-foreground transition-colors">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">{app.id}</CardTitle>
                  <CardDescription className="text-muted-foreground">{app.propertyAddress}</CardDescription>
                </div>
                <Badge className={getStatusColor(app.status)}>
                  {getStatusIcon(app.status)}
                  <span className="ml-2">{formatStatus(app.status)}</span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-foreground">Progress</span>
                    <span className="text-sm text-muted-foreground">{app.progress}%</span>
                  </div>
                  <Progress value={app.progress} className="h-2 bg-muted" />
                </div>

                {/* Application Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Loan Amount</p>
                    <p className="text-foreground font-semibold">${app.loanAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Property Type</p>
                    <p className="text-foreground font-semibold">{app.loanType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Submitted</p>
                    <p className="text-foreground font-semibold">{formatDate(app.submittedAt)}</p>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-white bg-transparent"
                      onClick={() => setSelectedApp(app)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
