import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/hooks/use-auth"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "PREME Home Loans - Funding for Modern Real Estate Investors",
    template: "%s | PREME Home Loans",
  },
  description:
    "DSCR loans, fix & flip financing, bridge loans, and business credit for real estate investors. No tax returns. Close in 7-14 days.",
  keywords: [
    "DSCR loans",
    "investment property loans",
    "real estate investor financing",
    "fix and flip loans",
    "bridge loans",
    "no income verification loan",
    "private capital",
    "business credit",
    "commercial real estate loans",
  ],
  openGraph: {
    title: "PREME Home Loans - Funding for Modern Real Estate Investors",
    description:
      "DSCR loans, fix & flip financing, and private capital—without the bank headaches. Close in 7-14 days.",
    url: "https://premerealestate.com",
    siteName: "PREME Home Loans",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "PREME Home Loans - Funding for Modern Real Estate Investors",
    description:
      "DSCR loans, fix & flip financing, and private capital—without the bank headaches. Close in 7-14 days.",
  },
  metadataBase: new URL("https://premerealestate.com"),
  alternates: {
    canonical: "https://premerealestate.com",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          async
          defer
          src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dQHuMoWEFeXkOI&libraries=places"
        ></script>
      </head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
