import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib"
import { type ScenarioResult, type TermSheetInputs, TERM_SHEET_DISCLAIMER } from "./term-sheet-math"

const GOLD = rgb(0.6, 0.44, 0)
const INK = rgb(0.1, 0.1, 0.1)
const GRAY = rgb(0.45, 0.45, 0.45)
const LEFT = 46
const RIGHT = 566

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`

/** One-page, three-column business-purpose term sheet. */
export async function renderTermSheetPdf(args: {
  borrowerName: string
  entityName?: string | null
  propertyAddress: string
  applicationNumber: string | null
  inputs: TermSheetInputs
  scenarios: ScenarioResult[]
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let y = 750

  const text = (t: string, x: number, size = 9, f: PDFFont = font, color = INK) =>
    page.drawText(t, { x, y, size, font: f, color })
  const line = (dy = 14) => { y -= dy }

  // Header
  text("PREME HOME LOANS", LEFT, 18, bold, GOLD)
  line(16)
  text("BUSINESS-PURPOSE LOAN TERM SHEET", LEFT, 11, bold)
  page.drawText(new Date().toLocaleDateString("en-US"), { x: RIGHT - 60, y: y + 16, size: 9, font, color: GRAY })
  line(18)

  text(`Prepared for: ${args.borrowerName}${args.entityName ? `  ·  Vesting: ${args.entityName}` : ""}`, LEFT, 9)
  line(12)
  text(`Property: ${args.propertyAddress}   ·   ${args.inputs.purpose.replace(/-/g, " ")}   ·   Ref: ${args.applicationNumber || ""}`, LEFT, 9, font, GRAY)
  line(18)

  // Scenario table
  const i = args.inputs
  const cols = [230, 342, 454] // x for each scenario column
  const isPurchase = i.purpose === "purchase"

  page.drawRectangle({ x: LEFT - 4, y: y - 4, width: RIGHT - LEFT + 8, height: 16, color: rgb(0.96, 0.92, 0.82) })
  args.scenarios.forEach((s, idx) => text(s.label, cols[idx], 9, bold))
  line(20)

  const row = (label: string, vals: (string | null)[], boldRow = false, color = INK) => {
    text(label, LEFT, 8.5, boldRow ? bold : font, color)
    vals.forEach((v, idx) => { if (v != null) text(v, cols[idx], 8.5, boldRow ? bold : font, color) })
    line(13)
  }

  const S = args.scenarios
  const isShortTerm = i.purpose === "bridge" || i.purpose === "fix-flip"
  row("Loan Amount / LTV", S.map((s) => `${money(i.loanAmount)}  (${s.ltv.toFixed(1)}%)`))
  if (i.purpose === "fix-flip" && S[0].rehabHoldback > 0) {
    row("Rehab Holdback (via draws)", S.map((s) => money(s.rehabHoldback)))
    row("Total Loan / ARV LTV / LTC", S.map((s) => `${money(s.totalLoan)}${s.arvLtv != null ? ` · ${s.arvLtv.toFixed(0)}% ARV` : ""}${s.ltc != null ? ` · ${s.ltc.toFixed(0)}% LTC` : ""}`))
  }
  row("Interest Rate", S.map((s) => `${s.ratePercent.toFixed(3)}%`))
  row(
    isShortTerm ? "Term / Structure" : `Term / ${i.interestOnly ? "Interest-Only" : "Amortization"}`,
    S.map(() => (isShortTerm ? `${i.termMonths} mo interest-only` : `${Math.round(i.termMonths / 12)} yr${i.interestOnly ? " IO" : " fixed"}`))
  )
  row("Monthly P&I", S.map((s) => money(s.monthlyPI)))
  row("Est. Taxes + Ins + HOA (mo)", S.map((s) => money(s.monthlyPITIA - s.monthlyPI)))
  row("Total Monthly Payment", S.map((s) => money(s.monthlyPITIA)), true)
  if (S[0].dscr != null) row("DSCR (rent ÷ payment)", S.map((s) => (s.dscr == null ? "—" : s.dscr.toFixed(2))))
  if (S[0].holdingCost != null) row("Est. Interest Carry (hold)", S.map((s) => (s.holdingCost == null ? "—" : money(s.holdingCost))))
  line(4)

  row("Broker Origination (Preme)", S.map((s) => `${s.brokerPoints.toFixed(2)} pts — ${money(s.brokerFee)}`))
  row("Lender Points", S.map((s) => `${s.lenderPoints.toFixed(2)} pts — ${money(s.lenderPointsCost)}`))
  row("Lender Fees (UW/processing)", S.map((s) => money(s.lenderFlatFees)))
  row("Title, Appraisal, Gov (est.)", S.map((s) => money(s.thirdPartyFees)))
  row("Prepaids & Escrows (est.)", S.map((s) => money(s.prepaids)))
  row("Total Loan Costs", S.map((s) => money(s.totalCosts)), true)
  line(4)

  if (isPurchase) {
    row("Down Payment", S.map((s) => money(s.downPayment)))
    if (S.some((s) => s.sellerCredit > 0)) row("Seller Credit", S.map((s) => (s.sellerCredit ? `(${money(s.sellerCredit)})` : "—")))
  } else {
    row("Existing Loan Payoff", S.map((s) => money(s.payoff)))
    row("New Loan Proceeds", S.map(() => `(${money(i.loanAmount)})`))
  }
  line(2)

  page.drawRectangle({ x: LEFT - 4, y: y - 5, width: RIGHT - LEFT + 8, height: 18, color: rgb(0.6, 0.44, 0) })
  text(isPurchase ? "ESTIMATED CASH TO CLOSE" : "EST. CASH TO CLOSE (negative = cash to you)", LEFT, 9.5, bold, rgb(1, 1, 1))
  S.forEach((s, idx) => text(money(s.cashToClose), cols[idx], 10, bold, rgb(1, 1, 1)))
  line(24)

  row("Reserves to document (~6 mo)", S.map((s) => money(s.reservesSuggested)), false, GRAY)
  line(8)

  // Disclaimer
  const words = TERM_SHEET_DISCLAIMER.split(" ")
  let lineText = ""
  const flush = () => { if (lineText) { text(lineText, LEFT, 7, font, GRAY); line(9); lineText = "" } }
  for (const w of words) {
    const candidate = lineText ? `${lineText} ${w}` : w
    if (font.widthOfTextAtSize(candidate, 7) > RIGHT - LEFT) flush()
    lineText = lineText ? `${lineText} ${w}` : w
  }
  flush()
  line(6)
  text("Preme Home Loans LLC · (470) 942-5787 · premerealestate.com", LEFT, 7.5, font, GRAY)

  return pdf.save()
}
