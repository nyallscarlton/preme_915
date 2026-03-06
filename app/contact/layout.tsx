import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact PREME Home Loans. Speak with a lending specialist about DSCR loans, fix & flip financing, bridge loans, and more.",
  openGraph: {
    title: "Contact Us | PREME Home Loans",
    description: "Speak with a lending specialist about investment property financing.",
    url: "https://www.premerealestate.com/contact",
  },
  alternates: {
    canonical: "https://www.premerealestate.com/contact",
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
