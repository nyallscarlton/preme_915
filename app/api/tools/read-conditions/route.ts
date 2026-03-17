/**
 * Preme Home Loans — Retell Custom Tool: Read Conditions
 *
 * Called by the voice agent when a borrower asks "What do you need from me?"
 * or "What conditions are outstanding?" Reads open conditions from
 * loan_conditions linked through the loans table.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, application_number } = body.args || body

    const supabase = createAdminClient()

    // First find the borrower's loan via loan_applications → borrower name → loans
    let borrowerName = ""

    if (application_number) {
      const { data } = await supabase
        .from("loan_applications")
        .select("applicant_name")
        .eq("application_number", application_number)
        .maybeSingle()
      borrowerName = data?.applicant_name || ""
    }

    if (!borrowerName && phone) {
      const digits = phone.replace(/\D/g, "").slice(-10)
      const { data } = await supabase
        .from("loan_applications")
        .select("applicant_name")
        .or(`applicant_phone.ilike.%${digits}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      borrowerName = data?.applicant_name || ""
    }

    if (!borrowerName) {
      return NextResponse.json({
        result: "I couldn't find a loan file for this caller. They may need to submit an application first.",
      })
    }

    // Find the loan in the wholesale loans table by borrower name
    const { data: loan } = await supabase
      .from("loans")
      .select("id, loan_number, status")
      .ilike("borrower_name", `%${borrowerName.split(" ").pop()}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!loan) {
      return NextResponse.json({
        result: "The application is in our system but hasn't been submitted to a lender yet. No conditions to report at this time. A loan officer will be in touch once the file is in underwriting.",
      })
    }

    // Get open conditions
    const { data: conditions } = await supabase
      .from("loan_conditions")
      .select("title, description, priority, action_owner, is_blocking")
      .eq("loan_id", loan.id)
      .in("status", ["Open", "Received"])
      .order("priority", { ascending: true })

    if (!conditions || conditions.length === 0) {
      return NextResponse.json({
        result: `Good news! Loan ${loan.loan_number} has no outstanding conditions right now. Everything looks clear on our end.`,
      })
    }

    const priorityLabel: Record<string, string> = {
      critical: "URGENT",
      high: "Important",
      normal: "",
      low: "",
    }

    const lines = conditions.map((c, i) => {
      const urgent = priorityLabel[c.priority] ? `[${priorityLabel[c.priority]}] ` : ""
      const blocking = c.is_blocking ? " (blocking closing)" : ""
      const owner = c.action_owner === "broker" ? " — we need this from you" : ""
      return `${i + 1}. ${urgent}${c.title}${blocking}${owner}`
    })

    const brokerItems = conditions.filter((c) => c.action_owner === "broker").length

    return NextResponse.json({
      result: [
        `Loan ${loan.loan_number} has ${conditions.length} outstanding condition${conditions.length > 1 ? "s" : ""}:`,
        ...lines,
        brokerItems > 0
          ? `${brokerItems} item${brokerItems > 1 ? "s" : ""} need${brokerItems === 1 ? "s" : ""} action from you. Would you like details on any of these?`
          : "These are all being handled by our team. No action needed from you right now.",
      ].join(" "),
    })
  } catch (error) {
    console.error("[retell-preme] read-conditions error:", error)
    return NextResponse.json({
      result: "I'm having trouble pulling up conditions right now. Let me have your loan officer follow up with the details.",
    })
  }
}
