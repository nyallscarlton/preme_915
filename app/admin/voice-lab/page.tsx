import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import VoiceLab from "@/app/pipeline/voice-lab/page"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Voice Lab | Preme Admin",
}

// Same Voice Lab as the pipeline UI, surfaced inside the www admin.
// Route is admin-gated by middleware (profiles.role === "admin").
export default function AdminVoiceLabPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Admin
      </Link>
      <VoiceLab />
    </div>
  )
}
