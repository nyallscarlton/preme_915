import { createClient } from "@supabase/supabase-js"
import { SequencesClient } from "./sequences-client"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "preme" } }
)

export default async function SequencesPage() {
  const [seqRes, stepsRes, templatesRes, enrollmentsRes] = await Promise.all([
    supabase.from("sequences").select("*").order("name"),
    supabase.from("sequence_steps").select("*, message_templates(id, slug, name, body)").order("step_number"),
    supabase.from("message_templates").select("*").order("name"),
    supabase
      .from("sequence_enrollments")
      .select("sequence_id, status")
      .in("status", ["active", "paused"]),
  ])

  // Count active enrollments per sequence
  const enrollmentCounts: Record<string, { active: number; paused: number }> = {}
  for (const e of enrollmentsRes.data || []) {
    if (!enrollmentCounts[e.sequence_id]) enrollmentCounts[e.sequence_id] = { active: 0, paused: 0 }
    if (e.status === "active") enrollmentCounts[e.sequence_id].active++
    else if (e.status === "paused") enrollmentCounts[e.sequence_id].paused++
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sequences</h1>
        <p className="text-sm text-gray-500">Manage follow-up sequences, steps, timing, and templates</p>
      </div>
      <SequencesClient
        sequences={seqRes.data || []}
        steps={stepsRes.data || []}
        templates={templatesRes.data || []}
        enrollmentCounts={enrollmentCounts}
      />
    </div>
  )
}
