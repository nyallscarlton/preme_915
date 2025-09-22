import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MobileNav } from "@/components/MobileNav"

// Force deployment to premerealestate.com

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-black">
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
              <Link href="/how-it-works" className="text-black hover:text-[#997100] transition-colors font-medium">
                How It Works
              </Link>
              <Link href="/about" className="text-[#997100] font-medium">
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
            <MobileNav currentPage="about" />
          </div>
        </div>
      </nav>

      <section className="py-20 lg:py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight">About PREME</h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-10 leading-relaxed">
              Funding for modern real estate investors. Built by investors, for investors.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-6 text-gray-600 leading-relaxed">
            <p>
              PREME delivers fast, technology-driven lending solutions tailored for real estate investors. We combine
              private capital with modern underwriting to move as quickly as your deals do.
            </p>
            <p>
              Our platform streamlines the entire process—from application to funding—so you can focus on sourcing and
              executing profitable investments.
            </p>
          </div>
        </div>
      </section>

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
