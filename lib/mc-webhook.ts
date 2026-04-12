import type { LoanApplication } from "./applications-service"

const MC_WEBHOOK_URL = process.env.MC_WEBHOOK_URL || "http://localhost:3000/api/pipeline/loans"
const MC_WEBHOOK_SECRET = process.env.MC_WEBHOOK_SECRET || ""

interface MCLoanPayload {
  borrower_name: string
  borrower_email: string
  borrower_phone: string
  loan_type: string
  loan_amount: number
  property_address: string
  status: string
  source: string
  preme_portal_id: string
  application_number: string
}

function mapPremeStatusToMC(status: string): string {
  const statusMap: Record<string, string> = {
    submitted: "submitted",
    under_review: "processing",
    approved: "approved",
    rejected: "denied",
    on_hold: "on_hold",
    archived: "closed",
    sent: "sent",
    opened: "opened",
  }
  return statusMap[status] || "submitted"
}

function mapAppToMCPayload(app: LoanApplication): MCLoanPayload {
  const propertyParts = [
    app.property_address,
    app.property_city,
    app.property_state,
    app.property_zip,
  ].filter(Boolean)

  return {
    borrower_name: app.applicant_name,
    borrower_email: app.applicant_email,
    borrower_phone: app.applicant_phone,
    loan_type: app.loan_type || "Bridge Loan",
    loan_amount: app.loan_amount || 0,
    property_address: propertyParts.join(", ") || "",
    status: mapPremeStatusToMC(app.status),
    source: "preme_portal",
    preme_portal_id: app.id,
    application_number: app.application_number,
  }
}

export async function notifyMCNewApplication(app: LoanApplication): Promise<void> {
  try {
    const payload = mapAppToMCPayload(app)

    await fetch(`${MC_WEBHOOK_URL}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MC_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    // Fire-and-forget — never block the user's submission
    console.error("[mc-webhook] Failed to notify MC of new application:", error)
  }
}

export async function notifyMCStatusChange(
  applicationId: string,
  newStatus: string,
  applicationNumber: string
): Promise<void> {
  try {
    await fetch(`${MC_WEBHOOK_URL}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MC_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify({
        preme_portal_id: applicationId,
        application_number: applicationNumber,
        status: mapPremeStatusToMC(newStatus),
        source: "preme_portal",
      }),
    })
  } catch (error) {
    console.error("[mc-webhook] Failed to notify MC of status change:", error)
  }
}
