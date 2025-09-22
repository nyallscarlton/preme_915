import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, FileText, Clock, Shield, CheckCircle, Phone } from "lucide-react"
import Link from "next/link"
import { MobileNav } from "@/components/MobileNav"

export default function HowItWorksPage() {
  const steps = [
    {
      number: "01",
      title: "Submit Application",
      description:
        "Complete our streamlined online application in just 5 minutes. Provide basic property and financial information.",
      icon: FileText,
      details: [
        "Property address and details",
        "Loan amount and purpose",
        "Basic financial information",
        "Contact preferences",
      ],
    },
    {
      number: "02",
      title: "Get Pre-Approved",
      description: "Receive your pre-approval letter within 24 hours, often same day. No waiting weeks for an answer.",
      icon: Clock,
      details: [
        "Automated underwriting system",
        "Real-time credit analysis",
        "Property value assessment",
        "Pre-approval letter issued",
      ],
    },
    {
      number: "03",
      title: "Submit Documents",
      description:
        "Upload required documents through our secure portal. Our team guides you through exactly what's needed.",
      icon: Shield,
      details: ["Bank statements", "Property documents", "Insurance information", "Additional verification items"],
    },
    {
      number: "04",
      title: "Close Fast",
      description: "Fund your deal in 7-14 days with our expedited closing process. Get your capital when you need it.",
      icon: CheckCircle,
      details: [
        "Final underwriting review",
        "Closing document preparation",
        "Title and escrow coordination",
        "Funds disbursed",
      ],
    },
  ]

  const benefits = [
    {
      title: "No Bank Politics",
      description: "Direct access to private lenders and alternative funding sources. Skip the bureaucracy.",
    },
    {
      title: "Investor-Focused",
      description: "Built by investors, for investors. We understand your business and timeline requirements.",
    },
    {
      title: "Technology-Driven",
      description: "Modern platform with automated processes that eliminate traditional lending delays.",
    },
  ]

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Navigation Bar */}
      <nav className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-2xl font-bold tracking-wide">PREME</span>
              </div>
            </Link>

            <div className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-black hover:text-[#997100] transition-colors font-medium">
                Home
              </Link>
              <Link href="/loan-programs" className="text-black hover:text-[#997100] transition-colors font-medium">
                Loan Programs
              </Link>
              <Link href="/how-it-works" className="text-[#997100] font-medium">
                How It Works
              </Link>
              <Link href="/about" className="text-black hover:text-[#997100] transition-colors font-medium">
                About
              </Link>
              <Link href="/contact" className="text-black hover:text-[#997100] transition-colors font-medium">
                Contact
              </Link>
              <Link href="/auth" className="text-black hover:text-[#997100] transition-colors font-medium">
                Login
              </Link>
              <Button className="bg-[#997100] hover:bg-[#b8850a] text-black font-semibold px-6" asChild>
                <Link href="/start?next=/apply">Start Application</Link>
              </Button>
            </div>

            {/* Mobile Navigation */}
            <MobileNav currentPage="how-it-works" />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 lg:py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight text-black">
              How PREME Works
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-10 leading-relaxed">
              Get funded in as little as 7 days with our streamlined, technology-driven process.
            </p>
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              {steps.map((step, index) => (
                <div key={index} className="relative">
                  <Card className="bg-white border-gray-200 hover:border-[#997100] transition-colors h-full">
                    <CardContent className="p-8">
                      <div className="flex items-start mb-6">
                        <div className="bg-[#997100] text-black w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mr-4 flex-shrink-0">
                          {step.number}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-black mb-2">{step.title}</h3>
                          <p className="text-gray-700 leading-relaxed">{step.description}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {step.details.map((detail, detailIndex) => (
                          <div key={detailIndex} className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-[#997100] mr-3 flex-shrink-0" />
                            <span className="text-gray-600 text-sm">{detail}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Arrow for desktop */}
                  {index < steps.length - 1 && index % 2 === 0 && (
                    <div className="hidden lg:block absolute -right-6 top-1/2 transform -translate-y-1/2">
                      <ArrowRight className="h-8 w-8 text-[#997100]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose PREME */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Why Choose PREME?</h2>
            <p className="text-xl text-gray-600">We've reimagined real estate financing for the modern investor</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <h3 className="text-xl font-bold text-black mb-4">{benefit.title}</h3>
                <p className="text-gray-700 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Comparison */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">PREME vs Traditional Lenders</h2>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-[#997100] text-black">
                <CardContent className="p-8 text-center">
                  <h3 className="text-2xl font-bold mb-4">PREME Process</h3>
                  <div className="text-4xl font-bold mb-2">7-14 Days</div>
                  <p className="font-medium">From application to funding</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200">
                <CardContent className="p-8 text-center">
                  <h3 className="text-2xl font-bold text-black mb-4">Traditional Banks</h3>
                  <div className="text-4xl font-bold text-gray-600 mb-2">30-60 Days</div>
                  <p className="text-gray-600 font-medium">From application to funding</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-gray-200">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Experience the Difference?</h2>
            <p className="text-xl text-gray-700 mb-8">
              Join thousands of investors who've chosen PREME for faster, smarter real estate financing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-[#997100] hover:bg-[#b8850a] text-black font-semibold px-8" asChild>
                <Link href="/start?next=/apply">Start My Application</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-black text-black hover:bg-black hover:text-white bg-transparent">
                <Phone className="mr-2 h-5 w-5" />
                Call (555) 123-PREME
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 mt-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-xl font-bold tracking-wide">PREME</span>
              </div>
            </div>
            <div className="flex space-x-8 text-gray-600">
              <Link href="/privacy" className="hover:text-[#997100] transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-[#997100] transition-colors">
                Terms of Service
              </Link>
              <Link href="/nmls" className="hover:text-[#997100] transition-colors">
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
