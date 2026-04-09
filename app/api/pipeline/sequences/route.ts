import { NextRequest, NextResponse } from "next/server"
import { createZentrxClient } from "@/lib/supabase/admin"

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { type, id } = body
  const supabase = createZentrxClient()

  if (type === "sequence") {
    const { error } = await supabase
      .from("sequences")
      .update({ active: body.active })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (type === "step") {
    const { error } = await supabase
      .from("sequence_steps")
      .update({ active: body.active })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (type === "step_delay") {
    const { error } = await supabase
      .from("sequence_steps")
      .update({ delay_minutes: body.delay_minutes })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (type === "template") {
    const { error } = await supabase
      .from("message_templates")
      .update({ body: body.body })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 })
}
