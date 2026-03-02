"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Upload, FileText, CheckCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface DocumentUploadFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: Record<string, unknown>) => void
  initialData: Record<string, unknown>
}

const requiredDocuments = [
  { id: "income_verification", name: "Income Verification", description: "W-2 forms, pay stubs, tax returns" },
  { id: "credit_report", name: "Credit Report", description: "Recent credit report from all three bureaus" },
  { id: "bank_statement", name: "Bank Statements", description: "Last 3 months of bank statements" },
  { id: "identification", name: "Identification", description: "Government-issued photo ID" },
]

const optionalDocuments = [
  { id: "appraisal", name: "Property Appraisal", description: "Professional property appraisal (if available)" },
  { id: "insurance", name: "Insurance Documentation", description: "Homeowners insurance policy" },
  { id: "employment_verification", name: "Employment Verification", description: "Letter from employer" },
  { id: "asset_documentation", name: "Asset Documentation", description: "Investment accounts, retirement funds" },
]

export function DocumentUploadForm({ onNext, onPrevious, onDataChange, initialData }: DocumentUploadFormProps) {
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { name: string; path: string }>>(
    (initialData.uploadedDocs as Record<string, { name: string; path: string }>) || {}
  )
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState("")
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleFileSelect = (docId: string) => {
    fileInputRefs.current[docId]?.click()
  }

  const handleFileUpload = async (docId: string, file: File) => {
    if (!file) return
    setUploading(docId)
    setError("")

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Use user ID or "guest" as folder prefix
      const folder = user?.id || "guest"
      const fileName = `${Date.now()}-${file.name}`
      const storagePath = `${folder}/${docId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        setUploading(null)
        return
      }

      const updatedDocs = {
        ...uploadedDocs,
        [docId]: { name: file.name, path: storagePath },
      }
      setUploadedDocs(updatedDocs)
      onDataChange({ uploadedDocs: updatedDocs })
    } catch {
      setError("Upload failed. Please try again.")
    } finally {
      setUploading(null)
    }
  }

  const renderDocRow = (doc: { id: string; name: string; description: string }) => {
    const isUploaded = !!uploadedDocs[doc.id]
    const isUploading = uploading === doc.id

    return (
      <div key={doc.id} className="border border-border rounded-lg p-4 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <Label className="font-medium text-foreground">{doc.name}</Label>
              {isUploaded && <CheckCircle className="h-4 w-4 text-green-600" />}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
            {isUploaded && (
              <p className="text-xs text-green-600 mt-1">{uploadedDocs[doc.id].name}</p>
            )}
          </div>
          <div>
            <input
              type="file"
              ref={(el) => { fileInputRefs.current[doc.id] = el }}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(doc.id, file)
              }}
            />
            <Button
              onClick={() => handleFileSelect(doc.id)}
              variant={isUploaded ? "secondary" : "outline"}
              size="sm"
              disabled={isUploading}
              className={
                isUploaded
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "border-border text-foreground hover:bg-muted bg-transparent"
              }
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : isUploaded ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Replace
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
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Document Upload</CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload documents now or submit them later. You can complete your application without uploading all documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                i
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Documents Can Be Submitted Later</h4>
                <p className="text-sm text-blue-800">
                  You can proceed with your application and upload documents later through your portal.
                  Uploading now may speed up review.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Recommended Documents</h3>
            <div className="space-y-4">
              {requiredDocuments.map(renderDocRow)}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-foreground">Optional Documents</h3>
            <div className="space-y-4">
              {optionalDocuments.map(renderDocRow)}
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
