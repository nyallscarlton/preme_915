import * as XLSX from "xlsx"
import type { LenderParser, ParsedCondition, ParseResult } from "./types"

// Column mapping: Logan Finance Excel header → our field name
const COLUMN_MAP: Record<string, keyof ParsedCondition> = {
  id: "external_id",
  conditionType: "condition_type",
  title: "title",
  description: "description",
  descriptionDetails: "description_details",
  category: "category",
  priorTo: "prior_to",
  status: "status",
  sub_status: "sub_status",
  source: "source",
  requestedFrom: "requested_from",
  isReceived: "is_received",
  receivedDate: "received_date",
  isCleared: "is_cleared",
  clearedDate: "cleared_date",
  isWaived: "is_waived",
  waivedDate: "waived_date",
  statusDate: "status_date",
  createdDate: "created_date",
  allowToClear: "allow_to_clear",
}

function toBool(val: unknown): boolean {
  if (typeof val === "boolean") return val
  if (typeof val === "string") return val.toLowerCase() === "true"
  return false
}

function toDateString(val: unknown): string | null {
  if (!val) return null
  if (typeof val === "string") return val
  // XLSX may parse dates as JS Date objects
  if (val instanceof Date) return val.toISOString()
  return null
}

export const loganFinanceParser: LenderParser = {
  lender: "Logan Finance",

  parse(buffer: Buffer): ParseResult {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    const conditions: ParsedCondition[] = []
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      // Skip removed conditions
      if (toBool(row.isRemoved)) {
        skipped++
        continue
      }

      // Require at minimum an id and title
      if (!row.id || !row.title) {
        errors.push(`Row ${i + 2}: missing id or title, skipped`)
        skipped++
        continue
      }

      const condition: ParsedCondition = {
        external_id: String(row.id),
        condition_type: row.conditionType ? String(row.conditionType) : null,
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        description_details: row.descriptionDetails
          ? String(row.descriptionDetails)
          : null,
        category: row.category ? String(row.category) : null,
        prior_to: row.priorTo ? String(row.priorTo) : null,
        status: row.status ? String(row.status) : "Open",
        sub_status: row.sub_status ? String(row.sub_status) : null,
        source: row.source ? String(row.source) : null,
        requested_from: row.requestedFrom ? String(row.requestedFrom) : null,
        is_received: toBool(row.isReceived),
        received_date: toDateString(row.receivedDate),
        is_cleared: toBool(row.isCleared),
        cleared_date: toDateString(row.clearedDate),
        is_waived: toBool(row.isWaived),
        waived_date: toDateString(row.waivedDate),
        status_date: toDateString(row.statusDate),
        created_date: toDateString(row.createdDate),
        allow_to_clear: toBool(row.allowToClear),
      }

      conditions.push(condition)
    }

    return { conditions, skipped, errors }
  },
}
