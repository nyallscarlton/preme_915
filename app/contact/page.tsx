"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Mail, Clock, MapPin, Calendar, CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"

export default function ContactPage() {
  return (
    <Suspense>
      <ContactPageInner />
    </Suspense>
  )
}

function ContactPageInner() {
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    loan_type: "",
    loan_amount: "",
    message: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError("")

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          source: "contact",
          utm_source: searchParams.get("utm_source") || undefined,
          utm_medium: searchParams.get("utm_medium") || undefined,
          utm_campaign: searchParams.get("utm_campaign") || undefined,
        }),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Something went wrong")
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setSubmitting(false)
    }
  }

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
              <Link href="/loan-programs" className="text-white hover:text-[#997100] transition-colors font-medium">
                Loan Programs
              </Link>
              <Link href="/how-it-works" className="text-white hover:text-[#997100] transition-colors font-medium">
                How It Works
              </Link>
              <Link href="/about" className="text-white hover:text-[#997100] transition-colors font-medium">
                About
              </Link>
              <Link href="/contact" className="text-[#997100] font-medium">
                Contact
              </Link>
              <Link href="/login" className="text-white hover:text-[#997100] transition-colors font-medium">
                Login
              </Link>
              <Button className="bg-[#997100] hover:bg-[#b8850a] text-black font-semibold px-6" asChild>
                <Link href="/start?next=/apply">Start Application</Link>
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
              Let&apos;s Talk Business
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-10 leading-relaxed">
              Ready to scale your real estate portfolio? Our lending specialists are here to help.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16">
              {/* Contact Information */}
              <div>
                <h2 className="text-3xl font-bold mb-8">Get in Touch</h2>

                <div className="space-y-8 mb-12">
                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-[#997100] rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <Phone className="h-6 w-6 text-black" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Phone</h3>
                      <p className="text-gray-300 mb-1">(555) 123-PREME</p>
                      <p className="text-gray-400 text-sm">Mon-Fri 8AM-8PM EST</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-[#997100] rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <Mail className="h-6 w-6 text-black" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Email</h3>
                      <p className="text-gray-300 mb-1">funding@preme.com</p>
                      <p className="text-gray-400 text-sm">We respond within 2 hours</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-[#997100] rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <MapPin className="h-6 w-6 text-black" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Office</h3>
                      <p className="text-gray-300 mb-1">123 Investment Blvd</p>
                      <p className="text-gray-300 mb-1">Suite 500</p>
                      <p className="text-gray-300">Miami, FL 33131</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-12 h-12 bg-[#997100] rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      <Clock className="h-6 w-6 text-black" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Business Hours</h3>
                      <p className="text-gray-300 mb-1">Monday - Friday: 8AM - 8PM EST</p>
                      <p className="text-gray-300 mb-1">Saturday: 9AM - 5PM EST</p>
                      <p className="text-gray-300">Sunday: Closed</p>
                    </div>
                  </div>
                </div>

                <Button size="lg" className="bg-[#997100] hover:bg-[#b8850a] text-black font-semibold w-full">
                  <Calendar className="mr-2 h-5 w-5" />
                  Schedule a Call
                </Button>
              </div>

              {/* Contact Form */}
              <div>
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="p-8">
                    <h2 className="text-2xl font-bold text-white mb-6">Send us a Message</h2>

                    {submitted ? (
                      <div className="text-center py-12">
                        <CheckCircle className="h-16 w-16 text-[#997100] mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Message Sent!</h3>
                        <p className="text-gray-300 mb-6">
                          Thank you for reaching out. Our team will get back to you within 2 hours.
                        </p>
                        <Button
                          variant="outline"
                          className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-black bg-transparent"
                          onClick={() => {
                            setSubmitted(false)
                            setFormData({ first_name: "", last_name: "", email: "", phone: "", loan_type: "", loan_amount: "", message: "" })
                          }}
                        >
                          Send Another Message
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">First Name *</label>
                            <Input
                              name="first_name"
                              value={formData.first_name}
                              onChange={handleChange}
                              placeholder="John"
                              required
                              className="bg-black border-gray-700 text-white placeholder-gray-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Last Name *</label>
                            <Input
                              name="last_name"
                              value={formData.last_name}
                              onChange={handleChange}
                              placeholder="Doe"
                              required
                              className="bg-black border-gray-700 text-white placeholder-gray-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Email Address *</label>
                          <Input
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="john@example.com"
                            required
                            className="bg-black border-gray-700 text-white placeholder-gray-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                          <Input
                            name="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="(555) 123-4567"
                            className="bg-black border-gray-700 text-white placeholder-gray-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Loan Type</label>
                          <select
                            name="loan_type"
                            value={formData.loan_type}
                            onChange={handleChange}
                            className="w-full px-3 py-2 bg-black border border-gray-700 rounded-md text-white"
                          >
                            <option value="">Select loan type</option>
                            <option value="dscr">DSCR Loan</option>
                            <option value="business">Business Credit</option>
                            <option value="fix-flip">Fix & Flip</option>
                            <option value="commercial">Commercial</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Loan Amount</label>
                          <Input
                            name="loan_amount"
                            value={formData.loan_amount}
                            onChange={handleChange}
                            placeholder="$500,000"
                            className="bg-black border-gray-700 text-white placeholder-gray-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                          <Textarea
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            placeholder="Tell us about your project and financing needs..."
                            rows={4}
                            className="bg-black border-gray-700 text-white placeholder-gray-500"
                          />
                        </div>

                        {error && (
                          <p className="text-red-400 text-sm">{error}</p>
                        )}

                        <Button
                          type="submit"
                          disabled={submitting}
                          className="w-full bg-[#997100] hover:bg-[#b8850a] text-black font-semibold"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            "Send Message"
                          )}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>

            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">How quickly can I get approved?</h3>
                <p className="text-gray-300">
                  Most applications receive pre-approval within 24 hours. Complete funding typically takes 7-14 days.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">What documents do I need?</h3>
                <p className="text-gray-300">
                  Basic requirements include bank statements, property information, and insurance details. Our team will
                  provide a complete checklist after pre-approval.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">Do you work with first-time investors?</h3>
                <p className="text-gray-300">
                  Absolutely. We work with investors at all experience levels and provide guidance throughout the
                  process.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">What are your minimum loan amounts?</h3>
                <p className="text-gray-300">
                  Minimum loan amounts vary by program. DSCR loans start at $100K, while commercial loans typically
                  start at $1M.
                </p>
              </div>
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
