import type { LenderParser } from "./types"
import { loganFinanceParser } from "./logan-finance"

// Registry of all lender parsers.
// To add a new lender: create a parser file, import it here, add to the map.
const parsers: Record<string, LenderParser> = {
  "Logan Finance": loganFinanceParser,
}

export function getParser(lender: string): LenderParser | null {
  return parsers[lender] ?? null
}

export { type ParsedCondition, type ParseResult, type LenderParser } from "./types"
