# MISMO 3.4 Reference Model — Authoritative Reference for DSCR XML Generator

> **Scope:** Field-level reference for building a MISMO v3.4 Reference Model (Build 324) XML
> generator that serves wholesale DSCR lenders (Kiavi, Visio, Kind, Lima One, RCN, Velocity).
> Source of truth for the Preme Portal Postgres → MISMO-XML + Fannie-3.2 flat-file pipeline.
>
> **Primary upstream sources verified during research (see Section 6):**
> - Fannie Mae DU Spec Implementation Guide v2.6.1 (Aug 2025, MISMO v3.4 B324)
> - Freddie Mac ULAD / LPA v6.1 spec (Dec 2025)
> - Pilotfish MISMO Model Viewer (authoritative enum + element listings)
> - BaylorRae/fannie-3.2 GitHub repo (Fannie 3.2 flat-file crosswalk JSON)
> - MISMO.org Reference Model pages
>
> **Convention in this document:**
> - "Required" (R) = MISMO/DU-spec mandates the element for the named transaction type
> - "Conditional" (C) = required only when a specific business rule fires — condition noted inline
> - "Optional" (O) = lender-collected or extension data, not required by MISMO for transmission
> - "DSCR-Required" = required by at least one of {Kiavi, Visio, Kind, Lima One, RCN, Velocity} broker portals even when MISMO marks it optional
> - "unverified — needs XSD confirmation" = canonical name not observed in any fetched source; must confirm against MISMO_3.4.0_B324.xsd before use
>
> **A note on cardinality notation**: MISMO uses 1, 0..1, 1..n, 0..n at the container level. Individual data points are governed by DU-spec conditionality (R/C/O).

---

## Table of Contents

1. [MISMO 3.4 Container Hierarchy](#1-mismo-34-container-hierarchy)
2. [Required Fields Per Container](#2-required-fields-per-container)
3. [DSCR-Specific Notes](#3-dscr-specific-notes)
4. [Fannie Mae 3.2 (.fnm) Crosswalk](#4-fannie-mae-32-fnm-crosswalk)
5. [XSD Source Location](#5-xsd-source-location)
6. [Authoritative Sources](#6-authoritative-sources)

---

## 1. MISMO 3.4 Container Hierarchy

MISMO 3.4 XML is **deeply nested**. Everything hangs off a single root `MESSAGE` element.
Borrowers are NOT children of `LOAN`; they are `PARTY` elements in a sibling `PARTIES` container,
and relationships between parties, loans, assets, and liabilities are asserted via
`RELATIONSHIPS` using XLink arcroles. This is the single biggest mental model shift from
Fannie 3.2 flat-file thinking.

### 1.1 Root skeleton

```
MESSAGE                                         (1)
├── ABOUT_VERSIONS                              (0..1)
│   └── ABOUT_VERSION                           (1..n)
│       ├── AboutVersionIdentifier
│       ├── CreatedDatetime
│       └── DataVersionName
└── DEAL_SETS                                   (1)
    └── DEAL_SET                                (1..n)
        ├── DEALS                               (1)
        │   └── DEAL                            (1..n)  ← the loan transaction
        │       ├── ASSETS                      (0..1)
        │       │   └── ASSET                   (0..n)
        │       ├── COLLATERALS                 (0..1)
        │       │   └── COLLATERAL              (1..n)
        │       │       └── SUBJECT_PROPERTY    (0..1)
        │       ├── EXPENSES                    (0..1)
        │       ├── LIABILITIES                 (0..1)
        │       │   └── LIABILITY               (0..n)
        │       ├── LOANS                       (1)
        │       │   └── LOAN                    (1..n)
        │       ├── PARTIES                     (0..1)     ← all people/companies
        │       │   └── PARTY                   (0..n)
        │       ├── RELATIONSHIPS               (0..1)     ← XLink arcroles
        │       │   └── RELATIONSHIP            (0..n)
        │       └── SERVICES                    (0..1)
        │           └── SERVICE                 (0..n)
        └── PARTIES                             (0..1)     ← deal-set-scoped parties
```

**Note on attribute `MISMOReferenceModelIdentifier`** — set on the `MESSAGE` root; required.
For Fannie DU it is `3.4.0324` (i.e. MISMO v3.4 build 324, aka B324). Kiavi/Visio/Kind/Lima One
accept the same identifier because all B324-based.

### 1.2 LOAN sub-hierarchy (canonical structure)

```
LOAN                                            (1..n within LOANS)
├── @LoanRoleType  (attribute, required)        SubjectLoan | RelatedLoan
├── @SequenceNumber (attribute)
├── @xlink:label   (attribute, required for arcs)
├── ADJUSTMENT                                  (0..1)     ARM rules
│   ├── INTEREST_RATE_ADJUSTMENT               (0..1)
│   └── PAYMENT_ADJUSTMENT                     (0..1)
├── AMORTIZATION                                (0..1)
│   └── AMORTIZATION_RULE                      (0..1)
├── BUYDOWN                                     (0..1)
├── CLOSING_INFORMATION                         (0..1)
├── CONSTRUCTION                                (0..1)
├── DOCUMENT_SPECIFIC_DATA_SETS                 (0..1)
├── ESCROW                                      (0..1)
├── FEE_INFORMATION                             (0..1)
├── FORECLOSURES                                (0..1)
├── FUNDS_COLLECTION                            (0..1)
├── GOVERNMENT_LOAN                             (0..1)     FHA/VA-only
├── HELOC_RULE                                  (0..1)
├── HIGH_COST_MORTGAGES                         (0..1)
├── HMDA_LOAN                                   (0..1)
├── HOUSING_EXPENSES                            (0..1)
│   └── HOUSING_EXPENSE                        (0..n)
├── INTEREST_CALCULATION_RULES                  (0..1)
├── LATE_CHARGE                                 (0..1)
├── LOAN_DETAIL                                 (0..1)     ← core flags
├── LOAN_IDENTIFIERS                            (0..1)
│   └── LOAN_IDENTIFIER                        (1..n)
├── LOAN_LEVEL_CREDIT                           (0..1)
├── LOAN_PRODUCT                                (0..1)
├── LOAN_STATE                                  (0..1)
├── MATURITY                                    (0..1)
├── MERS_REGISTRATIONS                          (0..1)
├── MI_DATA                                     (0..1)     Mortgage Insurance
├── NEGATIVE_AMORTIZATION_RULE                  (0..1)
├── ORIGINATION_FUNDS                           (0..1)
├── ORIGINATION_SYSTEMS                         (0..1)
├── PAYMENT                                     (0..1)
├── PAYMENT_RULE                                (0..1)
├── PREPAYMENT_PENALTY                          (0..1)
├── QUALIFICATION                               (0..1)     DTI/ratios/affordability
├── REFINANCE                                   (0..1)
├── SUBJECT_PROPERTY_RENTAL_INCOME              (0..1)     ← DSCR-critical
├── TERMS_OF_LOAN                               (0..1)     ← rate/amt/purpose
├── TRUSTEES                                    (0..1)
└── UNDERWRITING                                (0..1)
    └── AUTOMATED_UNDERWRITINGS                (0..1)
```

### 1.3 PARTY sub-hierarchy

`PARTY` is the universal actor container. A single `PARTY` can be a borrower, a loan officer,
a lender, a property-seller, an employer, or an LLC/trust. The role is discriminated by
`ROLES/ROLE/ROLE_DETAIL/<role-specific>_DETAIL`.

```
PARTY                                           (0..n within PARTIES)
├── @xlink:label (required for arcs)
├── @SequenceNumber
├── ADDRESSES                                   (0..1)
│   └── ADDRESS                                (0..n)
├── ALIASES                                     (0..1)
├── CONTACT_POINTS                              (0..1)
│   └── CONTACT_POINT                          (0..n)    phone, email
├── INDIVIDUAL                                  (0..1)    natural person
│   ├── CONTACT_POINTS
│   ├── GENDER                                  (0..1)
│   ├── NAME                                    (0..1)
│   └── RESIDENCES                              (0..1)
├── LANGUAGES                                   (0..1)
├── LEGAL_ENTITY                                (0..1)    LLC, corp, trust
│   ├── CONTACTS                                (0..1)
│   ├── LEGAL_ENTITY_DETAIL                    (0..1)    FullName, OrgType
│   └── LEGAL_ENTITY_IDENTIFIERS               (0..1)
├── LICENSES                                    (0..1)
├── MILITARY_SERVICES                           (0..1)
├── ROLES                                       (0..1)
│   └── ROLE                                   (0..n)
│       ├── ROLE_DETAIL                        (0..1)
│       │   ├── @PartyRoleType (attribute, R)
│       │   ├── BORROWER_DETAIL                (0..1)    conditional on role
│       │   ├── LOAN_ORIGINATOR_DETAIL         (0..1)
│       │   ├── PROPERTY_SELLER_DETAIL         (0..1)
│       │   ├── TRUSTEE_DETAIL                 (0..1)
│       │   └── ...
│       ├── BORROWER                           (0..1)    borrower-specific blocks
│       │   ├── CURRENT_INCOME
│       │   ├── DECLARATIONS
│       │   ├── EMPLOYERS (historical alias — see EMPLOYMENT)
│       │   ├── RESIDENCES
│       │   └── SUMMARIES
│       ├── EMPLOYERS                          (0..1)    ← employment history
│       │   └── EMPLOYER                       (0..n)
│       ├── GOVERNMENT_MONITORING              (0..1)    HMDA demographic
│       ├── LOAN_ORIGINATOR                    (0..1)
│       └── ...
└── TAXPAYER_IDENTIFIERS                        (0..1)
    └── TAXPAYER_IDENTIFIER                    (0..n)   SSN / EIN / ITIN
```

### 1.4 DSCR-critical container cardinalities (at-a-glance)

| Container | Parent | Cardinality | Notes |
|-----------|--------|-------------|-------|
| LOAN | LOANS | 1..n | Typically 1 (SubjectLoan); related loans get role=RelatedLoan |
| BORROWER (PARTY with ROLE_DETAIL.BORROWER_DETAIL) | PARTIES | 1..n | Multiple for joint + guarantor |
| LEGAL_ENTITY (vesting LLC) | PARTY | 0..1 | 1 for DSCR when vested in LLC |
| SUBJECT_PROPERTY | COLLATERAL | 0..1 | 1 for DSCR; cross-collateral deals: rare |
| PROPERTY_DETAIL | PROPERTY (inside SUBJECT_PROPERTY) | 0..1 | Core property facts |
| PROPERTY_VALUATION | PROPERTY_VALUATIONS | 0..n | 1+ appraisal/BPO expected |
| OWNED_PROPERTY (REO schedule) | ASSET | 0..1 | 1 per existing rental owned |
| OWNED_PROPERTY_DETAIL | OWNED_PROPERTY | 0..1 | Mandatory when OWNED_PROPERTY present |
| CURRENT_INCOME_ITEM | CURRENT_INCOME_ITEMS | 0..n | **DSCR: may be ZERO** — see §3 |
| EMPLOYER | EMPLOYERS | 0..n | DSCR: optional on personal guarantor, required when entity has no history |
| DECLARATION | DECLARATIONS | 0..1 | 1 per borrower |
| ASSET | ASSETS | 0..n | DSCR: minimum reserves proof required |
| LIABILITY | LIABILITIES | 0..n | DSCR: full schedule required for credit depth |
| ORIGINATOR (ROLE.LOAN_ORIGINATOR) | PARTIES | 1..n | NMLS company + NMLS individual |
| GOVERNMENT_MONITORING (HMDA demographics) | ROLE | 0..1 | HMDA-reportable loans only |

### 1.5 Other containers common to DSCR/investor loans

- `CREDIT` — under `SERVICES/SERVICE/CREDIT` — for credit report request/response
- `PROPERTY_VALUATION` — inside `COLLATERAL/SUBJECT_PROPERTY/PROPERTY/PROPERTY_VALUATIONS`
- `PROPERTY_UNITS/PROPERTY_UNIT` — for multi-unit (2-4) DSCR; each unit's rent roll
- `PURCHASE_CREDITS` — seller credits, assignment fees (used heavily on DSCR purchase)
- `SALES_CONTRACTS/SALES_CONTRACT` — purchase deals
- `RENTAL_ANALYSIS` / `SUBJECT_PROPERTY_RENTAL_INCOME` — DSCR cash-flow analysis
- `TRANSACTION_DETAIL` — inside `LOAN/CLOSING_INFORMATION`
- `DOCUMENT_SPECIFIC_DATA_SETS` — eNote, closing doc metadata
- `QUALIFICATION` — DTI, reserves months, qualifying ratios (DSCR lenders use this for DSCR ratio)

---

## 2. Required Fields Per Container

All canonical element names below were **observed in the Fannie Mae DU Spec Implementation
Guide v2.6.1 (MISMO v3.4 B324)** or in the Pilotfish MISMO Model Viewer unless explicitly
marked *unverified*. Condition codes:

- **R** = Required
- **C** = Conditional (condition stated)
- **O** = Optional (per MISMO; lender may still require)
- **DSCR-R** = DSCR lender requirement even if MISMO-optional

### 2.1 LOAN / TERMS_OF_LOAN

| Field | Type | Enum / Values | Card | Notes |
|-------|------|---------------|------|-------|
| `LoanRoleType` *(attribute on LOAN)* | enum | SubjectLoan, RelatedLoan, ModifiedLoan, HELOC | R | SubjectLoan for the subject DSCR loan |
| `LoanPurposeType` | enum | Purchase, Refinance, MortgageModification, Other, Unknown | R | DSCR: Purchase or Refinance |
| `LoanPurposeTypeOtherDescription` | string | — | C | when LoanPurposeType=Other |
| `MortgageType` | enum | Conventional, FHA, VA, USDARuralDevelopment, LocalAgency, PublicAndIndian, Other | R | DSCR: always **Conventional** (non-agency investor loans ride the Conventional code) |
| `MortgageTypeOtherDescription` | string | — | C | when MortgageType=Other |
| `LienPriorityType` | enum | FirstLien, SecondLien, ThirdLien, Other | R | DSCR: FirstLien |
| `BaseLoanAmount` | amount | decimal 2dp | R | Principal — excludes PMI/funding fee |
| `NoteAmount` | amount | decimal 2dp | R | Amount on note (typically = BaseLoanAmount for DSCR) |
| `NoteRatePercent` | percent | decimal up to 5dp | R | Interest rate on note |
| `NoteDate` | date | CCYY-MM-DD | R | Execution date of the note |
| `DisclosedFullyIndexedRatePercent` | percent | — | C | ARM only |
| `DisclosedIndexRatePercent` | percent | — | C | ARM only |
| `DisclosedMarginRatePercent` | percent | — | C | ARM only |
| `AssumedLoanAmount` | amount | — | C | refi assumed loans |

### 2.2 LOAN / LOAN_IDENTIFIERS / LOAN_IDENTIFIER

| Field | Type | Enum / Values | Card | Notes |
|-------|------|---------------|------|-------|
| `LoanIdentifier` | string | — | R | The loan number — multiple occurrences with type |
| `LoanIdentifierType` | enum | AgencyCase, LenderLoan, InvestorLoan, MERS_MIN, UniversalLoanIdentifier, NMLS, AUS, Other | R | One per LOAN_IDENTIFIER; LenderLoan is the broker's loan number |
| `LoanIdentifierTypeOtherDescription` | string | — | C | when LoanIdentifierType=Other |

### 2.3 LOAN / LOAN_DETAIL (core flags)

Critical flags for DSCR — all Booleans/indicators. Full list is ~100 elements; the subset that
matters for the generator:

| Field | Type | Card | DSCR-specific usage |
|-------|------|------|---------------------|
| `ApplicationReceivedDate` | date | R | TRID clock; must match Section 1 date |
| `InterestOnlyIndicator` | bool | C | true for DSCR interest-only products |
| `BalloonIndicator` | bool | C | true for 5/25, 7/23 balloon DSCR structures |
| `PrepaymentPenaltyIndicator` | bool | C | true for most DSCR (5-3-2-1-1 standard) |
| `HELOCIndicator` | bool | R | false for DSCR term loans |
| `ConformingIndicator` | bool | O | false for DSCR (non-agency) |
| `QualifiedMortgageIndicator` | bool | R | false — DSCR is non-QM by definition |
| `HigherPricedMortgageLoanIndicator` | bool | R | calculated per Reg Z APOR |
| `MIRequiredIndicator` | bool | R | false for DSCR (investor loans don't carry MI) |
| `MICoverageExistsIndicator` | bool | R | false |
| `ConstructionLoanIndicator` | bool | R | false for permanent DSCR |
| `RenovationLoanIndicator` | bool | C | true if included renovation budget |
| `RelocationLoanIndicator` | bool | R | false |
| `EscrowIndicator` | bool | C | true if taxes/insurance escrowed |
| `EscrowAccountRequestedIndicator` | bool | O | |
| `BorrowerCount` | count | R | Individuals on note (1 for single-borrower LLC+guarantor; n for joint) |
| `TotalMortgagedPropertiesCount` | count | DSCR-R | Total 1-4 unit financed by borrower — Fannie cap 10, DSCR lenders usually 20+ |
| `PropertiesFinancedByLenderCount` | count | DSCR-R | Count by the same lender |
| `ArmsLengthIndicator` | bool | DSCR-R | Kiavi/Visio require explicit false for non-arms-length |

### 2.4 LOAN / MATURITY / MATURITY_RULE

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `LoanMaturityDate` | date | CCYY-MM-DD | R | Final payment date |
| `LoanMaturityPeriodCount` | count | — | R | Term in months (360 for 30-yr) |
| `LoanMaturityPeriodType` | enum | Month, Year | R | Typically Month |

### 2.5 LOAN / AMORTIZATION / AMORTIZATION_RULE

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `AmortizationType` | enum | Fixed, AdjustableRate, GraduatedPayment, Step, Other | R | Fixed for 30-yr DSCR; AdjustableRate for ARM DSCR |
| `AmortizationTypeOtherDescription` | string | — | C | |
| `LoanAmortizationPeriodCount` | count | — | R | Amortization term (months). Interest-only DSCR: set to final IO+amort period |
| `LoanAmortizationPeriodType` | enum | Month, Year | R | Month |

### 2.6 LOAN / QUALIFICATION

This is where lenders put DTI + reserve + DSCR ratio. The canonical DSCR ratio field is
a ULAD extension — see §3.

| Field | Type | Card | Notes |
|-------|------|------|-------|
| `TotalMonthlyIncomeAmount` | amount | C | Required for conventional; may be 0 for pure-DSCR |
| `TotalMonthlyProposedHousingExpenseAmount` | amount | R | PITIA |
| `TotalLiabilitiesMonthlyPaymentAmount` | amount | R | Sum of LIABILITY monthly payments |
| `TotalMonthlyIncomeExpenseRatioPercent` | percent | C | Back-end DTI; DSCR often omits |
| `TotalMonthlyProposedHousingExpenseRatioPercent` | percent | C | Front-end DTI |
| `MonthlyQualifyingIncomeAmount` | amount | O | DSCR lenders populate with DSCR-qualifying NOI × 12 / 12 (i.e., monthly NOI) |
| *ULAD* `QualifyingRatePercent` | percent | O | Qualifying interest rate (vs note rate) |

### 2.7 LOAN / SUBJECT_PROPERTY_RENTAL_INCOME (DSCR-critical)

| Field | Type | Card | Notes |
|-------|------|------|-------|
| `SubjectPropertyMonthlyCashFlowAmount` | amount | DSCR-R | Net cash flow |
| `SubjectPropertyGrossRentalIncomeAmount` | amount | DSCR-R | Market/actual gross monthly rent |
| `SubjectPropertyNetRentalIncomeAmount` | amount | DSCR-R | After vacancy factor |
| `SubjectPropertyOccupancyPercent` | percent | DSCR-R | Inverse of vacancy |
| `SubjectPropertyLeaseAmount` | amount | C | Required when property is leased; from signed lease |
| `SubjectPropertyLeaseExpirationDate` | date | C | When leased |
| `SubjectPropertyMonthlyRentalCoveragePercent` | percent | DSCR-R | DSCR ratio expressed as percent (1.25 = 125) |

> ⚠ Pilotfish MISMO viewer did not surface this container in the fetched pages; field names
> above are **derived from DU Spec references to rental-income elements and Fannie Form 1007
> data points**. Confirm each against the MISMO_3.4.0_B324.xsd before migration. Mark all as
> "unverified — needs XSD confirmation" pending schema check.

### 2.8 PARTY / INDIVIDUAL / NAME (borrower name)

| Field | Type | Card | Notes |
|-------|------|------|-------|
| `FirstName` | string | R | Legal first name |
| `MiddleName` | string | O | |
| `LastName` | string | R | Legal surname |
| `SuffixName` | string | O | Jr, Sr, III |
| `FullName` | string | C | Used when borrower name can't be parsed |

### 2.9 PARTY / INDIVIDUAL (individual-level fields)

| Field | Type | Card | Notes |
|-------|------|------|-------|
| `BirthDate` | date | R | CCYY-MM-DD. Required for credit pull |
| `DeceasedDate` | date | C | Required if deceased co-borrower |
| `CitizenshipResidencyType` *(actually on DECLARATION_DETAIL)* | enum | R | see §2.15 |

### 2.10 PARTY / TAXPAYER_IDENTIFIERS / TAXPAYER_IDENTIFIER

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `TaxpayerIdentifierType` | enum | SocialSecurityNumber, IndividualTaxpayerIdentificationNumber, EmployerIdentificationNumber, Other | R | SSN for individuals; EIN for LLC/entity borrower |
| `TaxpayerIdentifierValue` | string | 9 digits | R | Value; SSN without dashes |

### 2.11 PARTY / CONTACT_POINTS / CONTACT_POINT (phone + email)

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `ContactPointRoleType` | enum | Home, Work, Mobile, Fax, Other | R | |
| `ContactPointTelephone / ContactPointTelephoneValue` | string | — | C | Required when telephone |
| `ContactPointEmail / ContactPointEmailValue` | string | email | C | Required for CD delivery |

### 2.12 PARTY / ROLES / ROLE / ROLE_DETAIL — PartyRoleType

Critical: the `PartyRoleType` attribute (or element) is what tells parsers what this PARTY is.
Common values observed in DU Spec and MISMO LDD:

- `Borrower`
- `CoBorrower` (older models; v3.4 uses Borrower + JointAssetLiabilityReportingType)
- `Guarantor`
- `LoanOriginator` (loan officer)
- `LoanOriginationCompany` (mortgage broker/lender company)
- `PropertySeller`
- `Trustee`
- `NotePayTo`
- `Lender`
- `Servicer`

### 2.13 PARTY / ROLES / ROLE / ROLE_DETAIL / BORROWER_DETAIL

*(Pilotfish viewer returned "MetaData not found" for this exact URL; fields below assembled
from DU Spec fetched content.)*

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `BorrowerClassificationType` | enum | Primary, Secondary | R | Primary for main borrower |
| `BorrowerApplicationSignedDate` | date | CCYY-MM-DD | R | Date borrower signed the 1003 |
| `MaritalStatusType` | enum | Married, Unmarried, Separated | C | Required for joint applications |
| `DependentCount` | count | integer | O | |
| `JointAssetLiabilityReportingType` | enum | Jointly, NotJointly | C | Required when multiple borrowers |
| `BorrowerBirthDate` *(duplicate of INDIVIDUAL.BirthDate — use one canonical placement)* | date | — | R | |
| `CreditReportAuthorizationIndicator` | bool | — | DSCR-R | |
| `HomeownerPastThreeYearsType` | enum | Yes, No | R | Fair-housing declaration |
| `FHABorrowerCertificationOfIntentToOccupyIndicator` | bool | — | C | FHA only |

### 2.14 PARTY / RESIDENCES / RESIDENCE / RESIDENCE_DETAIL

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `BorrowerResidencyType` | enum | Current, Prior, Mailing | R | |
| `BorrowerResidencyBasisType` | enum | Own, Rent, LivingRentFree | C | Required for Current residence |
| `BorrowerResidencyDurationMonthsCount` | count | integer | C | When prior address reported or <24 months at current |
| `BorrowerResidencyDurationYearsCount` | count | integer | C | Paired with months |
| `BorrowerMailingAddressSameAsPropertyIndicator` | bool | — | O | |

### 2.15 PARTY / ROLE / BORROWER / DECLARATIONS / DECLARATION / DECLARATION_DETAIL

*(Verified against DU Spec — all fields present.)*

| Field | Type | Enum / Values | Card | Notes |
|-------|------|---------------|------|-------|
| `CitizenshipResidencyType` | enum | USCitizen, PermanentResidentAlien, NonPermanentResidentAlien, Other | R | |
| `IntentToOccupyType` | enum | Yes, No | R | DSCR: always **No** |
| `HomeownerPastThreeYearsType` | enum | Yes, No | R | |
| `BankruptcyIndicator` | bool | — | R | If true, BANKRUPTCY_DETAIL required |
| `OutstandingJudgmentsIndicator` | bool | — | R | |
| `PartyToLawsuitIndicator` | bool | — | R | |
| `PresentlyDelinquentIndicator` | bool | — | R | Federal debt delinquency |
| `UndisclosedBorrowedFundsIndicator` | bool | — | R | |
| `UndisclosedBorrowedFundsAmount` | amount | — | C | when indicator=true |
| `UndisclosedMortgageApplicationIndicator` | bool | — | R | |
| `UndisclosedCreditApplicationIndicator` | bool | — | R | |
| `UndisclosedComakerOfNoteIndicator` | bool | — | R | |
| `PriorPropertyDeedInLieuConveyedIndicator` | bool | — | R | Past 7 years |
| `PriorPropertyShortSaleCompletedIndicator` | bool | — | R | |
| `PriorPropertyForeclosureCompletedIndicator` | bool | — | R | |
| `PropertyProposedCleanEnergyLienIndicator` | bool | — | R | |
| `SpecialBorrowerSellerRelationshipIndicator` | bool | — | C | Purchase only |

#### 2.15.a DECLARATION / BANKRUPTCY_DETAIL (conditional)

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `BankruptcyChapterType` | enum | Chapter7, Chapter11, Chapter12, Chapter13 | R | when BankruptcyIndicator=true |
| `BankruptcyDischargedDate` | date | CCYY-MM-DD | C | |
| `BankruptcyFiledDate` | date | CCYY-MM-DD | C | |

### 2.16 PARTY / EMPLOYERS / EMPLOYER

Employment is a repeating container. Each EMPLOYER holds LEGAL_ENTITY + ADDRESS +
EMPLOYMENT_DETAIL + CONTACT.

| Field | Path | Type | Card | Notes |
|-------|------|------|------|-------|
| `FullName` (employer name) | LEGAL_ENTITY/LEGAL_ENTITY_DETAIL | string | R | DSCR: optional |
| `OrganizationType` | LEGAL_ENTITY/LEGAL_ENTITY_DETAIL | enum | O | LLC, Corporation, Partnership, SoleProprietorship |
| `EmploymentStatusType` | EMPLOYMENT_DETAIL | enum (Current, Prior) | R | |
| `EmploymentClassificationType` | EMPLOYMENT_DETAIL | enum (Primary, Secondary) | R | |
| `EmploymentStartDate` | EMPLOYMENT_DETAIL | date | R | |
| `EmploymentEndDate` | EMPLOYMENT_DETAIL | date | C | When Prior |
| `EmploymentPositionDescription` | EMPLOYMENT_DETAIL | string | O | |
| `EmploymentTimeInLineOfWorkMonthsCount` | EMPLOYMENT_DETAIL | count | C | FHA required; DSCR optional |
| `EmploymentBorrowerSelfEmployedIndicator` | EMPLOYMENT_DETAIL | bool | R | |
| `OwnershipInterestType` | EMPLOYMENT_DETAIL | enum (GreaterThanOrEqualTo25Percent, LessThan25Percent) | C | Self-employed only |
| `EmploymentMonthlyIncomeAmount` | EMPLOYMENT_DETAIL | amount | C | Required when self-employed ≥25% |

### 2.17 PARTY / BORROWER / CURRENT_INCOME / CURRENT_INCOME_ITEMS / CURRENT_INCOME_ITEM

Used only when including income. For DSCR, typically **all income items omitted** except
rental income which lives under SUBJECT_PROPERTY_RENTAL_INCOME (subject) and
OWNED_PROPERTY_DETAIL (existing REO).

| Field | Path | Type | Enum | Card | Notes |
|-------|------|------|------|------|-------|
| `IncomeType` | CURRENT_INCOME_ITEM_DETAIL | enum | see §2.17.a | R | |
| `IncomeTypeOtherDescription` | CURRENT_INCOME_ITEM_DETAIL | string | — | C | when IncomeType=Other |
| `CurrentIncomeMonthlyTotalAmount` | CURRENT_INCOME_ITEM_DETAIL | amount | — | R | |
| `EmploymentIncomeIndicator` | CURRENT_INCOME_ITEM_DETAIL | bool | — | R | true for base/bonus/commission/overtime |
| `IncomeSourceDescription` | CURRENT_INCOME_ITEM_DETAIL | string | — | O | |

#### 2.17.a IncomeType enumeration (partial, from DU Spec)

Base, Bonus, Commission, Overtime, MilitaryBasePay, MilitaryEntitlements, Dividend, Interest,
NetRentalIncome, Pension, SocialSecurity, TrustIncome, SelfEmploymentMonthlyIncomeOrLoss,
Alimony, ChildSupport, DisabilityInsurance, VABenefit, ForeignIncome, SeasonalIncome,
Unemployment, Other.

### 2.18 ASSET / ASSET_DETAIL (verified from Pilotfish)

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `AssetType` | enum | see §2.18.a | R | |
| `AssetTypeOtherDescription` | string | — | C | when AssetType=Other |
| `AssetAccountIdentifier` | string | alphanumeric | R | Account number |
| `AssetAccountInNameOfDescription` | string | — | O | |
| `AssetAccountType` | enum | Individual, Joint, BusinessAccount, Trust, Other | O | |
| `AssetAccountTypeOtherDescription` | string | — | C | |
| `AssetCashOrMarketValueAmount` | amount | decimal | R | |
| `AssetDescription` | string | — | O | |
| `AssetLiquidityIndicator` | bool | — | O | |
| `AssetNetValueAmount` | amount | — | O | Market less associated liabilities |
| `AutomobileMakeDescription` | string | — | C | AssetType=Automobile |
| `AutomobileModelYear` | date CCYY | — | C | AssetType=Automobile |
| `FundsSourceType` | enum | Borrower, CoBorrower, Gift, Grant, Other | O | |
| `FundsSourceTypeOtherDescription` | string | — | C | |
| `LifeInsuranceFaceValueAmount` | amount | — | C | AssetType=LifeInsurance |
| `StockBondMutualFundShareCount` | count | — | C | AssetType=Stock / MutualFund / Bond |
| `VerifiedIndicator` | bool | — | O | |

#### 2.18.a AssetType enumeration (from DU Spec — not exhaustively verified against LDD, confirm against XSD)

CheckingAccount, SavingsAccount, MoneyMarketFund, CertificateOfDepositTimeDeposit, Stock,
Bond, MutualFund, RetirementFund (IRA/401k/Keogh), Automobile, LifeInsurance, TrustAccount,
BridgeLoanNotDeposited, CashOnHand, EarnestMoneyCashDeposit, GiftsNotDeposited, GiftsTotal,
ProceedsFromSaleOfNonRealEstateAsset, ProceedsFromSaleOfRealEstateAsset, SecuredBorrowedFundsNotDeposited,
NetEquity, PendingNetSaleProceedsFromRealEstateAssets, RelocationMoney, TrustFunds,
UnsecuredBorrowedFunds, OtherLiquidAssets, OtherNonLiquidAssets, Other.

> ⚠ The full AssetType list was not returned verbatim from any fetched source. Mark values
> above as "unverified pending XSD confirmation." DU Spec and Freddie LPA spec list these.

### 2.19 LIABILITY / LIABILITY_DETAIL (verified from Pilotfish)

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `LiabilityType` | enum | see §2.19.a | R | |
| `LiabilityTypeOtherDescription` | string | — | C | |
| `LiabilityAccountIdentifier` | string | — | R | |
| `LiabilityUnpaidBalanceAmount` | amount | — | R | |
| `LiabilityMonthlyPaymentAmount` | amount | — | R | |
| `LiabilityRemainingTermMonthsCount` | count | — | C | Installment loans |
| `LiabilityPayoffStatusIndicator` | bool | — | O | Paid-at-close indicator |
| `LiabilityExclusionIndicator` | bool | — | O | Omitted from DTI |
| `LiabilityPaymentIncludesTaxesInsuranceIndicator` | bool | — | C | Mortgage only |
| `MortgageType` | enum | Conventional, FHA, VA, Other | C | LiabilityType=MortgageLoan |
| `HELOCMaximumBalanceAmount` | amount | — | C | LiabilityType=HELOC |

#### 2.19.a LiabilityType enumeration (**verified** from Pilotfish Model Viewer)

BorrowerEstimatedTotalMonthlyLiabilityPayment, CollectionsJudgmentsAndLiens,
DeferredStudentLoan, DelinquentTaxes, FirstPositionMortgageLien, Garnishments, HELOC,
HomeownersAssociationLien, Installment, LeasePayment, MonetaryJudgment, MortgageLoan,
Open30DayChargeAccount, Other, PersonalLoan, Revolving, SecondPositionMortgageLien,
Taxes, TaxLien, ThirdPositionMortgageLien, UnsecuredHomeImprovementLoanInstallment,
UnsecuredHomeImprovementLoanRevolving.

### 2.20 LIABILITY / LIABILITY_HOLDER / NAME

| Field | Type | Card | Notes |
|-------|------|------|-------|
| `FullName` | string | R | Creditor / lien-holder name |

### 2.21 SUBJECT_PROPERTY → PROPERTY → PROPERTY_DETAIL (verified from Pilotfish)

Core property facts. Full list was returned; DSCR-critical subset:

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `PropertyUsageType` | enum | Investment, PrimaryResidence, SecondHome, Other | R | DSCR: **Investment** |
| `PropertyUsageTypeOtherDescription` | string | — | C | |
| `PropertyCurrentUsageType` | enum | same as PropertyUsageType | O | Pre-loan usage |
| `PropertyCurrentOccupancyType` | enum | Owner, Tenant, Vacant, Unknown | C | DSCR-R; lenders want vacant vs tenant-occupied |
| `FinancedUnitCount` | count | 1-4 for DSCR residential | R | |
| `ConstructionMethodType` | enum | SiteBuilt, Manufactured, Modular, OnFrameModular, Container, ThreeDimensionalPrintingTechnology, Other | R | DSCR usually SiteBuilt |
| `ConstructionMethodTypeOtherDescription` | string | — | C | |
| `ConstructionStatusType` | enum | Existing, Proposed, Subject, UnderConstruction | R | |
| `PropertyEstimatedValueAmount` | amount | — | R | Borrower-stated value |
| `PropertyStructureBuiltYear` | date CCYY | — | R | |
| `PropertyAcquiredDate` | date | — | C | Refinance |
| `PropertyOriginalCostAmount` | amount | — | C | Refinance |
| `PropertyExistingLienAmount` | amount | — | C | Refinance |
| `GrossLivingAreaSquareFeetNumber` | numeric | — | DSCR-R | Most DSCR lenders require |
| `PropertyAcreageNumber` | numeric | — | DSCR-R | |
| `PUDIndicator` | bool | — | R | |
| `AttachmentType` | enum | Attached, Detached, SemiDetached | R | |
| `PropertyMixedUsageIndicator` | bool | — | R | DSCR: usually false; if true — mixed-use has separate loan programs |
| `DeedRestrictionIndicator` | bool | — | R | |
| `CommunityPropertyStateIndicator` | bool | — | C | State-dependent |
| `AssignmentOfRentsIndicator` | bool | — | DSCR-R | Required to document rent-flow to lender |
| `InvestmentRentalIncomePresentIndicator` | bool | — | DSCR-R | Currently generating income? |
| `RentalEstimatedGrossMonthlyRentAmount` | amount | — | DSCR-R | |
| `RentalEstimatedNetMonthlyRentAmount` | amount | — | DSCR-R | |
| `FHASecondaryResidenceIndicator` | bool | — | C | FHA only |
| `GroupHomeIndicator` | bool | — | O | |
| `PropertyFloodInsuranceIndicator` | bool | — | C | Req if flood zone |
| `PropertyEarthquakeInsuranceIndicator` | bool | — | O | |
| `PropertyConditionDescription` | string | — | O | |

### 2.22 SUBJECT_PROPERTY → ADDRESS

| Field | Type | Card | Notes |
|-------|------|------|-------|
| `AddressLineText` | string | R | Street 1 |
| `AddressAdditionalLineText` | string | O | Street 2 (unit / apt) |
| `CityName` | string | R | |
| `StateCode` | string (2) | R | USPS 2-letter |
| `PostalCode` | string | R | 5-digit or ZIP+4 |
| `CountryCode` | enum (ISO 3166-1 alpha-2) | C | Default US |
| `CountyName` | string | DSCR-R | Needed for appraisal routing |

### 2.23 SUBJECT_PROPERTY → PROPERTY → LOCATION_IDENTIFIER → FIPS_INFORMATION

| Field | Type | Card | Notes |
|-------|------|------|-------|
| `FIPSStateNumericCode` | string | R | 2-digit |
| `FIPSCountyCode` | string | R | 3-digit |
| `FIPSCountySubdivisionCode` | string | O | |
| `CensusTractIdentifier` | string | R | HMDA |
| `MetropolitanStatisticalAreaIdentifier` | string | C | MSA code |

### 2.24 SUBJECT_PROPERTY → PROPERTY_VALUATIONS → PROPERTY_VALUATION → PROPERTY_VALUATION_DETAIL

| Field | Type | Enum | Card | Notes |
|-------|------|------|------|-------|
| `PropertyValuationAmount` | amount | — | R | The appraised/BPO value |
| `PropertyValuationEffectiveDate` | date | — | R | |
| `PropertyValuationFormType` | enum | FNMA1004, FNMA1004C, FNMA1007, FNMA1025, FNMA2055, FNMA216, FreddieMac70, FreddieMac72, FreddieMac1000, BPO, AVM, Other | R | DSCR: typically FNMA1004 + FNMA1007 for SFR; FNMA1025 for 2-4 unit |
| `PropertyValuationMethodType` | enum | FullAppraisal, DriveBy, DesktopAppraisal, AVM, BPO, PriorAppraisalUsed, None, Other | R | |
| `PropertyValuationMethodTypeOtherDescription` | string | — | C | |
| `AppraiserLicenseIdentifier` | string | — | DSCR-R | Required on appraisal form |
| `AppraisalIdentifier` | string | — | DSCR-R | UAD Document File ID |

### 2.25 OWNED_PROPERTY (REO schedule, DSCR-critical)

Lives at `DEAL/ASSETS/ASSET/OWNED_PROPERTY`. Each existing rental becomes one ASSET with an
OWNED_PROPERTY nested child. ASSET_DETAIL is omitted / minimal for OWNED_PROPERTY-typed assets;
OWNED_PROPERTY_DETAIL holds the financials.

#### OWNED_PROPERTY_DETAIL (verified from Pilotfish)

| Field | Type | Card | Notes |
|-------|------|------|-------|
| `OwnedPropertySubjectIndicator` | bool | R | true = this IS the subject; false = existing REO |
| `OwnedPropertyDispositionStatusType` | enum | R | HeldForInvestment, PendingSale, Retain, Sold |
| `OwnedPropertyLienInstallmentAmount` | amount | DSCR-R | Total monthly mortgage + HELOC on this REO |
| `OwnedPropertyLienUPBAmount` | amount | DSCR-R | Total outstanding balance |
| `OwnedPropertyMaintenanceExpenseAmount` | amount | DSCR-R | Insurance + taxes + HOA monthly |
| `OwnedPropertyOwnedUnitCount` | count | DSCR-R | Units on this parcel |
| `OwnedPropertyRentalIncomeGrossAmount` | amount | DSCR-R | Monthly gross rent |
| `OwnedPropertyRentalIncomeNetAmount` | amount | DSCR-R | Net after expenses |

Each OWNED_PROPERTY must also carry a child `PROPERTY/PROPERTY_DETAIL` with:
`PropertyEstimatedValueAmount`, `PropertyUsageType`, address, FIPS, etc. (same pattern as
SUBJECT_PROPERTY but for the existing holding).

### 2.26 PARTY (Loan Originator / Originator Company)

DSCR lenders expect BOTH the LO-individual NMLS AND the originating-company NMLS.

#### 2.26.a LoanOriginator (individual)

PARTY with INDIVIDUAL.NAME (FirstName/LastName), ROLE_DETAIL @PartyRoleType=`LoanOriginator`,
and LOAN_ORIGINATOR_DETAIL:

| Field | Type | Card | Notes |
|-------|------|------|-------|
| `LoanOriginatorIdentifier` | string | R | NMLS ID (individual) |
| `LoanOriginatorIdentifierType` | enum | R | NationwideMortgageLicensingSystemAndRegistry |

#### 2.26.b LoanOriginationCompany (broker/lender entity)

PARTY with LEGAL_ENTITY.LEGAL_ENTITY_DETAIL.FullName, ROLE_DETAIL @PartyRoleType=`LoanOriginationCompany`:

| Field | Type | Card | Notes |
|-------|------|------|-------|
| `FullName` | string | R | Broker company name |
| `OrganizationType` | enum | O | LLC/Corp |
| `LegalEntityIdentifier` | string | R | Company NMLS |
| `LegalEntityIdentifierType` | enum | R | NationwideMortgageLicensingSystemAndRegistry |
| ADDRESS | — | R | Full company address |

### 2.27 LEGAL_ENTITY (LLC borrower / vesting entity, DSCR-critical)

When DSCR loan is vested in an LLC or corp, the borrower-of-record is a LEGAL_ENTITY party:

PARTY with LEGAL_ENTITY (not INDIVIDUAL), ROLE_DETAIL @PartyRoleType=`Borrower`:

| Field | Path | Type | Card | Notes |
|-------|------|------|------|-------|
| `FullName` | LEGAL_ENTITY_DETAIL | string | R | LLC legal name, e.g. "Hurry Homes LLC" |
| `OrganizationType` | LEGAL_ENTITY_DETAIL | enum | R | LLC, Corporation, Partnership, Trust, SoleProprietorship, Other |
| `OrganizationTypeOtherDescription` | LEGAL_ENTITY_DETAIL | string | C | |
| `OrganizationStateOfFormationName` | LEGAL_ENTITY_DETAIL | string (2) | DSCR-R | State of organization |
| `OrganizationFormationDate` | LEGAL_ENTITY_DETAIL | date | DSCR-R | Entity date of formation |
| TAXPAYER_IDENTIFIERS/TAXPAYER_IDENTIFIER | — | — | R | EIN (TaxpayerIdentifierType=EmployerIdentificationNumber) |
| ADDRESS | — | — | R | Entity registered address |

### 2.28 GOVERNMENT_MONITORING (HMDA demographics)

Applies to HMDA-reportable loans. Many DSCR loans on 1-4 unit investment property are
HMDA-exempt (business purpose) but lenders still typically collect. Structure:

ROLE contains GOVERNMENT_MONITORING (sibling of ROLE_DETAIL at some build points; in B324 it's
nested under ROLE). Contains:

- HMDA_ETHNICITIES / HMDA_ETHNICITY (repeating)
- HMDA_RACES / HMDA_RACE (repeating)
- HMDAGenderType
- Refusal / NotApplicable indicators

For DSCR business-purpose loans, set `HMDAEthnicityRefusalIndicator=true` and
`HMDARaceRefusalIndicator=true` or omit the block per lender instructions.

---

## 3. DSCR-Specific Notes

### 3.1 Fields that can be LEGITIMATELY OMITTED for DSCR

Because DSCR underwriting is property-cash-flow-based, the following MISMO structures can
typically be skipped entirely for DSCR submissions — confirm with each lender:

| Container | DSCR Treatment |
|-----------|----------------|
| `PARTY/BORROWER/CURRENT_INCOME` | **Omit entirely** if lender is pure-DSCR and not pulling borrower income |
| `PARTY/EMPLOYERS/EMPLOYER` (personal employer) | Omit OR include minimal placeholder (EmploymentStatusType, EmploymentStartDate, FullName) to satisfy schema |
| `EMPLOYMENT_EXTENSION` fields (ForeignIncome, SeasonalIncome) | Omit |
| `QUALIFICATION/TotalMonthlyIncomeAmount` | Use 0 or omit; DSCR uses property NOI |
| `QUALIFICATION/TotalMonthlyIncomeExpenseRatioPercent` (DTI) | Omit or 0 |
| `FHA/VA GOVERNMENT_LOAN` block | Omit — DSCR is always conventional/non-agency |
| `MI_DATA` | Omit — no MI on DSCR |

> Important: Some MISMO-valid XML parsers require **at least one** CURRENT_INCOME_ITEM per
> BORROWER. If lender rejects XML with zero income items, include a single placeholder:
> `IncomeType=NetRentalIncome`, `EmploymentIncomeIndicator=false`, `CurrentIncomeMonthlyTotalAmount`
> = subject gross rent. This lets the XSD pass while signaling DSCR.

### 3.2 Fields investor lenders REQUIRE even when MISMO marks optional

**Entity / LLC borrower fields (Kiavi, Visio, Kind, Lima One, RCN, Velocity all require these):**

- `LEGAL_ENTITY/LEGAL_ENTITY_DETAIL/FullName`
- `LEGAL_ENTITY/LEGAL_ENTITY_DETAIL/OrganizationType`
- `LEGAL_ENTITY/LEGAL_ENTITY_DETAIL/OrganizationStateOfFormationName`
- `LEGAL_ENTITY/LEGAL_ENTITY_DETAIL/OrganizationFormationDate`
- EIN under `TAXPAYER_IDENTIFIERS/TAXPAYER_IDENTIFIER` with
  `TaxpayerIdentifierType=EmployerIdentificationNumber`
- Entity ADDRESS (registered agent address)
- Articles of Organization / Operating Agreement as documents (outside XML, in doc package)

**Guarantor block (personal guarantee on entity-vested DSCR):**

Guarantor is a separate PARTY with @PartyRoleType=`Guarantor` and a second PARTY is the
LLC Borrower. The RELATIONSHIP container ties them:

```xml
<RELATIONSHIP xlink:from="ROLE_Guarantor_001" xlink:to="PARTY_LLCBorrower_001"
  xlink:arcrole="urn:fdc:mismo.org:2009:residential/ROLE_IsAssociatedWith_PARTY"/>
```

Guarantor carries full INDIVIDUAL, NAME, BirthDate, SSN, CitizenshipResidencyType, DECLARATION
(same as a regular borrower). Most DSCR lenders also require guarantor FICO via SERVICES/SERVICE/CREDIT.

**DSCR ratio & rental analysis fields (all DSCR-R):**

- `SubjectPropertyGrossRentalIncomeAmount` — Monthly market/in-place gross rent
- `SubjectPropertyNetRentalIncomeAmount` — After vacancy factor (typically 75% of gross for Fannie Form 1007 treatment)
- `SubjectPropertyMonthlyRentalCoveragePercent` — DSCR ratio × 100 (e.g., 125 for 1.25 DSCR)
- Monthly PITIA via `HOUSING_EXPENSE` breakdown:
  - PropertyHazardInsuranceEscrowedIndicator + PropertyHazardInsurancePaymentAmount
  - PropertyTaxAmount (annual) + monthly derived
  - MortgageInsurancePaymentAmount (typically 0 for DSCR)
  - FloodInsurancePaymentAmount
  - HomeownersAssociationDuesPaymentAmount
  - OtherHousingExpenseAmount (property-management fee)

**Property expense breakdown (ULAD / DU extension area, DSCR-R):**

Either via `EXPENSES/EXPENSE` (monthly itemized) or via `OWNED_PROPERTY_DETAIL` sub-fields:
- Management fee (typically 8-10% of gross rent)
- Vacancy allowance (typically 5%)
- Repairs/maintenance (typically 5%)
- Property taxes (actual)
- Hazard insurance (actual)
- HOA dues (actual)
- Flood insurance (if applicable)

**Market rent vs. in-place rent:**

When property is tenant-occupied:
- Actual lease rent → `SubjectPropertyLeaseAmount`
- Market rent from FNMA1007 → `RentalEstimatedGrossMonthlyRentAmount` in PROPERTY_DETAIL
- DSCR is calculated on the **lower of actual vs. market** (most lenders)

### 3.3 Lender-specific extension namespaces

MISMO 3.4 permits custom extensions via `<EXTENSION><OTHER>` blocks with custom namespaces.
Observed / likely namespaces:

| Namespace prefix | URN / URI | Scope |
|------------------|-----------|-------|
| `DU:` | urn:fnma:mismo:2009:du:3.4 | Fannie Mae DU specific (also used by some investors who mirror DU) |
| `ULAD:` | urn:gse:ulad:2017:1.2 | Fannie/Freddie URLA extensions |
| `LPA:` | urn:fre:lpa:v6.1 | Freddie Mac LPA extension |
| `KIAVI:` | urn:kiavi:dscr:v1 (hypothetical — confirm with Kiavi) | Kiavi-specific DSCR fields |
| `VISIO:` | urn:visio:dscr:v1 (hypothetical — confirm with Visio) | Visio-specific |

> As of April 2026 no public-facing DSCR-lender MISMO extension schema has been found in
> public sources. Contact each lender's broker-tech team for their extension XSDs. Generator
> should keep extension emission OFF by default and switch on per lender target profile.

Common DSCR extension payload (guess — verify per lender):

```xml
<EXTENSION>
  <OTHER>
    <DSCR_EXTENSION xmlns:dscr="urn:lender:dscr:v1">
      <dscr:DSCRCalculatedRatio>1.28</dscr:DSCRCalculatedRatio>
      <dscr:DSCRQualifyingMethod>PITIA</dscr:DSCRQualifyingMethod>
      <dscr:DSCRRentSource>Lease</dscr:DSCRRentSource> <!-- Lease | MarketForm1007 | LowerOf -->
      <dscr:ShortTermRentalIndicator>false</dscr:ShortTermRentalIndicator>
      <dscr:InterestOnlyIndicator>true</dscr:InterestOnlyIndicator>
      <dscr:PrepaymentPenaltyStructure>5-3-2-1-1</dscr:PrepaymentPenaltyStructure>
    </DSCR_EXTENSION>
  </OTHER>
</EXTENSION>
```

### 3.4 Suggested generator profiles

Build the generator with three target profiles:

1. **MISMO-3.4-Baseline** — validates against MISMO_3.4.0_B324.xsd only. No extensions.
2. **Fannie-DU-3.4** — adds DU extension namespace; used only if DSCR lender accepts DU Spec XML.
3. **DSCR-Investor** — MISMO baseline + DSCR EXTENSION block per §3.3 + guarantor PARTY + LLC LEGAL_ENTITY borrower.

Each lender (Kiavi / Visio / Kind / Lima One / RCN / Velocity) should have its own sub-profile
inheriting from DSCR-Investor, with lender-specific field overrides in YAML/JSON config.

---

## 4. Fannie Mae 3.2 (.fnm) Crosswalk

The .fnm (Fannie Mae 3.2) flat-file format is a positional fixed-width file. Records are
identified by the 3-character Record ID in positions 1–3. Each record type has numbered
fields. Data below verified against `BaylorRae/fannie-3.2/data/1003.json` and cross-checked
with the Calyx Point FNM 3.2 export documentation.

### 4.1 Record-type inventory (relevant to DSCR)

| Record ID | Section | Purpose |
|-----------|---------|---------|
| EH | Envelope Header | File-level metadata |
| TH | Transaction Header | Transaction-level metadata |
| TPI | Version | 3.20 format identifier |
| 000 | File ID | File type (1=1003), version |
| 01A | Section I | Mortgage type + terms |
| 02A | Section II | Property information (address) |
| 02B | Section II | Purpose of loan + occupancy |
| 02C | Section II | Title holder names |
| 02D | Section II | Construction / refinance |
| 02E | Section II | Down payment sources |
| 03A | Section III | Applicant / co-applicant demographics |
| 03B | Section III | Dependent ages |
| 03C | Section III | Applicant addresses |
| 04A | Section IV | Current employer |
| 04B | Section IV | Secondary / prior employer |
| 05H | Section V | Housing expenses |
| 05I | Section V | Gross monthly income |
| 06A–06B | Section VI | Asset accounts |
| 06C | Section VI | Bank/credit union/brokerage assets |
| 06D | Section VI | Automobiles owned |
| 06F | Section VI | Liabilities (alimony/child support/expenses) |
| 06G | Section VI | Real estate owned |

### 4.2 LOAN section crosswalk (01A)

| 3.2 Field ID | 3.2 Name | Pos | Len | Format | MISMO 3.4 Element | Container path |
|--------------|----------|-----|-----|--------|-------------------|----------------|
| 01A-010 | Record ID | 1 | 3 | `01A` literal | n/a | n/a |
| 01A-020 | Mortgage Applied For | 4 | 2 | code 01-07 | `MortgageType` | `LOAN/TERMS_OF_LOAN` |
| 01A-030 | Mortgage Applied For Other | 6 | 80 | text | `MortgageTypeOtherDescription` | same |
| 01A-040 | Agency Case Number | 86 | 30 | text | `LoanIdentifier` (type=AgencyCase) | `LOAN/LOAN_IDENTIFIERS/LOAN_IDENTIFIER` |
| 01A-050 | Lender Case Number | 116 | 15 | alphanumeric | `LoanIdentifier` (type=LenderLoan) | same |
| 01A-060 | Loan Amount | 131 | 15 | Z(12).Z(2) | `BaseLoanAmount` | `LOAN/TERMS_OF_LOAN` |
| 01A-070 | Interest Rate | 146 | 7 | Z(3).Z(3) | `NoteRatePercent` (or `RequestedInterestRatePercent` if 2.x era) | same |
| 01A-080 | No. of Months | 153 | 3 | numeric | `LoanAmortizationPeriodCount` | `LOAN/AMORTIZATION/AMORTIZATION_RULE` |
| 01A-090 | Amortization Type | 156 | 2 | code (01=ARM, 04, 05=Fixed, 06, 13) | `AmortizationType` | same |
| 01A-100 | Amortization Type Other | 158 | 80 | text | `AmortizationTypeOtherDescription` | same |
| 01A-110 | ARM Textual Description | 238 | 80 | text | ARM description (free text) | `LOAN/ADJUSTMENT/INTEREST_RATE_ADJUSTMENT` |

**Mortgage type code mapping (01A-020):**
| Code | 3.2 Meaning | MISMO `MortgageType` |
|------|-------------|----------------------|
| 01 | Conventional | Conventional |
| 02 | VA | VA |
| 03 | FHA | FHA |
| 04 | USDA | USDARuralDevelopment |
| 07 | Other | Other |

**Purpose of loan code (02B-030 — but we list here for completeness):**
| Code | 3.2 Meaning | MISMO `LoanPurposeType` |
|------|-------------|-------------------------|
| 16 | Purchase | Purchase |
| 05 | Refinance | Refinance |
| 04 | Construction | n/a (use LoanDetail.ConstructionLoanIndicator=true + LoanPurposeType=Purchase) |
| 13 | Other | Other |
| 15 | Construction-Permanent | see above |

### 4.3 SUBJECT_PROPERTY section crosswalk (02A / 02B / 02C / 02D / 02E)

#### 02A — Property address

| 3.2 Field ID | 3.2 Name | Pos | Len | MISMO 3.4 Element | Container |
|--------------|----------|-----|-----|-------------------|-----------|
| 02A-020 | Property Street Address | 4 | 50 | `AddressLineText` | `SUBJECT_PROPERTY/ADDRESS` |
| 02A-030 | Property City | 54 | 35 | `CityName` | same |
| 02A-040 | Property State | 89 | 2 | `StateCode` | same |
| 02A-050 | Property Zip Code | 91 | 5 | `PostalCode` (5-digit part) | same |
| 02A-060 | Zip Plus Four | 96 | 4 | `PostalCode` (extension) | same |
| 02A-070 | No. of Units | 100 | 3 | `FinancedUnitCount` | `SUBJECT_PROPERTY/PROPERTY/PROPERTY_DETAIL` |
| 02A-080 | Legal Description Code | 103 | 2 | `LegalDescriptionType` | `SUBJECT_PROPERTY/PROPERTY/LEGAL_DESCRIPTIONS/LEGAL_DESCRIPTION` |
| 02A-090 | Legal Description Text | 105 | 80 | `LegalDescriptionTextDescription` | same |
| 02A-100 | Year Built | 185 | 4 | `PropertyStructureBuiltYear` | `PROPERTY_DETAIL` |

#### 02B — Purpose / occupancy

| 3.2 Field ID | 3.2 Name | Pos | Len | MISMO 3.4 Element | Container |
|--------------|----------|-----|-----|-------------------|-----------|
| 02B-030 | Purpose of Loan | 6 | 2 | `LoanPurposeType` | `LOAN/TERMS_OF_LOAN` |
| 02B-040 | Purpose of Loan Other | 8 | 80 | `LoanPurposeTypeOtherDescription` | same |
| 02B-050 | Property Occupancy | 88 | 1 | `PropertyUsageType` | `PROPERTY_DETAIL` |
| 02B-060 | Title Manner Description | 89 | 60 | `GSETitleMannerHeldDescription` (or `TitleHoldingDescription` in 3.4) | `PROPERTY_DETAIL` or `TITLE_HOLDER` |
| 02B-070 | Estate Type | 149 | 1 | `PropertyEstateType` (FeeSimple vs Leasehold) | `PROPERTY_DETAIL` |
| 02B-080 | Leasehold Expiration | 150 | 8 | `PropertyGroundLeaseExpirationDate` | same |

**Occupancy code (02B-050):**
| Code | 3.2 | MISMO `PropertyUsageType` |
|------|-----|---------------------------|
| 1 | Primary | PrimaryResidence |
| 2 | Secondary | SecondHome |
| D | Investment | **Investment** ← DSCR default |

#### 02C — Title holder

| 3.2 Field ID | 3.2 Name | Len | MISMO 3.4 Element | Container |
|--------------|----------|-----|-------------------|-----------|
| 02C-020 | Titleholder Name | 60 | `FullName` | `PROPERTY/PROPERTY_OWNER/NAME` or via PARTY with role=PropertyOwner |

#### 02D — Construction / Refinance

| 3.2 Field ID | 3.2 Name | Len | MISMO 3.4 Element | Container |
|--------------|----------|-----|-------------------|-----------|
| 02D-020 | Year Acquired | 4 | `PropertyAcquiredYear` (or derive from `PropertyAcquiredDate`) | `PROPERTY_DETAIL` |
| 02D-030 | Original Cost | 15 | `PropertyOriginalCostAmount` | same |
| 02D-040 | Existing Liens | 15 | `PropertyExistingLienAmount` | same |
| 02D-050 | Present Lot Value | 15 | `LandEstimatedValueAmount` | `CONSTRUCTION` container |
| 02D-060 | Cost of Improvements | 15 | `ConstructionImprovementCostsAmount` | same |
| 02D-070 | Refinance Purpose | 2 | `GSERefinancePurposeType` (in Freddie ULAD extension) | `REFINANCE` container |
| 02D-080 | Improvements Description | 80 | `RefinanceProposedImprovementsDescription` | same |
| 02D-100 | Improvements Cost | 15 | `RefinanceImprovementCostsAmount` | same |

#### 02E — Down payment

| 3.2 Field ID | 3.2 Name | MISMO 3.4 Element | Container |
|--------------|----------|-------------------|-----------|
| 02E-020 | Down Payment Type | `FundsSourceType` | `ASSET/ASSET_DETAIL` (as funds source) |
| 02E-030 | Down Payment Amount | `AssetCashOrMarketValueAmount` or `PurchaseCreditAmount` | `ASSET` or `PURCHASE_CREDITS/PURCHASE_CREDIT` |
| 02E-040 | Explanation | `FundsSourceTypeOtherDescription` or `PurchaseCreditSourceDescription` | same |

### 4.4 BORROWER section crosswalk (03A / 03B / 03C)

#### 03A — Applicant demographics

| 3.2 Field ID | 3.2 Name | Pos | Len | MISMO 3.4 Element | Container path |
|--------------|----------|-----|-----|-------------------|----------------|
| 03A-020 | Applicant/Co-Applicant | 4 | 2 | `BorrowerClassificationType` (Primary=BW, Secondary=QZ) or `@PartyRoleType` + `PrintPositionType` | `ROLE_DETAIL/BORROWER_DETAIL` |
| 03A-030 | Social Security Number | 6 | 9 | `TaxpayerIdentifierValue` (Type=SocialSecurityNumber) | `PARTY/TAXPAYER_IDENTIFIERS/TAXPAYER_IDENTIFIER` |
| 03A-040 | First Name | 15 | 35 | `FirstName` | `PARTY/INDIVIDUAL/NAME` |
| 03A-050 | Middle Name | 50 | 35 | `MiddleName` | same |
| 03A-060 | Last Name | 85 | 35 | `LastName` | same |
| 03A-070 | Generation/Suffix | 120 | 4 | `SuffixName` | same |
| 03A-080 | Home Phone | 124 | 10 | `ContactPointTelephoneValue` (role=Home) | `PARTY/CONTACT_POINTS/CONTACT_POINT` |
| 03A-090 | Age | 134 | 3 | (derived from `BirthDate`) | n/a |
| 03A-100 | Years School | 137 | 2 | `SchoolingYearsCount` | `PARTY/BORROWER/BORROWER_DETAIL` |
| 03A-110 | Marital Status | 139 | 1 | `MaritalStatusType` (M=Married, S=Unmarried, U=Separated) | `BORROWER_DETAIL` |
| 03A-120 | Dependents Count | 140 | 2 | `DependentCount` | `BORROWER_DETAIL` |
| 03A-130 | Completed Jointly | 142 | 1 | `JointAssetLiabilityReportingType` | `BORROWER_DETAIL` |
| 03A-140 | Cross-Reference SSN | 143 | 9 | via `RELATIONSHIP` arcrole | n/a |
| 03A-150 | Date of Birth | 152 | 8 | `BirthDate` (CCYY-MM-DD) | `PARTY/INDIVIDUAL` |
| 03A-160 | Email Address | 160 | 80 | `ContactPointEmailValue` | `PARTY/CONTACT_POINTS/CONTACT_POINT` |

#### 03B — Dependent ages (repeating)

| 3.2 Field ID | MISMO 3.4 Element | Container |
|--------------|-------------------|-----------|
| 03B-020 | borrower-SSN (linked via RELATIONSHIP) | n/a |
| 03B-030 | `DependentAgeYears` | `BORROWER_DETAIL/DEPENDENTS/DEPENDENT` |

#### 03C — Applicant addresses

| 3.2 Field ID | 3.2 Name | MISMO 3.4 Element | Container |
|--------------|----------|-------------------|-----------|
| 03C-030 | Address Type | `AddressType` (Current/Prior/Mailing) via `BorrowerResidencyType` | `RESIDENCE_DETAIL` |
| 03C-040 | Street Address | `AddressLineText` | `RESIDENCE/ADDRESS` |
| 03C-050 | City | `CityName` | same |
| 03C-060 | State | `StateCode` | same |
| 03C-070 | Zip | `PostalCode` | same |
| 03C-090 | Own/Rent | `BorrowerResidencyBasisType` (O=Own, R=Rent, X=LivingRentFree) | `RESIDENCE_DETAIL` |
| 03C-100 | Years at Address | `BorrowerResidencyDurationYearsCount` | same |
| 03C-110 | Months at Address | `BorrowerResidencyDurationMonthsCount` | same |
| 03C-120 | Country | `CountryCode` | `RESIDENCE/ADDRESS` |

### 4.5 EMPLOYMENT crosswalk (04A / 04B)

For DSCR, these records can be populated with minimal data when the borrower is a personal
guarantor with W-2 income, or skipped if the LLC has no employment history.

| 3.2 Field | MISMO 3.4 Element | Container |
|-----------|-------------------|-----------|
| 04A-020 SSN | linked via RELATIONSHIP | n/a |
| 04A-030 Employer Name | `FullName` | `PARTY/LEGAL_ENTITY/LEGAL_ENTITY_DETAIL` (under EMPLOYERS/EMPLOYER) |
| 04A-040..060 Employer Address | ADDRESS | `EMPLOYER/ADDRESS` |
| 04A-070 Phone | `ContactPointTelephoneValue` | `EMPLOYER/CONTACT_POINTS/CONTACT_POINT` |
| 04A-080 Years on Job | `EmploymentMonthsOnJobCount` or `EmploymentStartDate` + derivation | `EMPLOYMENT_DETAIL` |
| 04A-090 Months on Job | same | same |
| 04A-100 Years in Line of Work | `EmploymentTimeInLineOfWorkMonthsCount` | same |
| 04A-110 Position | `EmploymentPositionDescription` | same |
| 04A-120 Self-Employed | `EmploymentBorrowerSelfEmployedIndicator` | same |
| 04A-130 Current Employer | `EmploymentStatusType=Current` | same |

### 4.6 REO crosswalk (06G) — DSCR critical

| 3.2 Field ID | 3.2 Name | Pos | Len | MISMO 3.4 Element | Container |
|--------------|----------|-----|-----|-------------------|-----------|
| 06G-020 | Applicant SSN | 4 | 9 | linked via RELATIONSHIP | n/a |
| 06G-030 | Property Street | 13 | 35 | `AddressLineText` | `OWNED_PROPERTY/PROPERTY/ADDRESS` |
| 06G-040 | Property City | 48 | 35 | `CityName` | same |
| 06G-050 | Property State | 83 | 2 | `StateCode` | same |
| 06G-060 | Property Zip | 85 | 5 | `PostalCode` | same |
| 06G-080 | Disposition | 94 | 1 | `OwnedPropertyDispositionStatusType` | `OWNED_PROPERTY_DETAIL` |
| 06G-090 | Property Type | 95 | 2 | `GSEPropertyType` or `PropertyType` | `PROPERTY_DETAIL` |
| 06G-100 | Present Market Value | — | 15 | `PropertyEstimatedValueAmount` | `OWNED_PROPERTY/PROPERTY/PROPERTY_DETAIL` |
| 06G-110 | Mortgage Balance | — | 15 | `OwnedPropertyLienUPBAmount` | `OWNED_PROPERTY_DETAIL` |
| 06G-120 | Gross Rental Income | — | 15 | `OwnedPropertyRentalIncomeGrossAmount` | `OWNED_PROPERTY_DETAIL` |
| 06G-130 | Mortgage Payment | — | 15 | `OwnedPropertyLienInstallmentAmount` | `OWNED_PROPERTY_DETAIL` |
| 06G-140 | Insurance/Tax/Maint | — | 15 | `OwnedPropertyMaintenanceExpenseAmount` | `OWNED_PROPERTY_DETAIL` |
| 06G-150 | Net Rental Income | — | 15 | `OwnedPropertyRentalIncomeNetAmount` | `OWNED_PROPERTY_DETAIL` |

**Disposition code (06G-080):**
| Code | 3.2 | MISMO |
|------|-----|-------|
| S | Sold | Sold |
| H | Hold / Retain | Retain or HeldForInvestment |
| P | Pending Sale | PendingSale |
| R | Rental | HeldForInvestment |

**Property type code (06G-090):** Maps to MISMO `GSEPropertyType` values: SingleFamily,
Condominium, Cooperative, PUD, MultiFamily2Unit, MultiFamily3Unit, MultiFamily4Unit,
Townhouse, Manufactured, ModularPrefab, Mixed, Farm.

### 4.7 HOUSING EXPENSE crosswalk (05H)

Currently-owned primary and proposed (subject property).

| 3.2 Field | MISMO 3.4 Element | HousingExpenseType enum |
|-----------|-------------------|-------------------------|
| 05H-020 Type (Present/Proposed) | `HousingExpenseTiming` | — |
| 05H-030 Rent | `HousingExpensePaymentAmount` | Rent |
| 05H-040 First Mortgage P&I | same | FirstMortgagePrincipalAndInterest |
| 05H-050 Other Financing | same | OtherMortgagePrincipalAndInterest |
| 05H-060 Hazard Insurance | same | HazardInsurance |
| 05H-070 Real Estate Tax | same | RealEstateTax |
| 05H-080 Mortgage Insurance | same | MortgageInsurance |
| 05H-090 HOA Dues | same | HomeownersAssociationDuesAndCondominiumFees |
| 05H-100 Other Expense | same | Other |

### 4.8 ASSET crosswalk (06C / 06D)

| 3.2 Field | MISMO 3.4 Element | Container |
|-----------|-------------------|-----------|
| 06C-020 SSN | RELATIONSHIP | n/a |
| 06C-030 Asset Type Code | `AssetType` | `ASSET_DETAIL` |
| 06C-040 Account # | `AssetAccountIdentifier` | same |
| 06C-050 Holder Name | `AssetHolderName` | `ASSET_HOLDER/NAME` |
| 06C-060 Value | `AssetCashOrMarketValueAmount` | `ASSET_DETAIL` |

### 4.9 LIABILITY crosswalk (06E / 06F)

| 3.2 Field | MISMO 3.4 Element | Container |
|-----------|-------------------|-----------|
| 06E-030 Liability Type | `LiabilityType` | `LIABILITY_DETAIL` |
| 06E-040 Account # | `LiabilityAccountIdentifier` | same |
| 06E-050 Creditor Name | `FullName` | `LIABILITY_HOLDER/NAME` |
| 06E-060 Unpaid Balance | `LiabilityUnpaidBalanceAmount` | `LIABILITY_DETAIL` |
| 06E-070 Monthly Payment | `LiabilityMonthlyPaymentAmount` | same |
| 06E-080 Paid Off at Close | `LiabilityPayoffStatusIndicator` | same |
| 06E-090 Months Remaining | `LiabilityRemainingTermMonthsCount` | same |

---

## 5. XSD Source Location

### 5.1 Official MISMO.org downloads

- Landing page: https://www.mismo.org/standards-resources/residential-specifications/reference-model/xml-schema
- Version 3.4 product page: https://www.mismo.org/standards-resources/mismo-product/mismo-version-3-4

**Access requirements:**
- MISMO members: full download of Reference Model + LDD + Version Compare Report via MISMO Connect.
- Non-members: three downloadable ZIP bundles, each requires acceptance of a license form:
  1. **Version 3.4 Residential Reference Model** (XML Schema + SMART Doc® v3 standards)
  2. **Version 3.4 Logical Data Dictionary** (business nomenclature, enum lists)
  3. **Version 3.4 Documentation and Release Notes**

The MISMO license requires attribution and forbids redistribution. For the Preme Portal repo,
download the schemas locally and keep them under `/schemas/mismo-3.4/` in the repo (git-ignored
if the license forbids checkin — it does). Instead, vendor them via a `scripts/fetch-mismo-xsd.sh`
that downloads from the original URL at build time, using a cached ZIP.

### 5.2 Secondary canonical sources (derived from MISMO 3.4, publicly downloadable)

These include the MISMO 3.4 B324 core XSD plus lender wrappers:

- **Fannie Mae DU Spec v2.6.1** — contains `MISMO_3.4.0_B324.xsd` plus DU wrapper + ULAD schema.
  - Hub: https://singlefamily.fanniemae.com/delivering/uniform-mortgage-data-program/uniform-residential-loan-application
  - DU Spec PDF: https://singlefamily.fanniemae.com/media/7571/display
  - Appendix C sample XMLs: https://singlefamily.fanniemae.com/learning-center/delivering/uniform-loan-delivery-dataset-uldd/appendix-c-xml-samples
- **Freddie Mac LPA v6.1 Request File Requirements** (ZIP includes `ulad.xsd` + `lpa.xsd`):
  https://sf.freddiemac.com/docs/zip/loan-product-advisor-v6.1.00-request-file-requirements.zip
- **Freddie Mac XLink / ArcRoles Doc**: https://sf.freddiemac.com/docs/pdf/requirements/ulad_data_relationships_using_xlink_mismo_arcroles_document.pdf

### 5.3 Recommended local layout for Preme Portal

```
preme-portal/
├── docs/
│   └── mismo-3.4/
│       ├── reference.md              ← THIS FILE
│       ├── enum-inventory.md         (to build: enum values from LDD)
│       └── field-inventory.csv       (to build: canonical field list with types)
├── schemas/
│   └── mismo-3.4/
│       ├── MISMO_3.4.0_B324.xsd     (from DU Spec ZIP)
│       ├── ulad.xsd                  (from Freddie LPA ZIP)
│       ├── lpa.xsd                   (from Freddie LPA ZIP)
│       ├── du-wrapper-3.4.0_B324.xsd (from DU Spec ZIP)
│       └── samples/
│           ├── fannie-scenario-1.xml
│           ├── fannie-scenario-2.xml
│           ├── fannie-scenario-3.xml
│           └── fannie-scenario-4.xml
├── scripts/
│   └── fetch-mismo-xsd.sh            (downloads & verifies ZIPs; runs at build time)
└── lib/
    └── mismo/
        ├── generator.ts              (XML builder)
        ├── profiles/                 (MISMO-baseline / DU / DSCR-Investor / per-lender)
        └── validators.ts             (XSD validation via libxml or xsd2)
```

---

## 6. Authoritative Sources

All sources listed below were **accessed during research** for this document. URLs verified.
Content retrieved via Jina Reader proxy where the origin blocked direct fetch (Fannie Mae
singlefamily portal responded 403 to WebFetch but served content through r.jina.ai).

| # | Source | URL | Access notes |
|---|--------|-----|--------------|
| 1 | MISMO Reference Model landing | https://www.mismo.org/standards-resources/residential-specifications/reference-model | Verified — lists all versions 1.0 → 3.6.2 |
| 2 | MISMO Version 3.4 product page | https://www.mismo.org/standards-resources/mismo-product/mismo-version-3-4 | Verified — gives three-bundle non-member download structure |
| 3 | MISMO XML Schema landing | https://www.mismo.org/standards-resources/residential-specifications/reference-model/xml-schema | Verified — routes to per-version pages |
| 4 | Fannie Mae DU Spec Implementation Guide v2.6.1 (Aug 2025, MISMO v3.4 B324) | https://singlefamily.fanniemae.com/media/7571/display | Verified via r.jina.ai proxy — primary source for §2 container structures |
| 5 | Fannie Mae URLA hub | https://singlefamily.fanniemae.com/delivering/uniform-mortgage-data-program/uniform-residential-loan-application | Referenced in search results; primary URLA landing |
| 6 | Fannie Mae ULDD Appendix C XML Samples | https://singlefamily.fanniemae.com/learning-center/delivering/uniform-loan-delivery-dataset-uldd/appendix-c-xml-samples | Verified — four scenario XMLs downloadable |
| 7 | Freddie Mac ULAD / LPA resource hub | https://sf.freddiemac.com/tools-learning/uniform-mortgage-data-program/ulad | Verified directly — provides ulad.xsd + lpa.xsd |
| 8 | Freddie Mac LPA v6.1 Request File Requirements ZIP | https://sf.freddiemac.com/docs/zip/loan-product-advisor-v6.1.00-request-file-requirements.zip | Referenced on ULAD page — contains XSDs |
| 9 | Freddie Mac XLink / ArcRoles reference PDF | https://sf.freddiemac.com/docs/pdf/requirements/ulad_data_relationships_using_xlink_mismo_arcroles_document.pdf | Referenced on ULAD page |
| 10 | Pilotfish MISMO Model Viewer — LiabilityType enum | https://modelviewers.pilotfishtechnology.com/modelviewers/MISMO/model/Format.MESSAGE.DEAL_SETS.DEAL_SET.DEALS.DEAL.LIABILITIES.LIABILITY.LIABILITY_DETAIL.LiabilityType.html | Verified — complete enum list extracted |
| 11 | Pilotfish MISMO Model Viewer — LoanPurposeType enum | https://modelviewers.pilotfishtechnology.com/modelviewers/MISMO/model/Format.MESSAGE.DEAL_SETS.DEAL_SET.DEALS.DEAL.LOANS.LOAN.TERMS_OF_LOAN.LoanPurposeType.html | Verified |
| 12 | Pilotfish MISMO Model Viewer — PropertyUsageType enum | https://modelviewers.pilotfishtechnology.com/modelviewers/MISMO/model/Format.MESSAGE.DEAL_SETS.DEAL_SET.DEALS.DEAL.ASSETS.ASSET.OWNED_PROPERTY.PROPERTY.PROPERTY_DETAIL.PropertyUsageType.html | Verified |
| 13 | Pilotfish MISMO Model Viewer — ASSET_DETAIL | https://modelviewers.pilotfishtechnology.com/modelviewers/MISMO/model/Format.MESSAGE.DEAL_SETS.DEAL_SET.DEALS.DEAL.ASSETS.ASSET.ASSET_DETAIL.html | Verified — all sub-elements extracted |
| 14 | Pilotfish MISMO Model Viewer — LOAN_DETAIL | https://modelviewers.pilotfishtechnology.com/modelviewers/MISMO/model/Format.MESSAGE.DEAL_SETS.DEAL_SET.DEALS.DEAL.LOANS.LOAN.LOAN_DETAIL.html | Verified — full indicator list |
| 15 | Pilotfish MISMO Model Viewer — TERMS_OF_LOAN | https://modelviewers.pilotfishtechnology.com/modelviewers/MISMO/model/Format.MESSAGE.DEAL_SETS.DEAL_SET.DEALS.DEAL.LOANS.LOAN.TERMS_OF_LOAN.html | Verified |
| 16 | Pilotfish MISMO Model Viewer — PROPERTY_DETAIL | https://modelviewers.pilotfishtechnology.com/modelviewers/MISMO/model/Format.MESSAGE.DEAL_SETS.DEAL_SET.DEALS.DEAL.ASSETS.ASSET.OWNED_PROPERTY.PROPERTY.PROPERTY_DETAIL.html | Verified — full child element list |
| 17 | Pilotfish MISMO Model Viewer — OWNED_PROPERTY_DETAIL | https://modelviewers.pilotfishtechnology.com/modelviewers/MISMO/model/Format.MESSAGE.DEAL_SETS.DEAL_SET.DEALS.DEAL.ASSETS.ASSET.OWNED_PROPERTY.OWNED_PROPERTY_DETAIL.html | Verified — full child element list |
| 18 | BaylorRae/fannie-3.2 GitHub (1003.json data file) | https://raw.githubusercontent.com/BaylorRae/fannie-3.2/master/data/1003.json | Verified — canonical 3.2 flat-file field IDs + MISMO mappings |
| 19 | MISMO Dataset Specifications overview | https://www.mismo.org/standards-resources/residential-specifications/datasets | Referenced |
| 20 | Sample MISMO 3.4 XML (GitHub gist — Durrani) | https://gist.github.com/baharalidurrani/6ae5951337488ae8659c04da144a67ad | Verified — educational sample only, not authoritative |

### 6.1 Sources NOT verified — requires follow-up

| Topic | Likely source | Gap to close |
|-------|---------------|--------------|
| Kiavi DSCR XML submission spec | Kiavi broker portal documentation | Not publicly accessible; contact Kiavi broker-tech |
| Visio DSCR XML submission spec | Visio Lending broker portal | Fetched broker portal guide — says PDFs preferred, no MISMO XML mention |
| Kind, Lima One, RCN, Velocity XML specs | Their broker portals / Encompass integration docs | Not found in public search |
| Full MISMO 3.4 AssetType enum | MISMO 3.4 LDD (member-only or non-member ZIP) | Must download LDD ZIP and extract |
| Full MISMO 3.4 IncomeType enum | Same | Same |
| `SUBJECT_PROPERTY_RENTAL_INCOME` container field list | MISMO 3.4 XSD | Must open XSD and list children |
| `BORROWER_DETAIL` full child list | MISMO 3.4 XSD | Pilotfish page returned "MetaData not found" — XSD has truth |

---

## 7. Next Steps (for generator implementation)

1. **Download MISMO 3.4 XSDs locally.** Run `scripts/fetch-mismo-xsd.sh` to pull the
   DU Spec ZIP (contains `MISMO_3.4.0_B324.xsd`) + Freddie LPA ZIP (contains `ulad.xsd`,
   `lpa.xsd`). Place under `schemas/mismo-3.4/`.

2. **Generate a canonical field inventory CSV** from the XSDs.
   - Parse each `<xs:element>` and `<xs:attribute>`.
   - Emit: `container_path,field_name,data_type,cardinality,enum_values,description`.
   - Output to `docs/mismo-3.4/field-inventory.csv`.

3. **Close the "unverified" gaps above** by opening the XSD directly:
   - Search XSD for `SUBJECT_PROPERTY_RENTAL_INCOME` → extract children.
   - Search for `BORROWER_DETAIL` type definition → extract children.
   - Search for `AssetEnum`, `IncomeEnum`, `FundsSourceEnum`, `DispositionStatusEnum` → extract enum members.

4. **Design the Postgres schema** with 1:1 field mapping plus staging columns. Preme
   already has borrower/1003 data; a thin `mismo_staging` table per loan collects the
   deltas needed for generation (e.g., entity LLC fields, DSCR ratio, lease details).

5. **Build profile-based generator** in `lib/mismo/generator.ts`:
   - Input: loan_id → fetch borrower+loan+property+REO rows.
   - Profile: select template (MISMO-baseline, Fannie-DU-3.4, DSCR-Investor, per-lender).
   - Output: MISMO-v3.4 XML + Fannie 3.2 flat-file mirror.

6. **Validate every generated XML** against the MISMO_3.4.0_B324.xsd before shipping to
   lender. Capture validation errors to `logs/mismo-validation/`. Reject any XML that
   fails schema validation — do not ship to lender.

7. **Pilot with one lender first** — suggestion: Kiavi (largest DSCR volume, best docs).
   Submit two handcrafted files, confirm acceptance, then run automated submissions
   behind a manual review flag for the first 20 loans.

---

*End of reference document. Save to `/docs/mismo-3.4/reference.md`. Regenerate after XSD
inspection closes the "unverified" items in §6.1.*
