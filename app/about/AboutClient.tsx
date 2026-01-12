"use client"

import { Button } from "@/components/ui/button"
import { Users, TrendingUp, DollarSign } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function AboutClient() {
  const [primaryColor, setPrimaryColor] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return

    const computedPrimary = getComputedStyle(document.documentElement).getPropertyValue("--primary")
    setPrimaryColor(computedPrimary)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Bar */}
      <nav className="border-b border-border">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-primary"></div>
                <span className="text-2xl font-bold tracking-wide text-foreground">PREME</span>
              </div>
            </Link>

            {/* Navigation Items */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-foreground hover:text-primary transition-colors font-medium">
                Home
              </Link>
              <Link href="/loan-programs" className="text-foreground hover:text-primary transition-colors font-medium">
                Loan Programs
              </Link>
              <Link href="/how-it-works" className="text-foreground hover:text-primary transition-colors font-medium">
                How It Works
              </Link>
              <Link href="/about" className="text-primary font-medium">
                About
              </Link>
              <Link href="/contact" className="text-foreground hover:text-primary transition-colors font-medium">
                Contact
              </Link>
              <Link href="/auth" className="text-foreground hover:text-primary transition-colors font-medium">
                Login
              </Link>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6" asChild>
                <Link href="/start?next=/apply">Start Application</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: primaryColor
                ? `linear-gradient(${primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${primaryColor} 1px, transparent 1px)`
                : undefined,
              backgroundSize: "60px 60px",
            }}
          ></div>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight tracking-tight text-foreground">
              This Isn't Traditional Real Estate.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              PREME is a cultural shift — built for creators, closers, and investors who play the long game.
            </p>
          </div>
        </div>
      </section>

      {/* Founder Bio Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Photo Placeholder */}
              <div className="order-2 lg:order-1">
                <div className="aspect-[4/5] bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-black font-bold text-2xl">NC</span>
                    </div>
                    <p className="text-muted-foreground text-sm">Founder Photo</p>
                  </div>
                </div>
              </div>

              {/* Bio Content */}
              <div className="order-1 lg:order-2">
                <h2 className="text-3xl md:text-4xl font-bold mb-8 tracking-tight text-foreground">
                  Meet Nyalls C, Founder of PREME
                </h2>
                <div className="space-y-6 text-lg md:text-xl text-muted-foreground leading-relaxed">
                  <p>
                    A licensed investor and builder of investor teams, Nyalls launched PREME to break the broken
                    brokerage model. His mission? Help others grow through real estate by mixing culture, community, and
                    capital.
                  </p>
                  <p>No fluff. No gatekeeping.</p>

                  {/* Gold Callout */}
                  <div className="border-l-4 border-primary pl-6 my-8">
                    <p className="text-primary font-semibold text-xl">"Built by investors. Powered by culture."</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-12 tracking-tight text-foreground">Why PREME Exists</h2>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mb-16">
              We're not agents chasing commissions. We're investors building equity. PREME exists to educate, empower,
              and elevate those ready to dominate their market — from first deal to portfolio freedom.
            </p>

            {/* Mission Icons */}
            <div className="grid md:grid-cols-3 gap-12 mb-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-black" />
                </div>
                <h3 className="text-lg font-semibold text-primary mb-2">Community</h3>
                <p className="text-muted-foreground">Building networks that last</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="h-8 w-8 text-black" />
                </div>
                <h3 className="text-lg font-semibold text-primary mb-2">Cashflow</h3>
                <p className="text-muted-foreground">Generating sustainable income</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-black" />
                </div>
                <h3 className="text-lg font-semibold text-primary mb-2">Growth</h3>
                <p className="text-muted-foreground">Scaling beyond limits</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xl px-12 py-6 rounded-lg mb-6"
              asChild
            >
              <Link href="/start?next=/apply">Join the Collective</Link>
            </Button>
            <p className="text-xl text-muted-foreground font-medium">Let's build. Together.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 mt-24 bg-muted">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-primary"></div>
                <span className="text-xl font-bold tracking-wide text-foreground">PREME</span>
              </div>
            </div>
            <div className="flex space-x-8 text-muted-foreground">
              <Link href="#" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              <Link href="#" className="hover:text-primary transition-colors">
                Terms of Service
              </Link>
              <Link href="#" className="hover:text-primary transition-colors">
                NMLS Disclosure
              </Link>
            </div>
          </div>
          <div className="text-center text-muted-foreground mt-8">
            <p>&copy; 2024 PREME. All rights reserved. NMLS ID: 123456</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
