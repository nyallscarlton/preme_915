import { createClient } from "@supabase/supabase-js"

const HEARTBEAT_PATTERNS = [
  /ran successfully/i,
  /no issues found/i,
  /heartbeat/i,
  /health check passed/i,
  /all systems green/i,
  /nothing to report/i,
  /cycle complete/i,
  /routine run/i,
]

export async function writeAgentMemory(params: {
  agent_name: string
  memory_type: "finding" | "action" | "escalation" | "context" | "decision"
  summary: string
  details?: object
  entity?: string
  importance?: number
}) {
  // Reject heartbeat-style writes at the helper level
  if (
    (params.importance ?? 0.5) < 0.3 &&
    HEARTBEAT_PATTERNS.some((p) => p.test(params.summary))
  ) {
    console.warn(
      `[agent-memory] Rejected heartbeat-style write from ${params.agent_name}: ${params.summary}`
    )
    return { ok: false, rejected: "heartbeat_pattern" as const }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "marathon" } }
  )

  const { error } = await supabase.from("agent_memory").insert({
    agent_name: params.agent_name,
    memory_type: params.memory_type,
    summary: params.summary,
    details: params.details ?? null,
    entity: params.entity ?? null,
    importance: params.importance ?? 0.5,
  })

  if (error) {
    console.error(`[agent-memory] Insert failed for ${params.agent_name}:`, error)
    return { ok: false, error }
  }

  return { ok: true }
}
