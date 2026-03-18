import type { Metadata } from "next"
import { DscrCalculator } from "./dscr-calculator"

export const metadata: Metadata = {
  title: "DSCR Loan Calculator | Estimate Your Investment Property Rate",
  description:
    "Calculate your DSCR ratio, estimated interest rate, and monthly payment for investment property loans. No tax returns needed. Get a quick rate quote from Preme Home Loans.",
  keywords: [
    "DSCR calculator",
    "DSCR loan calculator",
    "investment property rate calculator",
    "rental property loan calculator",
    "debt service coverage ratio calculator",
    "DSCR rate quote",
  ],
}

export default function CalculatorPage() {
  const calculatorSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "DSCR Loan Calculator",
    description:
      "Calculate your DSCR ratio, estimated interest rate, and monthly payment for investment property loans.",
    url: "https://premehomeloans.com/calculator",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    provider: {
      "@type": "Organization",
      name: "PREME Home Loans",
      url: "https://premehomeloans.com",
    },
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a DSCR loan?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A DSCR (Debt Service Coverage Ratio) loan is an investment property mortgage that qualifies borrowers based on the property's rental income rather than personal income. If the property's rent covers the mortgage payment, you can qualify — no tax returns or W-2s needed.",
        },
      },
      {
        "@type": "Question",
        name: "What DSCR ratio do I need to qualify?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most lenders require a minimum DSCR of 0.75, meaning the property's rental income covers at least 75% of the total mortgage payment (PITIA). A DSCR of 1.25 or higher typically gets the best rates.",
        },
      },
      {
        "@type": "Question",
        name: "How are DSCR loan rates determined?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "DSCR loan rates depend on several factors: your DSCR ratio, credit score, loan-to-value (LTV), property type, and loan purpose. Higher DSCR ratios, higher credit scores, and lower LTVs all lead to better rates.",
        },
      },
      {
        "@type": "Question",
        name: "Can I get a DSCR loan with no rental history?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Many DSCR lenders accept market rent projections from an appraiser, even if the property has no current tenants. This is common for purchase transactions and newly renovated properties.",
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(calculatorSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <DscrCalculator />
    </>
  )
}
