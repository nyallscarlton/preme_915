import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ""
const PREME_CHANNEL = "C0APBULDQS1" // #preme

/**
 * POST /api/webhooks/retell/notify-nyalls
 *
 * Riley calls this when a caller insists on speaking with Nyalls after the
 * transfer attempt failed. Posts a brief summary to #preme so Nyalls sees it
 * immediately and can call them back.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const args = body.args || body
    const call = body.call || {}

    const callerName = args.caller_name || "Unknown caller"
    const callerPhone =
      args.caller_phone || call.from_number || "unknown number"
    const summary = args.summary || "Caller asked to speak with Nyalls directly."
    const urgency = (args.urgency || "medium").toLowerCase()

    const urgencyEmoji = urgency === "high" ? "🔴" : urgency === "low" ? "🟢" : "🟡"

    const message =
      `${urgencyEmoji} *Caller wants to speak with you*\n` +
      `• Name: ${callerName}\n` +
      `• Phone: ${callerPhone}\n` +
      `• Need: ${summary}\n` +
      `• Riley couldn't transfer — they're waiting on a callback`

    if (!SLACK_TOKEN) {
      console.error("[notify-nyalls] SLACK_BOT_TOKEN not set")
      return NextResponse.json({
        result:
          "I noted your details but couldn't send the message right now. Nyalls will get back to you shortly.",
      })
    }

    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: PREME_CHANNEL, text: message }),
    })

    const data = await r.json()
    if (!data.ok) {
      console.error("[notify-nyalls] Slack error:", data.error)
      return NextResponse.json({
        result:
          "I noted your details but couldn't reach Nyalls right now. He'll call you back as soon as he's free.",
      })
    }

    return NextResponse.json({
      result: `I've sent Nyalls a direct message with your details. He'll call you back as soon as he's free.`,
    })
  } catch (error) {
    console.error("[notify-nyalls] Error:", error)
    return NextResponse.json({
      result:
        "I've noted your details. Nyalls will reach out to you shortly.",
    })
  }
}
