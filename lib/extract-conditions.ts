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
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured")

  const base64Data = fileBuffer.toString("base64")

  // Build parts for Gemini
  const parts: any[] = []

  if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
    parts.push({
      inlineData: {
        mimeType,
        data: base64Data,
      },
    })
  } else {
    // Text file
    const text = fileBuffer.toString("utf-8")
    parts.push({ text: `Here is the content of a file named "${fileName}":\n\n${text}` })
  }

  parts.push({
    text: "Extract all conditions from this document. Return ONLY a JSON array.",
  })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.1,
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error: ${err}`)
  }

  const json = await res.json()

  // Extract text from response
  const text =
    json.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || "")
      .join("") || ""

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
