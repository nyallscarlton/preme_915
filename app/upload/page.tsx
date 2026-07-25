import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import UploadClient from "./_client"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Upload Your Documents | Preme Home Loans",
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
          <Loader2 className="h-8 w-8 animate-spin text-[#997100]" />
        </div>
      }
    >
      <UploadClient />
    </Suspense>
  )
}
