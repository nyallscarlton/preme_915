/**
 * POST /api/webhooks/ghl-lead-intake
 *
 * Webhook proxy: receives Zyntrx landing page form submissions
 * and creates contacts in GHL Preme sub-account via API.
 *
 * Replaces the old lead-intake webhook that inserted into Supabase.
 * GHL handles cadence enrollment via its own workflows.
 *
 * CORS: accepts POSTs from Zyntrx landing page domains.
 */

import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const GHL_API_KEY = process.env.GHL_API_KEY!
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID!
const GHL_API_URL = "https://services.leadconnectorhq.com/contacts/"

const ALLOWED_ORIGINS = [
  "https://go.premerealestate.com",
  "https://www.premerealestate.com",
  "https://premerealestate.com",
  "https://app.premerealestate.com",
  "https://app.zyntrxmarketing.com",
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  const headers = corsHeaders(origin)

  try {
    const body = await request.json()

    const firstName = body.first_name || body.firstName || ""
    const lastName = body.last_name || body.lastName || ""
    const phone = normalizePhone(body.phone || "")
    const email = body.email || ""
    const propertyState = body.property_state || body.state || ""
    const source = body.source || body.utm_source || "zyntrx"

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400, headers }
      )
    }

    // Build GHL contact payload
    const ghlPayload: Record<string, unknown> = {
      locationId: GHL_LOCATION_ID,
      firstName,
      lastName,
      phone,
      tags: ["source_zyntrx", "cadence_active"],
      source,
    }

    if (email) ghlPayload.email = email

    // Map custom fields
    const customFields: Record<string, string> = {}
    if (propertyState) customFields.property_state = propertyState
    if (body.loan_amount) customFields.loan_amount = body.loan_amount
    if (body.timeline) customFields.timeline = body.timeline
    if (body.entity_type) customFields.entity_type = body.entity_type

    if (Object.keys(customFields).length > 0) {
      ghlPayload.customFields = Object.entries(customFields).map(
        ([key, value]) => ({ key, field_value: value })
      )
    }

    // Create contact in GHL
    const ghlResponse = await fetch(GHL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
        "User-Agent": "Preme-Portal/1.0",
        Accept: "application/json",
      },
      body: JSON.stringify(ghlPayload),
    })

    const ghlData = await ghlResponse.json()

    if (!ghlResponse.ok) {
      console.error("[ghl-lead-intake] GHL API error:", ghlData)
      return NextResponse.json(
        { error: "Failed to create contact in GHL", details: ghlData },
        { status: 502, headers }
      )
    }

    const contactId = ghlData.contact?.id
    console.log(
      `[ghl-lead-intake] Contact created: ${contactId} - ${firstName} ${lastName} (${phone})`
    )

    return NextResponse.json(
      {
        success: true,
        contact_id: contactId,
        message: "Lead received and routed to GHL",
      },
      { status: 200, headers }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[ghl-lead-intake] Error:", message)
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500, headers }
    )
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (phone.startsWith("+")) return phone
  return `+1${digits}`
}
