import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Loan Programs",
  description:
    "DSCR loans, bridge loans, fix & flip financing, business credit, and commercial loans for real estate investors. Explore PREME loan programs.",
  openGraph: {
    title: "Loan Programs | PREME Home Loans",
    description: "DSCR, Bridge, Fix & Flip, and more — explore our loan programs for real estate investors.",
    url: "https://premerealestate.com/loan-programs",
  },
  alternates: {
    canonical: "https://premerealestate.com/loan-programs",
  },
}

export default function LoanProgramsLayout({ children }: { children: React.ReactNode }) {
  return children
}
