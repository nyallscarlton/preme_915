import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Home, CreditCard, Hammer, Building2, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function LoanProgramsPage() {
  const programs = [
    {
      icon: Home,
      title: "DSCR Loans",
      description:
        "Debt Service Coverage Ratio loans based on property cash flow, not personal income. Perfect for rental properties and investment portfolios.",
      features: [
        "Up to 80% LTV",
        "No personal income verification",
        "Cash flow based approval",
        "30-year fixed rates available",
        "Close in 21-30 days",
      ],
      rates: "Starting at 7.25%",
      badge: "Most Popular",
    },
    {
      icon: CreditCard,
      title: "Business Credit Lines",
      description:
        "Unsecured business credit lines and term loans for real estate ventures, acquisitions, and working capital needs.",
      features: [
        "Up to $500K unsecured",
        "No collateral required",
        "Fast approval process",
        "Flexible repayment terms",
        "Build business credit",
      ],
      rates: "From 8.99% APR",
      badge: "Fast Funding",
    },
    {
      icon: Hammer,
      title: "Fix & Flip Loans",
      description:
        "Short-term financing for property acquisition and renovation projects. Get the capital you need to flip properties profitably.",
      features: [
        "12-24 month terms",
        "Up to 90% ARV",
        "Interest-only payments",
        "Fast closing process",
        "Rehab draws available",
      ],
      rates: "Starting at 9.5%",
      badge: "Quick Close",
    },
    {
      icon: Building2,
      title: "Commercial Real Estate",
      description:
        "Multi-family, office, retail, and industrial property financing solutions for serious commercial investors.",
      features: [
        "$1M - $50M+ loans",
        "Competitive rates",
        "Flexible terms",
        "Experienced underwriting",
        "Portfolio lending available",
      ],
      rates: "Custom pricing",
      badge: "High Volume",
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation Bar */}
      <nav className="border-b border-gray-800">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-2xl font-bold tracking-wide">PREME</span>
              </div>
            </Link>

            <div className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-white hover:text-[#997100] transition-colors font-medium">
                Home
              </Link>
              <Link href="/loan-programs" className="text-[#997100] font-medium">
                Loan Programs
              </Link>
              <Link href="/how-it-works" className="text-white hover:text-[#997100] transition-colors font-medium">
                How It Works
              </Link>
              <Link href="/about" className="text-white hover:text-[#997100] transition-colors font-medium">
                About
              </Link>
              <Link href="/contact" className="text-white hover:text-[#997100] transition-colors font-medium">
                Contact
              </Link>
              <Link href="/login" className="text-white hover:text-[#997100] transition-colors font-medium">
                Login
              </Link>
              <Button className="bg-[#997100] hover:bg-[#b8850a] text-black font-semibold px-6">
                Start Application
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 lg:py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight">
              Loan Programs Built for Investors
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-10 leading-relaxed">
              From DSCR loans to commercial financing — we have the capital solutions to scale your real estate
              portfolio.
            </p>
          </div>
        </div>
      </section>

      {/* Loan Programs Grid */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
            {programs.map((program, index) => (
              <Card key={index} className="bg-gray-900 border-gray-800 hover:border-[#997100] transition-colors">
                <CardContent className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-[#997100] rounded-lg flex items-center justify-center mr-4">
                        <program.icon className="h-6 w-6 text-black" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-1">{program.title}</h3>
                        <p className="text-[#997100] font-semibold">{program.rates}</p>
                      </div>
                    </div>
                    <Badge className="bg-[#997100] text-black font-semibold">{program.badge}</Badge>
                  </div>

                  <p className="text-gray-300 mb-6 leading-relaxed">{program.description}</p>

                  <div className="space-y-3 mb-8">
                    {program.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-[#997100] mr-3 flex-shrink-0" />
                        <span className="text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button className="w-full bg-[#997100] hover:bg-[#b8850a] text-black font-semibold">
                    Apply for {program.title}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-gray-800">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-gray-300 mb-8">
              Our lending specialists are standing by to help you choose the right program for your investment goals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-[#997100] hover:bg-[#b8850a] text-black font-semibold px-8">
                Start My Application
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-black bg-transparent"
              >
                Schedule a Consultation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 mt-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-xl font-bold tracking-wide">PREME</span>
              </div>
            </div>
            <div className="flex space-x-8 text-gray-400">
              <Link href="#" className="hover:text-[#997100] transition-colors">
                Privacy Policy
              </Link>
              <Link href="#" className="hover:text-[#997100] transition-colors">
                Terms of Service
              </Link>
              <Link href="#" className="hover:text-[#997100] transition-colors">
                NMLS Disclosure
              </Link>
            </div>
          </div>
          <div className="text-center text-gray-500 mt-8">
            <p>&copy; 2024 PREME. All rights reserved. NMLS ID: 123456</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
