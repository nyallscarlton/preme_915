import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib"
import type { LoanData } from "./types"

/**
 * Produce a Uniform Residential Loan Application (URLA / Form 1003) PDF
 * as a Uint8Array, filled from LoanData.
 *
 * v1: drawn from scratch using pdf-lib — mirrors the 9-section URLA
 * structure (borrower, property, loan, assets, liabilities, REO,
 * declarations, HMDA, originator). No dependency on external PDF template.
 *
 * v2 (future): swap to Fannie's official URLA PDF + AcroForm fill — same
 * LoanData input, same call site, different internals.
 */
export async function renderURLA(data: LoanData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const ctx: RenderCtx = { pdf, font, bold, page: pdf.addPage([612, 792]), y: 772, data }

  header(ctx)
  sec1_borrower(ctx)
  sec2_assets_liabilities(ctx)
  sec3_reo(ctx)
  sec4_loan_property(ctx)
  sec5_declarations(ctx)
  sec6_acknowledgments(ctx)
  sec7_hmda(ctx)
  sec8_originator(ctx)
  footer(ctx)

  return pdf.save()
}

type RenderCtx = {
  pdf: PDFDocument
  font: PDFFont
  bold: PDFFont
  page: PDFPage
  y: number
  data: LoanData
}

const LEFT = 50
const RIGHT = 562
const GOLD = rgb(0.6, 0.44, 0)
const INK = rgb(0.1, 0.1, 0.1)

function ensureSpace(ctx: RenderCtx, needed: number): void {
  if (ctx.y - needed < 50) {
    ctx.page = ctx.pdf.addPage([612, 792])
    ctx.y = 772
  }
}

function text(ctx: RenderCtx, t: string, opts: { size?: number; bold?: boolean; x?: number; color?: any } = {}): void {
  const size = opts.size ?? 9
  const y = ctx.y
  const f = opts.bold ? ctx.bold : ctx.font
  ctx.page.drawText(t, { x: opts.x ?? LEFT, y, size, font: f, color: opts.color ?? INK })
}

function newLine(ctx: RenderCtx, delta: number = 12): void {
  ctx.y -= delta
  ensureSpace(ctx, 20)
}

function hr(ctx: RenderCtx): void {
  ctx.page.drawLine({ start: { x: LEFT, y: ctx.y }, end: { x: RIGHT, y: ctx.y }, thickness: 0.5, color: GOLD })
  newLine(ctx, 6)
}

function sectionTitle(ctx: RenderCtx, title: string): void {
  ensureSpace(ctx, 30)
  newLine(ctx, 4)
  ctx.page.drawRectangle({ x: LEFT, y: ctx.y - 2, width: RIGHT - LEFT, height: 14, color: rgb(0.95, 0.9, 0.75) })
  text(ctx, title, { size: 10, bold: true, x: LEFT + 4 })
  newLine(ctx, 16)
}

function field(ctx: RenderCtx, label: string, value: string | null | undefined, x: number = LEFT, w: number = 250): void {
  const val = value == null || value === "" ? "—" : String(value)
  ctx.page.drawText(`${label}:`, { x, y: ctx.y, size: 7, font: ctx.font, color: rgb(0.4, 0.4, 0.4) })
  ctx.page.drawText(val, { x, y: ctx.y - 9, size: 9, font: ctx.bold, color: INK, maxWidth: w })
}

function row(ctx: RenderCtx, fields: Array<{ label: string; value: string | null | undefined; w?: number }>): void {
  ensureSpace(ctx, 25)
  let x = LEFT
  const totalW = RIGHT - LEFT
  const fieldW = fields[0].w ?? Math.floor(totalW / fields.length)
  for (const f of fields) {
    field(ctx, f.label, f.value, x, f.w ?? fieldW - 10)
    x += f.w ?? fieldW
  }
  newLine(ctx, 22)
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function header(ctx: RenderCtx): void {
  text(ctx, "UNIFORM RESIDENTIAL LOAN APPLICATION", { size: 14, bold: true, color: GOLD })
  newLine(ctx, 14)
  text(ctx, "URLA - Fannie Mae Form 1003 equivalent - Generated from MISMO 3.4 XML", { size: 8, color: rgb(0.4, 0.4, 0.4) })
  newLine(ctx, 10)
  const app = ctx.data.loan
  row(ctx, [
    { label: "Application Number", value: app.application_number },
    { label: "Submitted", value: app.submitted_at?.slice(0, 10) },
    { label: "Loan Officer", value: `${app.originator_first_name ?? ""} ${app.originator_last_name ?? ""}`.trim() },
  ])
  hr(ctx)
}

function sec1_borrower(ctx: RenderCtx): void {
  const { loan, borrowers, has_entity_borrower } = ctx.data
  sectionTitle(ctx, "SECTION 1 — Borrower Information")

  text(ctx, "Primary Borrower", { size: 9, bold: true })
  newLine(ctx, 14)
  row(ctx, [
    { label: "Full Name", value: [loan.applicant_first_name, loan.applicant_middle_name, loan.applicant_last_name, loan.applicant_name_suffix].filter(Boolean).join(" ") || loan.applicant_name || null },
    { label: "Date of Birth", value: loan.applicant_dob },
    { label: "SSN (last 4)", value: loan.applicant_ssn ? `***-**-${loan.applicant_ssn.replace(/\D/g, "").slice(-4)}` : null },
  ])
  row(ctx, [
    { label: "Email", value: loan.applicant_email },
    { label: "Phone", value: loan.applicant_phone },
    { label: "Marital Status", value: loan.applicant_marital_status },
  ])
  row(ctx, [
    { label: "Citizenship", value: loan.applicant_citizenship_type },
    { label: "Dependents", value: loan.applicant_dependent_count?.toString() },
    { label: "Credit Score", value: loan.credit_score_exact?.toString() ?? loan.credit_score_range },
  ])
  row(ctx, [
    { label: "Current Address", value: loan.contact_address, w: 300 },
    { label: "City/State/Zip", value: [loan.contact_city, loan.contact_state, loan.contact_zip].filter(Boolean).join(", ") },
  ])
  row(ctx, [
    { label: "Housing Basis", value: loan.applicant_current_residence_basis },
    { label: "Months at Address", value: loan.applicant_current_residence_months?.toString() },
    { label: "Employer", value: loan.employer_name },
  ])

  // Co-borrowers + guarantors
  for (let i = 0; i < borrowers.length; i++) {
    const b = borrowers[i]
    newLine(ctx, 6)
    text(ctx, `${b.role === "Guarantor" ? "Guarantor" : "Co-Borrower"} ${i + 1}`, { size: 9, bold: true })
    newLine(ctx, 14)
    row(ctx, [
      { label: "Full Name", value: [b.first_name, b.middle_name, b.last_name, b.name_suffix].filter(Boolean).join(" ") },
      { label: "Date of Birth", value: b.dob },
      { label: "SSN (last 4)", value: b.ssn ? `***-**-${b.ssn.replace(/\D/g, "").slice(-4)}` : null },
    ])
    row(ctx, [
      { label: "Email", value: b.email },
      { label: "Phone", value: b.phone },
      { label: "Credit Score", value: b.credit_score_exact?.toString() },
    ])
  }

  // Entity
  if (has_entity_borrower) {
    newLine(ctx, 6)
    text(ctx, "Vesting Entity", { size: 9, bold: true })
    newLine(ctx, 14)
    row(ctx, [
      { label: "Legal Name", value: loan.entity_legal_name },
      { label: "Org Type", value: loan.entity_org_type },
      { label: "State of Formation", value: loan.entity_state_of_formation },
    ])
    row(ctx, [
      { label: "Formation Date", value: loan.entity_formation_date },
      { label: "EIN (last 4)", value: loan.entity_ein ? `**-***${loan.entity_ein.replace(/\D/g, "").slice(-4)}` : null },
      { label: "Entity Address", value: [loan.entity_address, loan.entity_city, loan.entity_state, loan.entity_zip].filter(Boolean).join(", ") },
    ])
  }
}

function sec2_assets_liabilities(ctx: RenderCtx): void {
  const { assets, liabilities } = ctx.data
  sectionTitle(ctx, "SECTION 2 — Financial Information: Assets and Liabilities")

  text(ctx, "Assets", { size: 9, bold: true })
  newLine(ctx, 14)
  if (assets.length === 0) {
    text(ctx, "No assets reported.", { size: 8, color: rgb(0.5, 0.5, 0.5) })
    newLine(ctx, 12)
  } else {
    for (const a of assets) {
      row(ctx, [
        { label: "Type", value: a.asset_type },
        { label: "Institution", value: a.holder_name },
        { label: "Account", value: a.account_identifier },
        { label: "Value", value: money(a.cash_or_market_value_amount) },
      ])
    }
  }

  newLine(ctx, 4)
  text(ctx, "Liabilities", { size: 9, bold: true })
  newLine(ctx, 14)
  if (liabilities.length === 0) {
    text(ctx, "No liabilities reported.", { size: 8, color: rgb(0.5, 0.5, 0.5) })
    newLine(ctx, 12)
  } else {
    for (const l of liabilities) {
      row(ctx, [
        { label: "Type", value: l.liability_type },
        { label: "Creditor", value: l.holder_name },
        { label: "Balance", value: money(l.unpaid_balance_amount) },
        { label: "Monthly", value: money(l.monthly_payment_amount) },
      ])
    }
  }
}

function sec3_reo(ctx: RenderCtx): void {
  const reo = ctx.data.reo_properties.filter((r) => !r.is_subject)
  sectionTitle(ctx, "SECTION 3 — Real Estate Owned (REO) Schedule")
  if (reo.length === 0) {
    text(ctx, "No existing real estate reported.", { size: 8, color: rgb(0.5, 0.5, 0.5) })
    newLine(ctx, 12)
    return
  }
  for (let i = 0; i < reo.length; i++) {
    const r = reo[i]
    text(ctx, `Property ${i + 1} — ${r.address_line1}, ${r.city}, ${r.state} ${r.postal_code}`, { size: 9, bold: true })
    newLine(ctx, 14)
    row(ctx, [
      { label: "Status", value: r.disposition_status },
      { label: "Market Value", value: money(r.present_market_value) },
      { label: "Lien Balance", value: money(r.lien_upb_amount) },
      { label: "Monthly Payment", value: money(r.monthly_mortgage_payment) },
    ])
    row(ctx, [
      { label: "Units", value: String(r.unit_count) },
      { label: "Gross Rent", value: money(r.monthly_rental_income_gross) },
      { label: "Net Rent", value: money(r.monthly_rental_income_net) },
      { label: "Expenses", value: money(r.monthly_maintenance_expense) },
    ])
    newLine(ctx, 4)
  }
}

function sec4_loan_property(ctx: RenderCtx): void {
  const { loan } = ctx.data
  sectionTitle(ctx, "SECTION 4 — Loan and Subject Property")
  row(ctx, [
    { label: "Loan Amount", value: money(loan.loan_amount) },
    { label: "Loan Purpose", value: loan.loan_purpose },
    { label: "Mortgage Type", value: loan.mortgage_type },
    { label: "Lien Priority", value: loan.lien_priority },
  ])
  row(ctx, [
    { label: "Term (months)", value: loan.loan_term_months?.toString() },
    { label: "Note Rate %", value: loan.note_rate_percent?.toString() },
    { label: "Amortization", value: loan.amortization_type },
    { label: "Interest-Only", value: loan.interest_only ? "Yes" : "No" },
  ])
  newLine(ctx, 4)
  text(ctx, "Subject Property", { size: 9, bold: true })
  newLine(ctx, 14)
  row(ctx, [
    { label: "Address", value: loan.property_address, w: 300 },
    { label: "City/State/Zip", value: [loan.property_city, loan.property_state, loan.property_zip].filter(Boolean).join(", ") },
  ])
  row(ctx, [
    { label: "County", value: loan.property_county },
    { label: "Usage", value: loan.property_usage_type },
    { label: "Occupancy", value: loan.current_occupancy_type },
    { label: "Units", value: loan.financed_unit_count?.toString() },
  ])
  row(ctx, [
    { label: "Year Built", value: loan.year_built?.toString() },
    { label: "Sq Ft", value: loan.gross_living_area_sqft?.toString() },
    { label: "Acreage", value: loan.acreage?.toString() },
    { label: "Est. Value", value: money(loan.property_value) },
  ])
  if (loan.loan_purpose?.toLowerCase().includes("refi")) {
    row(ctx, [
      { label: "Acquired", value: loan.property_acquired_date },
      { label: "Original Cost", value: money(loan.property_original_cost) },
      { label: "Existing Lien", value: money(loan.property_existing_lien_amount) },
    ])
  }
  newLine(ctx, 4)
  text(ctx, "Subject Property — Rental Cash Flow (DSCR)", { size: 9, bold: true })
  newLine(ctx, 14)
  row(ctx, [
    { label: "Gross Monthly Rent", value: money(loan.rental_gross_monthly) },
    { label: "Net Monthly Rent", value: money(loan.rental_net_monthly) },
    { label: "DSCR Ratio", value: loan.dscr_ratio?.toString() },
    { label: "Rent Source", value: loan.dscr_rent_source },
  ])
  row(ctx, [
    { label: "Annual Tax", value: money(loan.annual_property_tax) },
    { label: "Hazard Ins (mo)", value: money(loan.hazard_insurance_monthly) },
    { label: "HOA (mo)", value: money(loan.hoa_monthly) },
    { label: "PM Fee (mo)", value: money(loan.property_mgmt_fee_monthly) },
  ])
  const hasDealFields =
    loan.renovation_costs != null ||
    loan.anticipated_arv != null ||
    loan.project_summary ||
    loan.exit_strategy ||
    loan.target_closing_date ||
    loan.funds_available_for_project != null
  if (hasDealFields) {
    newLine(ctx, 4)
    text(ctx, "Deal Structure", { size: 9, bold: true })
    newLine(ctx, 14)
    row(ctx, [
      { label: "Renovation Costs", value: money(loan.renovation_costs) },
      { label: "Anticipated ARV", value: money(loan.anticipated_arv) },
      { label: "Funds Available (Project)", value: money(loan.funds_available_for_project) },
      { label: "Flood Zone", value: loan.flood_zone === true ? "Yes" : loan.flood_zone === false ? "No" : null },
    ])
    row(ctx, [
      { label: "Target Closing Date", value: loan.target_closing_date },
      { label: "Reason for Target Date", value: loan.target_closing_reason, w: 350 },
    ])
    if (loan.project_summary) {
      newLine(ctx, 4)
      text(ctx, "Project Summary:", { size: 8, bold: true })
      newLine(ctx, 11)
      ensureSpace(ctx, 30)
      drawWrapped(ctx, loan.project_summary, 8, 10)
      newLine(ctx, 4)
    }
    if (loan.exit_strategy) {
      newLine(ctx, 4)
      text(ctx, "Exit Strategy:", { size: 8, bold: true })
      newLine(ctx, 11)
      ensureSpace(ctx, 30)
      drawWrapped(ctx, loan.exit_strategy, 8, 10)
      newLine(ctx, 4)
    }
  }
}

function sec5_declarations(ctx: RenderCtx): void {
  const d = ctx.data.primary_declaration
  sectionTitle(ctx, "SECTION 5 — Declarations")
  if (!d) {
    text(ctx, "Declarations not yet captured.", { size: 8, color: rgb(0.5, 0.5, 0.5) })
    newLine(ctx, 12)
    return
  }
  const items: Array<[string, boolean | null]> = [
    ["Will you occupy the property as your primary residence?", d.intent_to_occupy],
    ["Have you owned a home in the past 3 years?", d.homeowner_past_3yrs],
    ["Have you declared bankruptcy in the past 7 years?", d.bankruptcy],
    ["Are there any outstanding judgments against you?", d.outstanding_judgments],
    ["Are you currently a party to a lawsuit?", d.party_to_lawsuit],
    ["Are you presently delinquent on any federal debt?", d.presently_delinquent_federal_debt],
    ["Have you undisclosed borrowed funds for down payment?", d.undisclosed_borrowed_funds],
    ["Have you applied for a mortgage not disclosed on this app?", d.undisclosed_mortgage_application],
    ["Have you applied for other credit not disclosed?", d.undisclosed_credit_application],
    ["Are you a co-maker or endorser of a note?", d.undisclosed_comaker],
    ["Have you conveyed title via deed in lieu in past 7 years?", d.prior_deed_in_lieu],
    ["Have you completed a short sale in past 7 years?", d.prior_short_sale],
    ["Have you completed a foreclosure in past 7 years?", d.prior_foreclosure],
    ["Is there a proposed clean-energy (PACE) lien?", d.proposed_clean_energy_lien],
  ]
  for (const [q, ans] of items) {
    ensureSpace(ctx, 12)
    const mark = ans === true ? "[X] Yes   [ ] No " : ans === false ? "[ ] Yes   [X] No " : "[ ] Yes   [ ] No "
    text(ctx, `${mark}  ${q}`, { size: 8 })
    newLine(ctx, 11)
  }
  if (d.bankruptcy && d.bankruptcy_chapter) {
    newLine(ctx, 4)
    row(ctx, [
      { label: "Bankruptcy Chapter", value: d.bankruptcy_chapter },
      { label: "Filed", value: d.bankruptcy_filed_date },
      { label: "Discharged", value: d.bankruptcy_discharged_date },
    ])
  }
}

function sec6_acknowledgments(ctx: RenderCtx): void {
  sectionTitle(ctx, "SECTION 6 — Acknowledgments and Agreements")
  const loan = ctx.data.loan
  const lines = [
    "Each Borrower and Co-Borrower hereby certifies that the information provided herein is true and correct to the best of their knowledge.",
    "By signing below, each Borrower authorizes the Lender to verify any information provided and to obtain a consumer credit report.",
  ]
  for (const l of lines) {
    ensureSpace(ctx, 20)
    drawWrapped(ctx, l, 8, 10)
    newLine(ctx, 4)
  }
  newLine(ctx, 4)
  row(ctx, [
    { label: "Credit Authorization", value: loan.credit_report_authorization_indicator ? "Granted" : "NOT granted" },
    { label: "Arms-Length Indicator", value: loan.arms_length ? "Yes" : "No" },
    { label: "Signed Date", value: loan.applicant_signed_date },
  ])
}

function sec7_hmda(ctx: RenderCtx): void {
  const { loan } = ctx.data
  sectionTitle(ctx, "SECTION 7 — HMDA Demographic Information (Optional)")
  row(ctx, [
    { label: "Ethnicity", value: loan.hmda_ethnicity?.join(", ") ?? (loan.hmda_ethnicity_refused ? "Refused" : null) },
    { label: "Race", value: loan.hmda_race?.join(", ") ?? (loan.hmda_race_refused ? "Refused" : null) },
    { label: "Sex", value: loan.hmda_gender },
  ])
}

function sec8_originator(ctx: RenderCtx): void {
  const { loan, origin_company } = ctx.data
  sectionTitle(ctx, "SECTION 8 — Loan Originator Information")
  row(ctx, [
    { label: "Loan Officer", value: `${loan.originator_first_name ?? ""} ${loan.originator_last_name ?? ""}`.trim() },
    { label: "LO NMLS", value: loan.originator_nmls_individual },
    { label: "Company NMLS", value: loan.originator_nmls_company || origin_company.nmls },
  ])
  row(ctx, [
    { label: "Company", value: origin_company.name, w: 300 },
    { label: "Phone", value: origin_company.phone },
  ])
  row(ctx, [
    { label: "Company Address", value: [origin_company.address, origin_company.city, origin_company.state, origin_company.zip].filter(Boolean).join(", ") },
  ])
}

function footer(ctx: RenderCtx): void {
  ctx.page.drawText(
    `Generated from MISMO 3.4 XML - ${ctx.data.generated_at} - Preme Home Loans - ${ctx.data.loan.application_number ?? ctx.data.loan.id}`,
    { x: LEFT, y: 32, size: 7, font: ctx.font, color: rgb(0.5, 0.5, 0.5) }
  )
}

function drawWrapped(ctx: RenderCtx, t: string, size: number, lineHeight: number, width: number = RIGHT - LEFT): void {
  const words = t.split(" ")
  let line = ""
  for (const w of words) {
    const probe = line.length ? `${line} ${w}` : w
    if (ctx.font.widthOfTextAtSize(probe, size) > width) {
      ensureSpace(ctx, lineHeight + 4)
      text(ctx, line, { size })
      newLine(ctx, lineHeight)
      line = w
    } else {
      line = probe
    }
  }
  if (line) {
    ensureSpace(ctx, lineHeight + 4)
    text(ctx, line, { size })
    newLine(ctx, lineHeight)
  }
}

function money(n: number | string | null | undefined): string | null {
  if (n == null || n === "") return null
  const v = Number(n)
  if (!isFinite(v)) return null
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
