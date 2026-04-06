/**
 * Marathon Empire — Execution Logger (TypeScript)
 *
 * Usage:
 *   import { ExecLog } from "@/lib/exec-log"
 *
 *   const log = new ExecLog("lead-followup.ts", "webhook", "preme", "riley")
 *   try {
 *     const result = await doWork()
 *     await log.complete({ leadsProcessed: 3 })
 *   } catch (err) {
 *     await log.fail(err instanceof Error ? err.message : String(err))
 *   }
 */

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "marathon" } }
)

export class ExecLog {
  private logId: string | null = null
  private startTime: number
  private scriptName: string

  constructor(
    scriptName: string,
    triggerType: string,
    entity: string,
    agent: string,
    inputData?: Record<string, unknown>
  ) {
    this.scriptName = scriptName
    this.startTime = Date.now()

    // Fire-and-forget insert — don't block the caller
    this.init(scriptName, triggerType, entity, agent, inputData)
  }

  private async init(
    scriptName: string,
    triggerType: string,
    entity: string,
    agent: string,
    inputData?: Record<string, unknown>
  ) {
    try {
      const { data } = await supabase
        .from("execution_log")
        .insert({
          script_name: scriptName,
          trigger_type: triggerType,
          entity,
          agent,
          status: "started",
          input_data: inputData || {},
        })
        .select("id")
        .single()
      this.logId = data?.id || null
    } catch {
      // Don't let logging failures break the actual work
    }
  }

  private elapsedMs(): number {
    return Date.now() - this.startTime
  }

  async complete(outputData?: Record<string, unknown>): Promise<void> {
    if (!this.logId) {
      // Wait briefly for init to finish
      await new Promise((r) => setTimeout(r, 200))
    }
    if (!this.logId) return
    try {
      await supabase
        .from("execution_log")
        .update({
          status: "completed",
          output_data: outputData || {},
          duration_ms: this.elapsedMs(),
        })
        .eq("id", this.logId)
    } catch {
      // Silent
    }
  }

  async fail(errorMessage: string): Promise<void> {
    if (!this.logId) {
      await new Promise((r) => setTimeout(r, 200))
    }
    if (!this.logId) return
    try {
      await supabase
        .from("execution_log")
        .update({
          status: "failed",
          error_message: errorMessage,
          duration_ms: this.elapsedMs(),
        })
        .eq("id", this.logId)
    } catch {
      // Silent
    }
    await sendSlackAlert(`❌ FAILED — ${this.scriptName} — ${errorMessage}`)
  }

  async successAlert(message: string): Promise<void> {
    await sendSlackAlert(message)
  }
}

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || "xoxb-10810278616865-10793966886901-IkgPJuagaGNceBA2WFIysKbC"
const SLACK_CHANNEL = process.env.SLACK_ALERT_CHANNEL || "C0AQQUMKVPG" // #activity-log

async function sendSlackAlert(message: string): Promise<void> {
  if (!SLACK_TOKEN) return
  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text: message }),
    })
  } catch {
    // Silent
  }
}

/**
 * Convenience wrapper for simple scripts that just need start/complete/fail.
 */
export async function withExecLog<T>(
  scriptName: string,
  triggerType: string,
  entity: string,
  agent: string,
  fn: () => Promise<T>,
  inputData?: Record<string, unknown>
): Promise<T> {
  const log = new ExecLog(scriptName, triggerType, entity, agent, inputData)
  // Give init time to complete
  await new Promise((r) => setTimeout(r, 100))
  try {
    const result = await fn()
    await log.complete(typeof result === "object" ? (result as Record<string, unknown>) : { result })
    return result
  } catch (err) {
    await log.fail(err instanceof Error ? err.message : String(err))
    throw err
  }
}
