const BOT_TOKEN = "7917360795:AAH3Gyxc-zeBM3sBb8cX1OciUjYQoRv7fMQ"
const CHAT_ID = "7119100002"

export async function notifyNewLead(lead: {
  first_name: string
  last_name: string
  email: string
  phone: string
  source: string | null
  score: number | null
  temperature: string | null
  custom_fields: Record<string, unknown>
  vertical?: string
}) {
  const isWaterDamage = lead.vertical === "water-damage"

  if (isWaterDamage) {
    const damageType = ((lead.custom_fields?.damage_type as string) || "water damage").replace(/_/g, " ")
    const address = (lead.custom_fields?.address as string) || "N/A"
    const zipCode = (lead.custom_fields?.zip_code as string) || ""
    const market = ((lead.custom_fields?.market as string) || (lead.custom_fields?.city as string) || "Unknown").replace(/^\w/, c => c.toUpperCase())
    const urgency = (lead.custom_fields?.urgency as string) || "standard"
    const urgencyLabel = urgency === "emergency" ? "EMERGENCY" : urgency === "urgent" ? "URGENT" : "Standard"

    const message = [
      `🌊 *New Water Damage Lead — ${urgencyLabel}*`,
      ``,
      `*${lead.first_name} ${lead.last_name}*`,
      `📧 ${lead.email}`,
      `📱 ${lead.phone}`,
      `💧 Damage: ${damageType}`,
      `🏠 ${address}${zipCode ? ` ${zipCode}` : ""}`,
      `📍 Market: ${market}`,
      `📊 Score: ${lead.score || 0}/100 (${lead.temperature || "unscored"})`,
      `📍 Source: ${lead.source || "direct"}`,
    ].join("\n")

    return sendTelegram(message)
  }

  const loanType = (lead.custom_fields?.loan_type as string) || "Not specified"
  const tempEmoji = lead.temperature === "hot" ? "🔥" : lead.temperature === "warm" ? "🟡" : "🔵"

  const message = [
    `${tempEmoji} *New Preme Home Loans Lead*`,
    ``,
    `*${lead.first_name} ${lead.last_name}*`,
    `📧 ${lead.email}`,
    `📱 ${lead.phone}`,
    `💼 ${loanType}`,
    `📊 Score: ${lead.score || 0}/100 (${lead.temperature || "unscored"})`,
    `📍 Source: ${lead.source || "direct"}`,
  ].join("\n")

  return sendTelegram(message)
}

export async function notifyQualifiedLead(lead: {
  first_name: string
  last_name: string
  phone: string
  temperature: string | null
  score: number | null
  summary: string | null
  loan_type: string | null
  property_type: string | null
  timeline: string | null
  credit_range: string | null
  vertical?: string
  damage_type?: string | null
  address?: string | null
  market?: string | null
}) {
  const isWaterDamage = lead.vertical === "water-damage"

  if (isWaterDamage) {
    const damageType = (lead.damage_type || "water damage").replace(/_/g, " ")
    const details = [
      `💧 Damage: ${damageType}`,
      lead.address && `🏠 ${lead.address}`,
      lead.market && `📍 Market: ${lead.market.replace(/^\w/, c => c.toUpperCase())}`,
      lead.timeline && `⏰ ${lead.timeline}`,
    ].filter(Boolean)

    const message = [
      `🌊 *QUALIFIED WATER DAMAGE LEAD — Dispatch Now*`,
      ``,
      `*${lead.first_name} ${lead.last_name}*`,
      `📱 ${lead.phone}`,
      ...details,
      `📊 Score: ${lead.score || 0}/100`,
      ``,
      lead.summary ? `_${lead.summary.slice(0, 300)}_` : "",
    ].filter(Boolean).join("\n")

    return sendTelegram(message)
  }

  const tempEmoji = lead.temperature === "hot" ? "🔥" : lead.temperature === "warm" ? "🟡" : "🔵"

  const details = [
    lead.loan_type && `💼 ${lead.loan_type}`,
    lead.property_type && `🏠 ${lead.property_type}`,
    lead.credit_range && `💳 Credit: ${lead.credit_range}`,
    lead.timeline && `⏰ ${lead.timeline}`,
  ].filter(Boolean)

  const message = [
    `${tempEmoji} *QUALIFIED LEAD — Call Now*`,
    ``,
    `*${lead.first_name} ${lead.last_name}*`,
    `📱 ${lead.phone}`,
    ...details,
    `📊 Score: ${lead.score || 0}/100`,
    ``,
    lead.summary ? `_${lead.summary.slice(0, 300)}_` : "",
  ].filter(Boolean).join("\n")

  return sendTelegram(message)
}

export async function notifyHandoff(lead: {
  first_name: string
  last_name: string
  buyer_name: string
  temperature: string | null
  score: number | null
}) {
  const message = [
    `✅ *Lead Handed Off*`,
    ``,
    `*${lead.first_name} ${lead.last_name}* → ${lead.buyer_name}`,
    `Score: ${lead.score || 0}/100 | Temp: ${lead.temperature || "unknown"}`,
  ].join("\n")

  return sendTelegram(message)
}

export async function notifyTask(task: {
  lead_name: string
  phone: string
  task_title: string
  task_description: string
  step_number: number
}) {
  const message = [
    `📞 *Follow-Up Task*`,
    ``,
    `*${task.lead_name}*`,
    `📱 ${task.phone}`,
    ``,
    `Step ${task.step_number}: ${task.task_description}`,
  ].join("\n")

  return sendTelegram(message)
}

export async function notifySequenceSummary(stats: {
  sms_sent: number
  tasks_created: number
  errors: number
}) {
  if (stats.sms_sent === 0 && stats.tasks_created === 0) return
  const message = [
    `⚡ *Sequence Runner*`,
    ``,
    `SMS sent: ${stats.sms_sent}`,
    `Tasks created: ${stats.tasks_created}`,
    stats.errors > 0 ? `⚠️ Errors: ${stats.errors}` : "",
  ].filter(Boolean).join("\n")

  return sendTelegram(message)
}

export async function sendTelegram(text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    })
  } catch (error) {
    console.error("[telegram] Failed to send:", error)
  }
}
