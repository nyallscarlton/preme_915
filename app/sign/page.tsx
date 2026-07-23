import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import SignDocumentClient from "./_client"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Review & Sign Your Application | Preme Home Loans",
}

export default function SignPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
          <Loader2 className="h-8 w-8 animate-spin text-[#997100]" />
        </div>
      }
    >
      <SignDocumentClient />
    </Suspense>
  )
}
