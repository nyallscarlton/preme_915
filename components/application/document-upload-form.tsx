"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Upload, FileText, CheckCircle } from "lucide-react"

interface DocumentUploadFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: any) => void
  initialData: any
}

const requiredDocuments = [
  { id: "income", name: "Income Verification", description: "W-2 forms, pay stubs, tax returns" },
  { id: "credit", name: "Credit Report", description: "Recent credit report from all three bureaus" },
  { id: "bank", name: "Bank Statements", description: "Last 3 months of bank statements" },
  { id: "id", name: "Identification", description: "Government-issued photo ID" },
]

const optionalDocuments = [
  { id: "appraisal", name: "Property Appraisal", description: "Professional property appraisal (if available)" },
  { id: "insurance", name: "Insurance Documentation", description: "Homeowners insurance policy" },
  { id: "employment", name: "Employment Verification", description: "Letter from employer" },
  { id: "assets", name: "Asset Documentation", description: "Investment accounts, retirement funds" },
]

export function DocumentUploadForm({ onNext, onPrevious, onDataChange, initialData }: DocumentUploadFormProps) {
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>(initialData.uploadedDocs || {})

  const handleFileUpload = (docId: string) => {
    // Mock file upload - in a real app, this would handle actual file uploads
    const updatedDocs = { ...uploadedDocs, [docId]: true }
    setUploadedDocs(updatedDocs)
    onDataChange({ uploadedDocs: updatedDocs })
  }

  const canProceed = true // Always allow proceeding

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Document Upload</CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload documents now or submit them later. You can complete your application without uploading all
            documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                i
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Documents Can Be Submitted Later</h4>
                <p className="text-sm text-blue-800">
                  You can proceed with your application and upload documents later through your application portal.
                  However, uploading documents now may speed up the review process.
                </p>
              </div>
            </div>
          </div>

          {/* Required Documents */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Recommended Documents</h3>
            <div className="space-y-4">
              {requiredDocuments.map((doc) => (
                <div key={doc.id} className="border border-border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <Label className="font-medium text-foreground">{doc.name}</Label>
                        {uploadedDocs[doc.id] && <CheckCircle className="h-4 w-4 text-green-600" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
                    </div>
                    <Button
                      onClick={() => handleFileUpload(doc.id)}
                      variant={uploadedDocs[doc.id] ? "secondary" : "outline"}
                      size="sm"
                      className={
                        uploadedDocs[doc.id]
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "border-border text-foreground hover:bg-muted bg-transparent"
                      }
                    >
                      {uploadedDocs[doc.id] ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Uploaded
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Documents */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Optional Documents</h3>
            <div className="space-y-4">
              {optionalDocuments.map((doc) => (
                <div key={doc.id} className="border border-border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <Label className="font-medium text-foreground">{doc.name}</Label>
                        {uploadedDocs[doc.id] && <CheckCircle className="h-4 w-4 text-green-600" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
                    </div>
                    <Button
                      onClick={() => handleFileUpload(doc.id)}
                      variant={uploadedDocs[doc.id] ? "secondary" : "outline"}
                      size="sm"
                      className={
                        uploadedDocs[doc.id]
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "border-border text-foreground hover:bg-muted bg-transparent"
                      }
                    >
                      {uploadedDocs[doc.id] ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Uploaded
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-6">
            <Button
              onClick={onPrevious}
              variant="outline"
              className="border-border text-foreground hover:bg-muted bg-transparent font-semibold px-8"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <div className="flex space-x-3">
              <Button
                onClick={onNext}
                variant="outline"
                className="border-border text-foreground hover:bg-muted bg-transparent font-semibold px-8"
              >
                Skip for Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                onClick={onNext}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
