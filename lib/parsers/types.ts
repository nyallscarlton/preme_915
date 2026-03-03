// Normalized condition shape that all lender parsers produce.
// Maps 1:1 to the loan_conditions table columns.
export interface ParsedCondition {
  external_id: string
  condition_type: string | null
  title: string
  description: string | null
  description_details: string | null
  category: string | null
  prior_to: string | null
  status: string
  sub_status: string | null
  source: string | null
  requested_from: string | null
  is_received: boolean
  received_date: string | null
  is_cleared: boolean
  cleared_date: string | null
  is_waived: boolean
  waived_date: string | null
  status_date: string | null
  created_date: string | null
  allow_to_clear: boolean
}

export interface ParseResult {
  conditions: ParsedCondition[]
  skipped: number // rows skipped (e.g. isRemoved = true)
  errors: string[] // any parsing warnings
}

// Every lender parser implements this interface
export interface LenderParser {
  lender: string
  parse(buffer: Buffer): ParseResult
}
