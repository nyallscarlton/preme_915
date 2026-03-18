import type { Metadata } from "next"
import { getBaseUrl } from "@/lib/config"

const siteUrl = getBaseUrl()

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact PREME Home Loans. Speak with a lending specialist about DSCR loans, fix & flip financing, bridge loans, and more.",
  openGraph: {
    title: "Contact Us | PREME Home Loans",
    description: "Speak with a lending specialist about investment property financing.",
    url: `${siteUrl}/contact`,
  },
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
