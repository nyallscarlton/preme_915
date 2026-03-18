import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { AuthProvider } from "@/hooks/use-auth"
import { getBaseUrl } from "@/lib/config"

const GA_CONVERSION_ID = "AW-17997920712"

const siteUrl = getBaseUrl()

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
    url: siteUrl,
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
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
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
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PREME Home Loans",
    url: siteUrl,
    telephone: "(470) 942-5787",
    email: "lending@premehomeloans.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Atlanta",
      addressRegion: "GA",
      addressCountry: "US",
    },
    sameAs: [],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Real Estate Investment Loan Products",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "FinancialProduct",
            name: "DSCR Loans",
            description:
              "Debt Service Coverage Ratio loans for investment properties. Qualify based on property cash flow, not personal income.",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "FinancialProduct",
            name: "Fix & Flip Financing",
            description:
              "Short-term bridge loans for purchasing and renovating investment properties.",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "FinancialProduct",
            name: "Investment Property Loans",
            description:
              "Flexible financing solutions for single-family, multi-family, and short-term rental investment properties.",
          },
        },
      ],
    },
  }

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          async
          defer
          src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dQHuMoWEFeXkOI&libraries=places"
        ></script>
      </head>
      <body className={inter.className}>
        {/* Google Ads gtag.js */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_CONVERSION_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_CONVERSION_ID}');
          `}
        </Script>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
