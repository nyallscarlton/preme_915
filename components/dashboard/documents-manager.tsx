"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, FileText, CheckCircle, Clock, AlertCircle, Download, Eye, Trash2 } from "lucide-react"

interface Application {
  id: string
  propertyAddress: string
  loanAmount: number
  status: string
  submittedAt: string
  loanType: string
  progress: number
}

interface DocumentsManagerProps {
  applications: Application[]
}

const mockDocuments = [
  {
    id: "1",
    applicationId: "PREME-2024-001",
    name: "W-2 Tax Forms 2023",
    type: "Income Verification",
    status: "verified",
    uploadedAt: "2024-01-15T10:30:00Z",
    size: "2.4 MB",
  },
  {
    id: "2",
    applicationId: "PREME-2024-001",
    name: "Bank Statements - December 2023",
    type: "Bank Statements",
    status: "pending",
    uploadedAt: "2024-01-16T14:20:00Z",
    size: "1.8 MB",
  },
  {
    id: "3",
    applicationId: "PREME-2024-002",
    name: "Property Appraisal Report",
    type: "Property Documentation",
    status: "verified",
    uploadedAt: "2024-01-12T09:15:00Z",
    size: "5.2 MB",
  },
]

const requiredDocumentTypes = [
  "Income Verification",
  "Bank Statements",
  "Credit Report",
  "Property Documentation",
  "Insurance Documentation",
  "Employment Verification",
  "Asset Documentation",
  "Identification",
]

export function DocumentsManager({ applications }: DocumentsManagerProps) {
  const [selectedApplication, setSelectedApplication] = useState<string>("all")
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  const filteredDocuments =
    selectedApplication === "all"
      ? mockDocuments
      : mockDocuments.filter((doc) => doc.applicationId === selectedApplication)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-green-600 text-white"
      case "pending":
        return "bg-yellow-600 text-black"
      case "rejected":
        return "bg-red-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-4 w-4" />
      case "pending":
        return <Clock className="h-4 w-4" />
      case "rejected":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const handleFileUpload = (docType: string) => {
    setUploadingDoc(docType)
    // Mock upload process
    setTimeout(() => {
      setUploadingDoc(null)
      // In a real app, this would add the document to the list
    }, 2000)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Document Management</h2>
          <p className="text-gray-400">Upload and manage your loan application documents</p>
        </div>
        <Select value={selectedApplication} onValueChange={setSelectedApplication}>
          <SelectTrigger className="w-64 bg-gray-800 border-gray-600 text-white">
            <SelectValue placeholder="Filter by application" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-600">
            <SelectItem value="all">All Applications</SelectItem>
            {applications.map((app) => (
              <SelectItem key={app.id} value={app.id}>
                {app.id} - {app.propertyAddress.split(",")[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Upload New Document */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Upload New Document</CardTitle>
          <CardDescription className="text-gray-400">Select a document type and upload your file</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {requiredDocumentTypes.map((docType) => (
              <Button
                key={docType}
                variant="outline"
                className="h-auto p-4 border-gray-600 text-white hover:bg-gray-800 flex flex-col items-center space-y-2 bg-transparent"
                onClick={() => handleFileUpload(docType)}
                disabled={uploadingDoc === docType}
              >
                {uploadingDoc === docType ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#997100]"></div>
                ) : (
                  <Upload className="h-6 w-6" />
                )}
                <span className="text-xs text-center">{docType}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Documents */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Uploaded Documents</CardTitle>
          <CardDescription className="text-gray-400">View and manage your uploaded documents</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No documents uploaded yet</p>
              <p className="text-sm text-gray-500">Upload your first document using the buttons above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <FileText className="h-8 w-8 text-[#997100]" />
                    <div>
                      <p className="font-medium text-white">{doc.name}</p>
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <span>{doc.type}</span>
                        <span>•</span>
                        <span>{doc.size}</span>
                        <span>•</span>
                        <span>{formatDate(doc.uploadedAt)}</span>
                      </div>
                      <p className="text-xs text-gray-500">Application: {doc.applicationId}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className={getStatusColor(doc.status)}>
                      {getStatusIcon(doc.status)}
                      <span className="ml-2 capitalize">{doc.status}</span>
                    </Badge>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Requirements */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Document Requirements</CardTitle>
          <CardDescription className="text-gray-400">Required documents for loan processing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredDocumentTypes.map((docType) => {
              const hasDoc = mockDocuments.some((doc) => doc.type === docType)
              return (
                <div key={docType} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span className="text-white">{docType}</span>
                  {hasDoc ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
