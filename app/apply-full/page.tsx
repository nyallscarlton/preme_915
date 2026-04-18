import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import LoanApplicationFullClient from "./_client"

// Route-segment config must live in a server component, not the client one.
// The inner client component (./_client.tsx) uses useSearchParams() which
// requires a Suspense boundary at the server/page layer for static generation.
export const dynamic = "force-dynamic"

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#997100]" /></div>}>
      <LoanApplicationFullClient />
    </Suspense>
  )
}
