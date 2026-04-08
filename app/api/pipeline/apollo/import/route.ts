import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ApolloContact } from "@/lib/apollo"

// POST /api/pipeline/apollo/import
// Import selected Apollo contacts as prospected buyers
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { contacts, metro } = (await request.json()) as {
      contacts: ApolloContact[]
      metro: string
    }

    if (!contacts?.length) {
      return NextResponse.json({ error: "No contacts provided" }, { status: 400 })
    }

    // Get the water-damage vertical
    const { data: vertical } = await supabase
      .from("zx_verticals")
      .select("id")
      .eq("slug", "water-damage")
      .single()

    if (!vertical) {
      return NextResponse.json({ error: "Water damage vertical not found" }, { status: 404 })
    }

    const imported: string[] = []
    const skipped: string[] = []
    const errors: string[] = []

    for (const contact of contacts) {
      // Skip if no email (can't outreach)
      if (!contact.email) {
        skipped.push(`${contact.company} - no email`)
        continue
      }

      // Check if buyer already exists by email
      const { data: existing } = await supabase
        .from("zx_buyers")
        .select("id")
        .eq("email", contact.email)
        .maybeSingle()

      if (existing) {
        skipped.push(`${contact.company} - already exists`)
        continue
      }

      const { error } = await supabase.from("zx_buyers").insert({
        name: contact.company,
        phone: contact.phone || null,
        email: contact.email,
        vertical_id: vertical.id,
        webhook_url: "",
        pricing_model: "per_call",
        price_per_lead: 350,
        active: false, // not active until onboarded
        paused: false,
        balance: 0,
        service_area: metro ? [metro] : [],
        metadata: {
          apollo_id: contact.id,
          contact_name: `${contact.first_name} ${contact.last_name}`.trim(),
          contact_title: contact.title,
          company_domain: contact.company_domain,
          company_size: contact.company_size,
          linkedin_url: contact.linkedin_url,
          source: "apollo",
          status: "prospected",
          city: contact.city,
          state: contact.state,
        },
      })

      if (error) {
        errors.push(`${contact.company}: ${error.message}`)
      } else {
        imported.push(contact.company)
      }
    }

    return NextResponse.json({
      imported: imported.length,
      skipped: skipped.length,
      errors: errors.length,
      details: { imported, skipped, errors },
    })
  } catch (err) {
    console.error("[apollo/import] Error:", err)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}
