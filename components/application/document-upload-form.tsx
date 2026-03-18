"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Upload, FileText, CheckCircle, Loader2, Trash2, ExternalLink } from "lucide-react"

interface DocumentUploadFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: Record<string, unknown>) => void
  initialData: Record<string, unknown>
  applicationId?: string
  guestToken?: string
}

interface UploadedDoc {
  name: string
  path: string
  url: string
  category: string
  created_at: string
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

export function DocumentUploadForm({
  onNext,
  onPrevious,
  onDataChange,
  initialData,
  applicationId,
  guestToken,
}: DocumentUploadFormProps) {
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, UploadedDoc>>(
    (initialData.uploadedDocs as Record<string, UploadedDoc>) || {}
  )
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [loadingDocs, setLoadingDocs] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Fetch already-uploaded documents on mount
  const fetchExistingDocuments = useCallback(async () => {
    if (!applicationId) return
    setLoadingDocs(true)
    try {
      const params = new URLSearchParams({ applicationId })
      if (guestToken) params.set("guest_token", guestToken)

      const res = await fetch(`/api/documents?${params.toString()}`)
      if (!res.ok) return

      const { documents } = await res.json()
      if (!documents || !Array.isArray(documents)) return

      const docsMap: Record<string, UploadedDoc> = { ...uploadedDocs }
      for (const doc of documents as UploadedDoc[]) {
        docsMap[doc.category] = doc
      }
      setUploadedDocs(docsMap)
      onDataChange({ uploadedDocs: docsMap })
    } catch {
      // Silently fail — user can still upload
    } finally {
      setLoadingDocs(false)
    }
  }, [applicationId, guestToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchExistingDocuments()
  }, [fetchExistingDocuments])

  const handleFileSelect = (docId: string) => {
    fileInputRefs.current[docId]?.click()
  }

  const handleFileUpload = async (docId: string, file: File) => {
    if (!file) return

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be under 10MB.")
      return
    }

    setUploading(docId)
    setError("")
    setUploadProgress((prev) => ({ ...prev, [docId]: 0 }))

    try {
      // Simulate progress updates during upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const current = prev[docId] || 0
          if (current >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return { ...prev, [docId]: current + 10 }
        })
      }, 200)

      if (applicationId) {
        // Upload via API route (works for both authenticated and guest users)
        const formData = new FormData()
        formData.append("file", file)
        formData.append("applicationId", applicationId)
        formData.append("category", docId)
        if (guestToken) formData.append("guest_token", guestToken)

        const res = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        })

        clearInterval(progressInterval)

        if (!res.ok) {
          const result = await res.json()
          throw new Error(result.error || "Upload failed")
        }

        const { document } = await res.json()

        setUploadProgress((prev) => ({ ...prev, [docId]: 100 }))

        const updatedDocs = {
          ...uploadedDocs,
          [docId]: document as UploadedDoc,
        }
        setUploadedDocs(updatedDocs)
        onDataChange({ uploadedDocs: updatedDocs })
      } else {
        // No applicationId yet — store file reference locally for later upload
        // This handles the case where the application hasn't been created yet
        clearInterval(progressInterval)
        setUploadProgress((prev) => ({ ...prev, [docId]: 100 }))

        const updatedDocs = {
          ...uploadedDocs,
          [docId]: {
            name: file.name,
            path: "",
            url: "",
            category: docId,
            created_at: new Date().toISOString(),
          },
        }
        setUploadedDocs(updatedDocs)
        onDataChange({ uploadedDocs: updatedDocs })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.")
    } finally {
      setUploading(null)
      // Clear progress after a short delay
      setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev }
          delete next[docId]
          return next
        })
      }, 1500)
    }
  }

  const handleDelete = async (docId: string) => {
    const doc = uploadedDocs[docId]
    if (!doc) return

    // If there's no path (local-only reference), just remove from state
    if (!doc.path) {
      const updatedDocs = { ...uploadedDocs }
      delete updatedDocs[docId]
      setUploadedDocs(updatedDocs)
      onDataChange({ uploadedDocs: updatedDocs })
      return
    }

    setDeleting(docId)
    setError("")

    try {
      const params = new URLSearchParams({ path: doc.path })
      if (applicationId) params.set("applicationId", applicationId)
      if (guestToken) params.set("guest_token", guestToken)

      const res = await fetch(`/api/documents?${params.toString()}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || "Delete failed")
      }

      const updatedDocs = { ...uploadedDocs }
      delete updatedDocs[docId]
      setUploadedDocs(updatedDocs)
      onDataChange({ uploadedDocs: updatedDocs })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document.")
    } finally {
      setDeleting(null)
    }
  }

  const renderDocRow = (doc: { id: string; name: string; description: string }) => {
    const uploaded = uploadedDocs[doc.id]
    const isUploaded = !!uploaded
    const isUploading = uploading === doc.id
    const isDeleting = deleting === doc.id
    const progress = uploadProgress[doc.id]

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
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-xs text-green-600">{uploaded.name}</p>
                {uploaded.url && (
                  <a
                    href={uploaded.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center"
                  >
                    <ExternalLink className="h-3 w-3 mr-0.5" />
                    View
                  </a>
                )}
              </div>
            )}
            {isUploading && progress !== undefined && (
              <div className="mt-2 w-full max-w-xs">
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{progress}%</p>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {isUploaded && (
              <Button
                onClick={() => handleDelete(doc.id)}
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
            <input
              type="file"
              ref={(el) => { fileInputRefs.current[doc.id] = el }}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(doc.id, file)
                // Reset input so the same file can be re-selected
                if (e.target) e.target.value = ""
              }}
            />
            <Button
              onClick={() => handleFileSelect(doc.id)}
              variant={isUploaded ? "secondary" : "outline"}
              size="sm"
              disabled={isUploading || isDeleting}
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

          {loadingDocs && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading existing documents...
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
                  Uploading now may speed up review. Max file size: 10MB.
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
