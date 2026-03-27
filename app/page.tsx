import { Suspense } from "react"
import { getBaseUrl } from "@/lib/config"
import Link from "next/link"

export const dynamic = "force-dynamic"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Handshake,
  LineChart,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Quote,
  Shield,
  Globe,
  Zap,
  Timer,
} from "lucide-react"
import { ApplyButton } from "@/components/apply-button"
import { CallLink } from "@/components/call-link"

const stats = [
  { label: "Average Close", value: "7–14 days" },
  { label: "24h Pre-Qual", value: "Same-day decisions" },
  { label: "Docs Required", value: "No tax returns" },
  { label: "Coverage Ratio", value: "DSCR as low as 0.75" },
]

const personas = [
  {
    title: "Portfolio Builders",
    description: "Scale single-family and small multi-family rentals with 30-year fixed DSCR loans.",
    bullets: ["Up to 85% LTV", "Unlimited properties", "Entity or personal"],
  },
  {
    title: "Short-Term Rental Owners",
    description: "Use actual or AirDNA market rents to qualify vacation rentals and executive stays.",
    bullets: ["DSCR using market comps", "Coastal + resort friendly", "Escrowed reserves optional"],
  },
  {
    title: "Mortgage Brokers",
    description: "White-label DSCR lending with broker protection, dedicated underwriters, and same-day term sheets.",
    bullets: ["TPO portal access", "Broker fee protection", "Custom marketing kits"],
  },
]

const dscrHighlights = [
  { title: "Property-first underwriting", copy: "We qualify the deal based on in-place or market rents instead of your tax returns." },
  { title: "Flexible structures", copy: "30-year fixed, interest-only, or 5/1 ARM options with entity or personal guarantees." },
  { title: "Nationwide footprint", copy: "46 state coverage with local closing partners. Coastal, STR, and mid-term rentals welcome." },
  { title: "Full ecosystem support", copy: "Bundle lending with Hurry Homes acquisitions, KB2 renovations, and MyTCService closings." },
]

const underwritingCriteria = [
  { label: "Minimum DSCR", value: "No minimum — programs start at 0.75 (lender-dependent)" },
  { label: "Credit Score", value: "600+ (varies by lender, LTV, and property type)" },
  { label: "Loan Amount", value: "$50K – $6.25M" },
  { label: "Max LTV", value: "Up to 85% purchase / 80% cash-out" },
  { label: "Reserve Requirement", value: "3–6 months PITI (waived for repeat borrowers)" },
  { label: "Property Types", value: "1–10 unit, mixed-use, STR, condotel, non-warrantable condo" },
]

const processSteps = [
  {
    title: "Apply in 5 minutes",
    description: "Submit property, rent roll, and entity info. No hard credit pull to view terms.",
    cta: "Start Application",
  },
  {
    title: "24-hour pre-qualification",
    description: "Same-day DSCR analysis with rate matrix, leverage, and required reserves spelled out.",
    cta: "Get Pre-Qual",
  },
  {
    title: "Underwrite + close",
    description: "Upload docs through secure portal, clear conditions with a dedicated closing pod, and fund in 7–14 days.",
    cta: "Upload Docs",
  },
  {
    title: "Scale on repeat",
    description: "Portfolio dashboard tracks expirations, DSCR drift, and equity for future cash-outs.",
    cta: "View Portfolio",
  },
]

const faqs = [
  {
    question: "What if my DSCR is just under 1.0?",
    answer:
      "We can often qualify deals at 0.90–0.99 DSCR with compensating factors like lower leverage, higher reserves, or adding short-term rental income." ,
  },
  {
    question: "Do you allow self-managed short-term rentals?",
    answer:
      "Yes. Provide proof of trailing 12-month bookings or we can underwrite using market comps from AirDNA, PriceLabs, or our internal STR index.",
  },
  {
    question: "Can brokers submit directly?",
    answer:
      "Absolutely. Register through our TPO portal, upload your borrower package, and track status in real time. Broker fees are protected on every file.",
  },
  {
    question: "Is there a prepayment penalty?",
    answer:
      "Most DSCR loans include a step-down or yield maintenance structure. We tailor it to your exit horizon and can offer no-prepay options on higher rates.",
  },
]

const testimonials = [
  {
    quote: "Closed on a 4-unit property in 12 days. No tax returns, no W-2s — just the property's cash flow. Preme made it effortless.",
    name: "Marcus T.",
    type: "Portfolio Investor, Atlanta",
  },
  {
    quote: "We've financed 3 Airbnb properties through Preme. Their DSCR program let us scale without the income documentation headache.",
    name: "Jennifer & David K.",
    type: "Short-Term Rental Operators, Savannah",
  },
  {
    quote: "I refer all my investor clients to Preme. Fast pre-quals, competitive rates, and they actually close on time. My clients love them.",
    name: "Robert Chen",
    type: "Mortgage Broker, Charlotte",
  },
  {
    quote: "Other lenders wanted 6 months of bank statements and tax returns. Preme qualified me based on the property's rental potential. Closed in under 2 weeks.",
    name: "Alicia M.",
    type: "Fix & Flip Investor, Marietta",
  },
]

const trustBadges = [
  { icon: Shield, label: "NMLS 2560616" },
  { icon: Globe, label: "50+ States" },
  { icon: Zap, label: "Same-Day Pre-Quals" },
  { icon: Timer, label: "7-14 Day Closings" },
]

const homepageSchemas = [
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What if my DSCR is just under 1.0?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "We can often qualify deals at 0.90–0.99 DSCR with compensating factors like lower leverage, higher reserves, or adding short-term rental income.",
        },
      },
      {
        "@type": "Question",
        name: "Do you allow self-managed short-term rentals?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Provide proof of trailing 12-month bookings or we can underwrite using market comps from AirDNA, PriceLabs, or our internal STR index.",
        },
      },
      {
        "@type": "Question",
        name: "Can brokers submit directly?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Absolutely. Register through our TPO portal, upload your borrower package, and track status in real time. Broker fees are protected on every file.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a prepayment penalty?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most DSCR loans include a step-down or yield maintenance structure. We tailor it to your exit horizon and can offer no-prepay options on higher rates.",
        },
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "LoanOrCredit",
    name: "DSCR Investment Property Loan",
    provider: {
      "@type": "Organization",
      name: "PREME Home Loans",
      url: getBaseUrl(),
    },
    amount: {
      "@type": "MonetaryAmount",
      minValue: 50000,
      maxValue: 6250000,
      currency: "USD",
    },
    loanTerm: {
      "@type": "QuantitativeValue",
      value: 30,
      unitCode: "ANN",
    },
    requiredCollateral: "Investment property with DSCR as low as 0.75",
    description:
      "DSCR loans for real estate investors. Qualify based on property cash flow. 600+ credit score. $50K–$6.25M. 30-year terms. Close in 7–14 days.",
  },
  {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: "PREME DSCR Lending",
    provider: {
      "@type": "Organization",
      name: "PREME Home Loans",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      bestRating: "5",
      ratingCount: "4200",
    },
  },
]

export default function DSCRLandingPage() {
  return (
    <Suspense>
      {homepageSchemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <div className="min-h-screen bg-background text-foreground">
        <nav className="border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative">
                <span className="text-2xl font-bold tracking-wide">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
              </div>
              <Badge className="bg-black text-white hidden md:inline-flex">DSCR Division</Badge>
            </Link>
            <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
              <Link href="/loan-programs" className="hover:text-[#8B6914] transition-colors">
                Programs
              </Link>
              <Link href="/how-it-works" className="hover:text-[#8B6914] transition-colors">
                Process
              </Link>
              <Link href="/blog" className="hover:text-[#8B6914] transition-colors">
                Resources
              </Link>
              <Link href="/contact" className="hover:text-[#8B6914] transition-colors">
                Contact
              </Link>
              <Button variant="outline" className="border-[#8B6914] text-[#8B6914]" asChild>
                <Link href="/auth">Investor Login</Link>
              </Button>
              <ApplyButton className="bg-[#997100] hover:bg-[#b8850a] text-white">
                Start Application
              </ApplyButton>
            </div>
            <ApplyButton className="md:hidden" size="sm">
              Apply
            </ApplyButton>
          </div>
        </nav>

        <main>
          <section className="relative overflow-hidden bg-gradient-to-b from-black via-[#0b0b0b] to-background text-white">
            <div className="absolute inset-0 opacity-40 blur-3xl" style={{ background: "radial-gradient(circle at top, #99710033, transparent 70%)" }} />
            <div className="container relative mx-auto px-6 py-20 lg:py-28">
              <div className="max-w-4xl">
                <Badge className="mb-6 w-fit bg-white/10 text-xs uppercase tracking-[0.2em]">DSCR Lending</Badge>
                <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                  Investment lending that moves at <span className="text-[#f5c770]">your speed</span>.
                </h1>
                <p className="mt-6 text-lg md:text-xl text-gray-200 max-w-2xl">
                  Qualify based on property cash flow, not tax returns. Same-day pre-qualifications, 7–14 day closings, and a team that understands investors, brokers, and short-term rental operators.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <ApplyButton size="lg" className="bg-[#997100] hover:bg-[#b8850a] text-white">
                    Start My DSCR Application
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </ApplyButton>
                  <CallLink size="lg" className="bg-white text-black hover:bg-gray-100">
                    <Phone className="mr-2 h-4 w-4" />
                    Talk to a Specialist
                  </CallLink>
                </div>
                <div className="mt-10 grid gap-4 sm:grid-cols-3 text-sm text-gray-300">
                  <div className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-[#997100]" /> No personal income verification</div>
                  <div className="flex items-center"><Clock className="mr-2 h-4 w-4 text-[#997100]" /> Same-day term sheets</div>
                  <div className="flex items-center"><ShieldCheck className="mr-2 h-4 w-4 text-[#997100]" /> NMLS 2560616</div>
                </div>
              </div>
            </div>
          </section>

          <section className="border-b border-border bg-white">
            <div className="container mx-auto grid grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-2 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border/60 p-6 text-center">
                  <div className="text-2xl font-semibold text-black">{stat.value}</div>
                  <p className="text-sm text-muted-foreground mt-2">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Trust Badges */}
          <section className="bg-gradient-to-r from-black via-[#0b0b0b] to-black text-white py-5">
            <div className="container mx-auto px-6">
              <div className="flex flex-wrap items-center justify-center gap-6 md:gap-0 md:divide-x md:divide-white/20">
                {trustBadges.map((badge) => (
                  <div key={badge.label} className="flex items-center gap-2 px-6 py-1 text-sm font-medium tracking-wide text-white/90">
                    <badge.icon className="h-4 w-4 text-[#f5c770]" />
                    {badge.label}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="py-20">
            <div className="container mx-auto px-6">
              <div className="grid gap-12 lg:grid-cols-2">
                <div>
                  <Badge className="bg-[#fff5e1] text-[#7a4a00] mb-4">Why investors switch to Preme</Badge>
                  <h2 className="text-3xl md:text-4xl font-semibold mb-4">Built for serious DSCR operators</h2>
                  <p className="text-lg text-muted-foreground mb-10">
                    We blend private capital speed with institutional underwriting discipline—plus the Marathon Empire ecosystem when you need acquisitions, renovations, or TC support.
                  </p>
                  <div className="space-y-6">
                    {dscrHighlights.map((item) => (
                      <div key={item.title} className="flex items-start gap-4">
                        <Sparkles className="h-5 w-5 text-[#997100] mt-1" />
                        <div>
                          <h3 className="font-semibold text-lg">{item.title}</h3>
                          <p className="text-muted-foreground">{item.copy}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Card className="bg-black text-white border-none shadow-2xl">
                  <CardContent className="p-8 space-y-6">
                    <div className="flex items-center gap-3">
                      <LineChart className="h-10 w-10 text-[#f5c770]" />
                      <div>
                        <p className="uppercase text-xs tracking-[0.2em] text-white/60">Qualification Snapshot</p>
                        <h3 className="text-2xl font-semibold">DSCR Term Sheet Guide</h3>
                      </div>
                    </div>
                    <div className="grid gap-4">
                      {underwritingCriteria.map((item) => (
                        <div key={item.label} className="rounded-lg bg-white/5 px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-white/60">{item.label}</p>
                          <p className="text-base font-medium">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <Button size="lg" className="w-full bg-[#997100] hover:bg-[#b8850a] text-white" asChild>
                      <Link href="/apply">Get My Pre-Qual</Link>
                    </Button>
                    <p className="text-xs text-white/60 text-center">Actual terms subject to underwriting.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <section className="bg-muted py-20">
            <div className="container mx-auto px-6">
              <div className="mb-12 max-w-3xl">
                <Badge className="bg-black text-white mb-4">Who we serve</Badge>
                <h2 className="text-3xl md:text-4xl font-semibold">Lending lanes for every investor profile</h2>
                <p className="mt-4 text-muted-foreground text-lg">
                  Whether you're optimizing STR yield, expanding long-term rentals, or brokering on behalf of clients, Preme keeps capital moving with dedicated pods for each persona.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
                {personas.map((persona) => (
                  <Card key={persona.title} className="h-full">
                    <CardContent className="p-6 space-y-4">
                      <h3 className="text-xl font-semibold">{persona.title}</h3>
                      <p className="text-muted-foreground">{persona.description}</p>
                      <div className="space-y-2">
                        {persona.bullets.map((bullet) => (
                          <div key={bullet} className="flex items-center text-sm">
                            <CheckCircle2 className="mr-2 h-4 w-4 text-[#997100]" />
                            {bullet}
                          </div>
                        ))}
                      </div>
                      <Link href="/loan-programs" className="inline-flex items-center px-0 text-sm font-medium text-[#8B6914] hover:underline">
                        Explore terms
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Testimonials */}
          <section className="py-20 bg-white">
            <div className="container mx-auto px-6">
              <div className="mb-12 text-center max-w-3xl mx-auto">
                <Badge className="bg-[#fff5e1] text-[#7a4a00] mb-4">What investors say</Badge>
                <h2 className="text-3xl md:text-4xl font-semibold">Trusted by investors and brokers across the Southeast</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {testimonials.map((t) => (
                  <Card key={t.name} className="relative border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6 space-y-4">
                      <Quote className="h-8 w-8 text-[#997100]/30" />
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-[#997100] text-[#997100]" />
                        ))}
                      </div>
                      <p className="text-[15px] leading-relaxed text-foreground/90">&ldquo;{t.quote}&rdquo;</p>
                      <div className="pt-2 border-t border-border/40">
                        <p className="font-semibold text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.type}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          <section className="py-20">
            <div className="container mx-auto px-6">
              <div className="mb-12 text-center max-w-3xl mx-auto">
                <Badge className="bg-[#fff5e1] text-[#7a4a00] mb-4">How it works</Badge>
                <h2 className="text-3xl md:text-4xl font-semibold">Transparent milestones from application to funding</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {processSteps.map((step, index) => (
                  <div key={step.title} className="relative rounded-2xl border border-border/60 p-6">
                    <div className="absolute -top-4 left-6 h-8 w-8 rounded-full bg-[#fff5e1] text-[#7a4a00] flex items-center justify-center font-semibold">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                    <p className="mt-3 text-muted-foreground text-sm">{step.description}</p>
                    <Link href="/apply" className="inline-flex items-center px-0 text-sm font-medium text-[#8B6914] hover:underline mt-2">
                      {step.cta}
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-black text-white py-20">
            <div className="container mx-auto px-6">
              <div className="grid gap-10 lg:grid-cols-2">
                <div className="space-y-6">
                  <Badge className="bg-white/10">Proof in execution</Badge>
                  <h2 className="text-3xl md:text-4xl font-semibold">Investors and brokers stay because the math works</h2>
                  <p className="text-white/70">
                    We publish rate matrices weekly, reprice when markets shift, and proactively alert you when your DSCR drifts toward covenants. No surprises, just funded deals.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card className="bg-white/5 border-none">
                      <CardContent className="p-6">
                        <div className="text-4xl font-semibold">50%+</div>
                        <p className="text-sm text-white/70">Repeat borrower rate across DSCR portfolio</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-none">
                      <CardContent className="p-6">
                        <div className="text-4xl font-semibold">$500M+</div>
                        <p className="text-sm text-white/70">Capital deployed alongside Marathon Empire entities</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                <div className="space-y-6">
                  {[
                    { quote: "Preme funded my STR portfolio in under 12 days — no bank could touch that timeline.", attribution: "DSCR Investor, Atlanta GA" },
                    { quote: "Brokered two DSCR deals last month; Preme's pricing matrix and status updates kept my clients calm the whole way.", attribution: "Fix & Flip Operator, Dallas TX" },
                    { quote: "Their ecosystem is unmatched. I refinanced, renovated with KB2, and listed with Hurry Homes without changing teams.", attribution: "STR Portfolio Owner, Nashville TN" },
                  ].map((testimonial) => (
                    <Card key={testimonial.quote} className="bg-white text-black">
                      <CardContent className="p-6 space-y-3">
                        <div className="flex items-center gap-2 text-[#997100]">
                          <Star className="h-4 w-4" />
                          <Star className="h-4 w-4" />
                          <Star className="h-4 w-4" />
                          <Star className="h-4 w-4" />
                          <Star className="h-4 w-4" />
                          <span className="text-xs text-black/60">{testimonial.attribution}</span>
                        </div>
                        <p className="text-lg font-medium">&ldquo;{testimonial.quote}&rdquo;</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Talk to a Specialist */}
          <section className="py-16 border-y border-border/60">
            <div className="container mx-auto px-6">
              <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-[#0b0b0b] to-[#1a1a1a] p-10 text-center text-white shadow-2xl">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#997100]/20">
                  <Phone className="h-8 w-8 text-[#f5c770]" />
                </div>
                <h2 className="text-3xl font-bold">Talk to a Specialist</h2>
                <p className="mt-3 text-white/70 text-lg max-w-xl mx-auto">
                  Have questions about your deal? Our lending specialists are available Monday–Friday, 8AM–8PM EST. No pressure, no obligations.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <CallLink size="lg" className="bg-[#997100] hover:bg-[#b8850a] text-white text-lg px-8 py-6">
                    <Phone className="mr-2 h-5 w-5" />
                    (470) 942-5787
                  </CallLink>
                </div>
              </div>
            </div>
          </section>

          <section className="py-20 bg-muted">
            <div className="container mx-auto px-6">
              <div className="mb-12 text-center max-w-2xl mx-auto">
                <Badge className="bg-[#fff5e1] text-[#7a4a00] mb-4">Questions, answered</Badge>
                <h2 className="text-3xl md:text-4xl font-semibold">DSCR FAQs</h2>
              </div>
              <div className="mx-auto max-w-4xl space-y-4">
                {faqs.map((faq) => (
                  <details key={faq.question} className="rounded-2xl border border-border/70 bg-white p-6">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-semibold">
                      {faq.question}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </summary>
                    <p className="mt-4 text-muted-foreground">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section className="py-20">
            <div className="container mx-auto px-6">
              <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-white via-[#fff8ef] to-white p-10">
                <div className="grid gap-8 lg:grid-cols-2">
                  <div>
                    <Badge className="bg-black text-white mb-4">Final step</Badge>
                    <h2 className="text-3xl md:text-4xl font-semibold mb-4">Ready for a lender that thinks like an investor?</h2>
                    <p className="text-muted-foreground text-lg mb-8">
                      Upload one deal, experience the process, and roll into portfolio mode. We'll keep you funded—and loop in the Marathon Empire network when it creates extra leverage.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <ApplyButton size="lg" className="bg-[#997100] hover:bg-[#b8850a] text-white">
                        Launch My Application
                      </ApplyButton>
                      <Button size="lg" variant="outline" className="border-black text-black" asChild>
                        <Link href="mailto:loans@premerealestate.com">
                          <Mail className="mr-2 h-4 w-4" />
                          loans@premerealestate.com
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white shadow-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <Handshake className="h-10 w-10 text-[#997100]" />
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Compliance</p>
                        <p className="font-semibold">NMLS ID 2560616</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Preme Home Loans provides DSCR, bridge, and private credit products through federally and state licensed channels. This site does not constitute a commitment to lend. All loans subject to credit approval, satisfactory appraisal, and market conditions.
                    </p>
                    <div className="text-sm text-muted-foreground">
                      <p>Headquarters · 123 Marathon Way, Atlanta, GA</p>
                      <p>Licenses available upon request.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-border/60 bg-black text-white py-10">
          <div className="container mx-auto px-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-white/70">
            <div>
              &copy; {new Date().getFullYear()} Preme Home Loans. NMLS 2560616. Equal Housing Lender.
            </div>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
              <Link href="/contact" className="hover:text-white">Contact</Link>
            </div>
          </div>
        </footer>
      </div>
    </Suspense>
  )
}
