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

/**
 * Extract readable text from a PDF buffer without external dependencies.
 * Handles most text-based PDFs by finding text stream objects.
 */
function extractTextFromPdf(buffer: Buffer): string {
  const raw = buffer.toString("latin1")
  const textChunks: string[] = []

  // Find all stream content between "stream" and "endstream"
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g
  let match
  while ((match = streamRegex.exec(raw)) !== null) {
    const content = match[1]
    // Extract text operators: Tj, TJ, ' and "
    const tjRegex = /\(([^)]*)\)\s*Tj/g
    let tj
    while ((tj = tjRegex.exec(content)) !== null) {
      textChunks.push(tj[1])
    }
    // TJ array: [(text) kerning (text) ...]
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g
    let tjArr
    while ((tjArr = tjArrayRegex.exec(content)) !== null) {
      const inner = tjArr[1]
      const parts = /\(([^)]*)\)/g
      let p
      while ((p = parts.exec(inner)) !== null) {
        textChunks.push(p[1])
      }
    }
  }

  // Decode common PDF escape sequences
  const decoded = textChunks
    .join(" ")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")

  return decoded
}

export async function extractConditionsFromFile(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<ExtractedCondition[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured")

  // Build content for OpenAI
  const content: any[] = []

  if (mimeType.startsWith("image/")) {
    // Images: use GPT-4o-mini vision
    const base64Data = fileBuffer.toString("base64")
    content.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64Data}` },
    })
  } else if (mimeType === "application/pdf") {
    // PDFs: extract text and send as text (GPT-4o-mini doesn't support PDF vision)
    const pdfText = extractTextFromPdf(fileBuffer)
    if (pdfText.trim().length < 20) {
      // If text extraction fails (scanned PDF), this is likely an image-based PDF
      // Fall back to sending first instruction to user
      throw new Error(
        "This PDF appears to be image-based (scanned). Please take a screenshot of the conditions page and upload the image instead."
      )
    }
    content.push({
      type: "text",
      text: `Here is the text content extracted from a PDF named "${fileName}":\n\n${pdfText}`,
    })
  } else {
    // Text/CSV/other files
    const textContent = fileBuffer.toString("utf-8")
    content.push({
      type: "text",
      text: `Here is the content of a file named "${fileName}":\n\n${textContent}`,
    })
  }

  content.push({
    type: "text",
    text: "Extract all conditions from this document. Return ONLY a JSON array.",
  })

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error: ${err}`)
  }

  const json = await res.json()

  const text = json.choices?.[0]?.message?.content || ""

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
