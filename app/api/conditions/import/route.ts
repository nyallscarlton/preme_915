import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getParser } from "@/lib/parsers"
import type { ParsedCondition } from "@/lib/parsers"
import { triageConditions, type TriageInput } from "@/lib/triage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ── Types ────────────────────────────────────────────────────────────

interface ConditionDiff {
  created: { title: string; status: string }[]
  updated: { title: string; changes: string[] }[]
  unchanged: number
}

interface ImportResponse {
  success: boolean
  loan_id: string
  import_id: string
  summary: {
    total_parsed: number
    created: number
    updated: number
    unchanged: number
    skipped: number
    triaged: number
  }
  diff: ConditionDiff
  errors: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────

function describeChanges(
  existing: Record<string, unknown>,
  incoming: ParsedCondition
): string[] {
  const changes: string[] = []
  const fields: { key: keyof ParsedCondition; label: string }[] = [
    { key: "status", label: "status" },
    { key: "sub_status", label: "sub-status" },
    { key: "is_received", label: "received" },
    { key: "is_cleared", label: "cleared" },
    { key: "is_waived", label: "waived" },
    { key: "description", label: "description" },
    { key: "category", label: "category" },
    { key: "prior_to", label: "prior to" },
  ]

  for (const { key, label } of fields) {
    const oldVal = existing[key as string]
    const newVal = incoming[key]
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changes.push(`${label}: ${oldVal ?? "—"} → ${newVal ?? "—"}`)
    }
  }
  return changes
}

// ── POST /api/conditions/import ──────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const loanNumber = formData.get("loan_number") as string | null
    const lender = (formData.get("lender") as string) || "Logan Finance"
    const importedBy = (formData.get("imported_by") as string) || "nyalls"

    // ── Validation ─────────────────────────────────────────────────

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      )
    }

    if (!loanNumber?.trim()) {
      return NextResponse.json(
        { success: false, error: "loan_number is required" },
        { status: 400 }
      )
    }

    const parser = getParser(lender)
    if (!parser) {
      return NextResponse.json(
        {
          success: false,
          error: `No parser found for lender: ${lender}`,
        },
        { status: 400 }
      )
    }

    // ── Parse Excel ────────────────────────────────────────────────

    const buffer = Buffer.from(await file.arrayBuffer())
    const { conditions: parsed, skipped, errors } = parser.parse(buffer)

    if (parsed.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No conditions found in file",
          errors,
        },
        { status: 400 }
      )
    }

    // ── Get or create loan ─────────────────────────────────────────

    const supabase = createAdminClient()

    let { data: loan } = await supabase
      .from("loans")
      .select("id")
      .eq("loan_number", loanNumber.trim())
      .single()

    if (!loan) {
      const { data: newLoan, error: loanErr } = await supabase
        .from("loans")
        .insert({
          loan_number: loanNumber.trim(),
          lender,
        })
        .select("id")
        .single()

      if (loanErr || !newLoan) {
        return NextResponse.json(
          { success: false, error: `Failed to create loan: ${loanErr?.message}` },
          { status: 500 }
        )
      }
      loan = newLoan
    }

    // ── Load existing conditions for this loan ─────────────────────

    const { data: existing } = await supabase
      .from("loan_conditions")
      .select("*")
      .eq("loan_id", loan.id)

    const existingByExtId = new Map(
      (existing ?? []).map((c: Record<string, unknown>) => [c.external_id, c])
    )

    // ── Diff & upsert ──────────────────────────────────────────────

    const diff: ConditionDiff = { created: [], updated: [], unchanged: 0 }
    const historyInserts: Record<string, unknown>[] = []
    const conditionsToTriage: { id: string; input: TriageInput }[] = []
    const now = new Date().toISOString()

    for (const incoming of parsed) {
      const existingRow = existingByExtId.get(incoming.external_id) as
        | Record<string, unknown>
        | undefined

      if (!existingRow) {
        // ── New condition ────────────────────────────────────────
        const { data: inserted, error: insertErr } = await supabase
          .from("loan_conditions")
          .insert({
            loan_id: loan.id,
            lender,
            ...incoming,
            last_imported_at: now,
          })
          .select("id")
          .single()

        if (insertErr) {
          errors.push(`Insert failed for ${incoming.title}: ${insertErr.message}`)
        } else {
          diff.created.push({
            title: incoming.title,
            status: incoming.status,
          })
          // Queue open conditions for triage
          if (incoming.status === "Open" && inserted) {
            conditionsToTriage.push({ id: inserted.id, input: incoming })
          }
        }
      } else {
        // ── Check for changes ────────────────────────────────────
        const changes = describeChanges(existingRow, incoming)

        if (changes.length === 0) {
          diff.unchanged++
          // Still update last_imported_at
          await supabase
            .from("loan_conditions")
            .update({ last_imported_at: now })
            .eq("id", existingRow.id)
          continue
        }

        // Record status change in history
        if (
          existingRow.status !== incoming.status ||
          existingRow.sub_status !== incoming.sub_status
        ) {
          historyInserts.push({
            condition_id: existingRow.id,
            previous_status: existingRow.status,
            new_status: incoming.status,
            change_source: "import",
            notes: `Sub-status: ${existingRow.sub_status ?? "—"} → ${incoming.sub_status ?? "—"}`,
          })
        }

        // Update the condition
        const { error: updateErr } = await supabase
          .from("loan_conditions")
          .update({
            ...incoming,
            last_imported_at: now,
          })
          .eq("id", existingRow.id)

        if (updateErr) {
          errors.push(`Update failed for ${incoming.title}: ${updateErr.message}`)
        } else {
          diff.updated.push({ title: incoming.title, changes })
          // Re-triage changed open conditions
          if (incoming.status === "Open") {
            conditionsToTriage.push({
              id: existingRow.id as string,
              input: incoming,
            })
          }
        }
      }
    }

    // ── Insert history records ─────────────────────────────────────

    if (historyInserts.length > 0) {
      await supabase.from("condition_history").insert(historyInserts)
    }

    // ── Recalculate loan counts ────────────────────────────────────

    await supabase.rpc("recalculate_loan_condition_counts", {
      target_loan_id: loan.id,
    })

    // ── AI Triage on new/changed open conditions ───────────────────

    let triaged = 0
    if (conditionsToTriage.length > 0) {
      try {
        const { data: loanData } = await supabase
          .from("loans")
          .select("closing_date")
          .eq("id", loan.id)
          .single()

        const triageResults = await triageConditions(
          conditionsToTriage.map((c) => c.input),
          loanData?.closing_date
        )

        for (let i = 0; i < conditionsToTriage.length; i++) {
          const result = triageResults[i]
          const { error: triageErr } = await supabase
            .from("loan_conditions")
            .update({
              action_owner: result.action_owner,
              action_owner_name: result.action_owner_name,
              priority: result.priority,
              is_blocking: result.is_blocking,
              action_summary: result.action_summary,
            })
            .eq("id", conditionsToTriage[i].id)

          if (!triageErr) triaged++
        }
      } catch (triageError) {
        console.error("[conditions/import] Triage failed:", triageError)
        errors.push("AI triage failed — conditions imported but not classified")
      }
    }

    // ── Log the import ─────────────────────────────────────────────

    const { data: importRecord } = await supabase
      .from("lender_imports")
      .insert({
        loan_id: loan.id,
        lender,
        import_source: "excel_upload",
        file_name: file.name,
        conditions_created: diff.created.length,
        conditions_updated: diff.updated.length,
        conditions_unchanged: diff.unchanged,
        imported_by: importedBy,
      })
      .select("id")
      .single()

    // ── Response ───────────────────────────────────────────────────

    const response: ImportResponse = {
      success: true,
      loan_id: loan.id,
      import_id: importRecord?.id ?? "",
      summary: {
        total_parsed: parsed.length,
        created: diff.created.length,
        updated: diff.updated.length,
        unchanged: diff.unchanged,
        skipped,
        triaged,
      },
      diff,
      errors,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[conditions/import] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Import failed — see server logs",
      },
      { status: 500 }
    )
  }
}
