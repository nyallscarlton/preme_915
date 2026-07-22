import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import Calls from "@/app/pipeline/calls/page"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Calls | Preme Admin",
}

// Same call history as the pipeline UI, surfaced inside the www admin.
// Route is admin-gated by middleware (profiles.role === "admin").
export default function AdminCallsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Admin
      </Link>
      <Calls />
    </div>
  )
}
