"use client"

import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { LogIn, Clock } from "lucide-react"
import Link from "next/link"
import { StartChoice } from "@/components/StartChoice"

export default function LuxuryLandingPage() {
  return (
    <Suspense>
      <LuxuryLandingPageInner />
    </Suspense>
  )
}

function LuxuryLandingPageInner() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleStartApplication = () => {
    setIsModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Bar */}
      <nav className="border-b border-border">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-2xl font-bold tracking-wide text-foreground">PREME</span>
              </div>
            </div>

            {/* Navigation Items */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/loan-programs"
                className="text-foreground hover:text-[#997100] transition-colors font-medium"
              >
                Loan Programs
              </Link>
              <Link href="/how-it-works" className="text-foreground hover:text-[#997100] transition-colors font-medium">
                How It Works
              </Link>
              <Link href="/about" className="text-foreground hover:text-[#997100] transition-colors font-medium">
                About
              </Link>
              <Link href="/contact" className="text-foreground hover:text-[#997100] transition-colors font-medium">
                Contact
              </Link>
              <Link href="/auth" className="text-foreground hover:text-[#997100] transition-colors font-medium">
                Login
              </Link>
              <Button
                className="bg-[#997100] hover:bg-[#b8850a] text-white font-semibold px-6"
                onClick={handleStartApplication}
              >
                Start Application
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight tracking-tight">
              Funding for Modern Real Estate Investors
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 leading-relaxed max-w-3xl mx-auto">
              DSCR loans, business credit, and private capital—without the bank headaches.
            </p>

            {/* Hero Buttons */}
            <div className="flex justify-center">
              <Button
                size="lg"
                className="bg-[#997100] hover:bg-[#b8850a] text-white font-semibold text-lg px-10 py-4 rounded-lg"
                onClick={handleStartApplication}
              >
                Start My Application
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Fast Approval Section */}
      <section className="py-24 bg-muted border-t border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-foreground">
              Fast Approval. Faster Closing.
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 leading-relaxed">
              Get approved in hours, not weeks. Our streamlined process closes deals in 7-14 days while traditional
              lenders take 30-60 days.
            </p>
            <Button
              size="lg"
              className="bg-[#997100] hover:bg-[#b8850a] text-white font-semibold text-lg px-12 py-4 rounded-full"
              onClick={handleStartApplication}
            >
              <Clock className="mr-2 h-5 w-5" />
              Get Pre-Approved Now
            </Button>
          </div>
        </div>
      </section>

      {/* Login Section */}
      <section className="py-24 border-t border-border bg-secondary">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-foreground">Investor Portal</h2>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 leading-relaxed">
              Your capital. Your terms. Track deals, docs, and more — anytime.
            </p>
            <Button
              size="lg"
              variant="outline"
              className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-white font-semibold text-lg px-12 py-4 bg-transparent rounded-lg"
              asChild
            >
              <Link href="/auth">
                <LogIn className="mr-2 h-5 w-5" />
                Login to My Portal
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* PreQual CTA Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
              See What You Qualify For
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Free pre-qualification. No credit check. No obligation.
            </p>
            <Button
              size="lg"
              className="bg-[#997100] hover:bg-[#b8850a] text-white font-semibold text-lg px-12 py-4 rounded-lg"
              onClick={handleStartApplication}
            >
              Get Pre-Qualified Now
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 mt-24 bg-muted">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-xl font-bold tracking-wide text-foreground">PREME</span>
              </div>
            </div>
            <div className="flex space-x-8 text-muted-foreground">
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
          <div className="text-center text-muted-foreground mt-8">
            <p>&copy; 2024 PREME. All rights reserved. NMLS ID: 123456</p>
          </div>
        </div>
      </footer>

      <StartChoice isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} nextUrl="/apply" />
    </div>
  )
}
