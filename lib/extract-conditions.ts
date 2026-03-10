import Anthropic from "@anthropic-ai/sdk"

export interface ExtractedCondition {
  title: string
  description: string | null
  status: "outstanding" | "submitted" | "approved" | "waived"
}

const SYSTEM_PROMPT = `You are a mortgage loan condition extraction engine for Preme Home Loans. You receive images or text from lender condition sheets, underwriting PDFs, screenshots, or commitment letters.

Your job: Extract EVERY condition listed and return them as a JSON array.

For each condition, return:
- "title": Short condition name (e.g., "Bank Statements (2 months)", "Hazard Insurance Binder", "Title Commitment")
- "description": Additional details if present (full text from the document), or null
- "status": One of:
  - "outstanding" — condition is open/pending/needed/required/not yet received
  - "submitted" — condition has been received/submitted/uploaded but not yet cleared
  - "approved" — condition is cleared/satisfied/approved/accepted
  - "waived" — condition has been waived

Rules:
- Extract ALL conditions, even if there are dozens
- Clean up titles: remove numbering, bullet points, leading dashes. Keep them concise but descriptive
- If the document shows a status (like "Open", "Received", "Cleared", "Satisfied", "Waived", "Pending"), map it to the correct status
- If no status is visible, default to "outstanding"
- If conditions are grouped by category (e.g., "Prior to Closing", "Prior to Funding", "Prior to Docs"), include the category in the description
- Do NOT invent conditions that aren't in the document
- Return ONLY valid JSON array, no other text`

export async function extractConditionsFromFile(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedCondition[]> {
  const client = new Anthropic()

  // Build the content blocks
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = []

  if (mimeType === "application/pdf") {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: fileBuffer.toString("base64"),
      },
    } as any)
  } else if (mimeType.startsWith("image/")) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: fileBuffer.toString("base64"),
      },
    })
  } else {
    // Try as text
    const text = fileBuffer.toString("utf-8")
    content.push({
      type: "text",
      text: `Here is the content of a file named "${fileName}":\n\n${text}`,
    })
  }

  content.push({
    type: "text",
    text: "Extract all conditions from this document. Return ONLY a JSON array.",
  })

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  })

  // Parse the response
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")

  // Extract JSON from response (may be wrapped in ```json ... ```)
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error("Failed to extract conditions — AI did not return valid JSON")
  }

  const parsed = JSON.parse(jsonMatch[0]) as ExtractedCondition[]

  // Validate and normalize
  return parsed.map((c) => ({
    title: (c.title || "").trim(),
    description: c.description?.trim() || null,
    status: ["outstanding", "submitted", "approved", "waived"].includes(c.status)
      ? c.status
      : "outstanding",
  })).filter((c) => c.title.length > 0)
}
