import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const { data: application, error } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("guest_token", token)
      .single()

    if (error || !application) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired access link" },
        { status: 404 }
      )
    }

    // Track first open
    if (!application.first_opened_at) {
      await supabase
        .from("loan_applications")
        .update({ first_opened_at: new Date().toISOString() })
        .eq("id", application.id)
    }

    // Child tables — pull in parallel for prefill
    const [declRes, reoRes] = await Promise.all([
      supabase.from("loan_declarations").select("*").eq("loan_application_id", application.id).is("borrower_id", null).maybeSingle(),
      supabase.from("loan_reo_properties").select("*").eq("loan_application_id", application.id),
    ])
    const declaration = declRes.data
    const reoProperties = reoRes.data ?? []

    // Map to the shape the guest dashboard / apply form expects.
    // Prefills every field the user has already answered (pre-qual or otherwise).
    const nameParts = (application.applicant_name || "").split(" ").filter(Boolean)
    const mapped = {
      id: application.application_number || application.id,
      applicationId: application.id,
      applicationNumber: application.application_number,
      guestToken: application.guest_token,
      status: application.status,
      isPreQual: application.is_pre_qual === true,
      submittedAt: application.submitted_at || application.created_at,
      preQualifiedAt: application.pre_qualified_at,
      preQualLenderMatch: application.pre_qual_lender_match,

      // Identity
      email: application.applicant_email,
      firstName: application.applicant_first_name || nameParts[0] || "",
      middleName: application.applicant_middle_name || "",
      lastName: application.applicant_last_name || nameParts.slice(1).join(" ") || "",
      nameSuffix: application.applicant_name_suffix || "",
      phone: application.applicant_phone,
      dateOfBirth: application.applicant_dob || "",
      citizenshipType: application.applicant_citizenship_type || "",
      maritalStatus: application.applicant_marital_status || "",
      dependentCount: application.applicant_dependent_count ?? "",
      currentResidenceBasis: application.applicant_current_residence_basis || "",
      currentResidenceMonths: application.applicant_current_residence_months ?? "",
      address: application.contact_address || "",
      city: application.contact_city || "",
      state: application.contact_state || "",
      zipCode: application.contact_zip || "",
      // SSN NEVER sent back to the client. Borrower re-enters if needed.

      // Loan terms
      loanAmount: application.loan_amount || "",
      loanPurpose: application.loan_purpose || "",
      loanType: application.loan_type || "",
      mortgageType: application.mortgage_type || "Conventional",
      loanTermMonths: String(application.loan_term_months ?? 360),
      amortizationType: application.amortization_type || "Fixed",
      noteRatePercent: application.note_rate_percent ?? "",
      interestOnly: !!application.interest_only,
      balloon: !!application.balloon,
      hasPrepayPenalty: application.has_prepay_penalty ?? true,
      isRenovationLoan: !!application.is_renovation_loan,
      totalMortgagedPropertiesCount: application.total_mortgaged_properties_count ?? "",
      propertyAcquiredDate: application.property_acquired_date || "",
      propertyOriginalCost: application.property_original_cost ?? "",
      propertyExistingLienAmount: application.property_existing_lien_amount ?? "",

      // Property
      propertyAddress: application.property_address || "",
      propertyCity: application.property_city || "",
      propertyState: application.property_state || "",
      propertyZip: application.property_zip || "",
      propertyCounty: application.property_county || "",
      propertyType: application.property_type || "",
      propertyValue: application.property_value || "",
      propertyUsageType: application.property_usage_type || "Investment",
      currentOccupancy: application.current_occupancy_type || "",
      financedUnitCount: String(application.financed_unit_count ?? 1),
      yearBuilt: application.year_built ?? "",
      grossLivingAreaSqft: application.gross_living_area_sqft ?? "",
      acreage: application.acreage ?? "",
      attachmentType: application.attachment_type || "Detached",
      isPUD: !!application.is_pud,

      // Rental + PITIA
      rentalGrossMonthly: application.rental_gross_monthly ?? "",
      rentalOccupancyPct: application.rental_occupancy_pct ?? 95,
      leaseRentMonthly: application.lease_rent_monthly ?? "",
      leaseExpirationDate: application.lease_expiration_date || "",
      isShortTermRental: !!application.is_short_term_rental,
      annualPropertyTax: application.annual_property_tax ?? "",
      hazardInsuranceMonthly: application.hazard_insurance_monthly ?? "",
      hoaMonthly: application.hoa_monthly ?? "",
      floodInsuranceMonthly: application.flood_insurance_monthly ?? "",
      propertyMgmtFeeMonthly: application.property_mgmt_fee_monthly ?? "",

      // Vesting & entity
      vestingType: application.vesting_type || "Individual",
      entityLegalName: application.entity_legal_name || "",
      entityOrgType: application.entity_org_type || "LLC",
      entityStateOfFormation: application.entity_state_of_formation || "",
      entityFormationDate: application.entity_formation_date || "",
      // entityEIN NEVER sent back to the client.
      entityAddress: application.entity_address || "",
      entityCity: application.entity_city || "",
      entityState: application.entity_state || "",
      entityZip: application.entity_zip || "",

      // Financial
      annualIncome: application.annual_income || "",
      employmentStatus: application.employment_status || "",
      employerName: application.employer_name || "",
      creditScore: application.credit_score_range || "",
      creditScoreExact: application.credit_score_exact ?? "",

      // Declarations (prefixed to match the form-state shape)
      ...(declaration
        ? {
            decl_intent_to_occupy: declaration.intent_to_occupy,
            decl_homeowner_past_3yrs: declaration.homeowner_past_3yrs,
            decl_bankruptcy: declaration.bankruptcy,
            decl_bankruptcy_chapter: declaration.bankruptcy_chapter,
            decl_bankruptcy_filed_date: declaration.bankruptcy_filed_date,
            decl_bankruptcy_discharged_date: declaration.bankruptcy_discharged_date,
            decl_outstanding_judgments: declaration.outstanding_judgments,
            decl_party_to_lawsuit: declaration.party_to_lawsuit,
            decl_presently_delinquent_federal_debt: declaration.presently_delinquent_federal_debt,
            decl_undisclosed_borrowed_funds: declaration.undisclosed_borrowed_funds,
            decl_undisclosed_borrowed_funds_amount: declaration.undisclosed_borrowed_funds_amount,
            decl_undisclosed_mortgage_application: declaration.undisclosed_mortgage_application,
            decl_undisclosed_credit_application: declaration.undisclosed_credit_application,
            decl_undisclosed_comaker: declaration.undisclosed_comaker,
            decl_prior_deed_in_lieu: declaration.prior_deed_in_lieu,
            decl_prior_short_sale: declaration.prior_short_sale,
            decl_prior_foreclosure: declaration.prior_foreclosure,
            decl_proposed_clean_energy_lien: declaration.proposed_clean_energy_lien,
          }
        : {}),

      // HMDA
      hmda_gender: application.hmda_gender || "",
      hmda_ethnicity_refused: application.hmda_ethnicity_refused ?? true,
      hmda_race_refused: application.hmda_race_refused ?? true,

      // REO repeater
      reoProperties: reoProperties.map((r) => ({
        address_line1: r.address_line1,
        city: r.city,
        state: r.state,
        postal_code: r.postal_code,
        disposition_status: r.disposition_status,
        usage_type: r.usage_type,
        present_market_value: r.present_market_value,
        lien_upb_amount: r.lien_upb_amount,
        monthly_mortgage_payment: r.monthly_mortgage_payment,
        monthly_rental_income_gross: r.monthly_rental_income_gross,
        monthly_rental_income_net: r.monthly_rental_income_net,
        monthly_maintenance_expense: r.monthly_maintenance_expense,
        unit_count: r.unit_count,
      })),

      // Liquidity (legacy aggregates)
      cashReserves: application.cash_reserves || 0,
      investmentAccounts: application.investment_accounts || 0,
      retirementAccounts: application.retirement_accounts || 0,

      // TCPA already consented during pre-qual
      tcpaConsent: true,
      statusHistory: [
        {
          status: "submitted",
          date: application.submitted_at || application.created_at,
          message: "Your application has been received and is being processed.",
        },
        ...(application.status !== "submitted"
          ? [
              {
                status: application.status,
                date: application.updated_at || application.created_at,
                message: `Application status updated to ${application.status.replace("_", " ")}.`,
              },
            ]
          : []),
      ],
      nextSteps: getNextSteps(application.status),
    }

    return NextResponse.json({ ok: true, application: mapped })
  } catch (error) {
    console.error("Token verification error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to verify token" },
      { status: 500 }
    )
  }
}

function getNextSteps(status: string): string[] {
  switch (status) {
    case "submitted":
      return [
        "Our team is reviewing your application",
        "You may be contacted for additional documentation",
        "Expected response within 2-3 business days",
      ]
    case "under_review":
      return [
        "Your application is under detailed review",
        "Underwriting analysis in progress",
        "We may request additional documents",
      ]
    case "approved":
      return [
        "Congratulations! Your loan is approved",
        "Create an account to manage your loan",
        "Closing documents will be prepared",
      ]
    case "rejected":
      return [
        "We were unable to approve this application",
        "Contact us to discuss alternative options",
        "You may reapply after addressing the concerns",
      ]
    default:
      return ["Your application is being processed"]
  }
}
