import type { Metadata } from "next"
import Link from "next/link"
import { CallLinkInline } from "@/components/call-link-inline"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "DSCR Loans | Close in 14 Days, No Tax Returns | Preme Home Loans",
  description:
    "Investment property loans from $50K to $6.25M. Qualify on rental income, not personal income. Same-day pre-qualification. Close in 7-14 days.",
  robots: {
    index: false,
    follow: false,
  },
}

const CTA_HREF = "/start?next=/apply"
const CTA_TEXT = "Get My DSCR Rate Quote \u2192"

function CTAButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href={CTA_HREF}
      className={`inline-block rounded-lg bg-[#997100] px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-[#7a5a00] hover:shadow-xl active:scale-[0.98] ${className}`}
    >
      {CTA_TEXT}
    </Link>
  )
}

function GoldCheck() {
  return (
    <svg
      className="mr-2 h-5 w-5 flex-shrink-0 text-[#997100]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function GoldStar() {
  return (
    <svg className="h-5 w-5 text-[#997100]" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

export default function DSCRLandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0a0a0a]">
      {/* ── Logo ── */}
      <div className="bg-[#0a0a0a] px-6 pt-6 pb-0">
        <div className="mx-auto max-w-4xl">
          <div className="text-left">
            <span className="text-2xl font-black tracking-widest text-white">
              PR
              <span className="relative">
                E
                <span className="absolute -top-1 left-1/2 h-1 w-4 -translate-x-1/2 bg-[#997100]" />
              </span>
              ME
            </span>
            <span className="ml-2 text-xs font-semibold tracking-[0.2em] text-[#997100]">
              HOME LOANS
            </span>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="bg-[#0a0a0a] px-6 pt-10 pb-16 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
            Close Your Investment Property Loan in 14 Days.{" "}
            <span className="text-[#997100]">No Tax Returns.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300 sm:text-xl">
            DSCR loans from $50K to $6.25M. Qualify on property cash flow, not your
            income. Same-day pre-qualification.
          </p>
          <div className="mt-10">
            <CTAButton />
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Takes under 5 minutes. No commitment.
          </p>
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <section className="border-b border-gray-200 bg-gray-50 px-6 py-6">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            "No W-2s or Tax Returns",
            "DSCR as Low as 0.75",
            "7-14 Day Closings",
            "NMLS 2560616",
          ].map((item) => (
            <div key={item} className="flex items-center justify-center text-sm font-medium">
              <GoldCheck />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">How It Works</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Tell us about your deal",
                desc: "Property details, loan amount, credit range. Under 5 minutes.",
              },
              {
                step: "2",
                title: "Get your term sheet",
                desc: "Same-day pre-qualification based on property cash flow.",
              },
              {
                step: "3",
                title: "Close in 7-14 days",
                desc: "No income docs. No employment verification. Just the property and the numbers.",
              },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#997100] text-xl font-bold text-white">
                  {s.step}
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof ── */}
      <section className="bg-[#0a0a0a] px-6 py-16 text-white">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 text-center md:grid-cols-4">
          {[
            { value: "$40M+", label: "in DSCR loans funded" },
            { value: "300+", label: "investor loans closed" },
            { value: "50+", label: "states covered" },
            { value: "14-day", label: "average close time" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-extrabold text-[#997100] sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-gray-300">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <GoldStar key={i} />
            ))}
          </div>
          <blockquote className="mt-6 text-xl font-medium italic leading-relaxed text-gray-800 sm:text-2xl">
            &ldquo;Closed on a 4-unit property in 12 days. No tax returns, no W-2s
            &mdash; just the property&rsquo;s cash flow. Preme made it effortless.&rdquo;
          </blockquote>
          <p className="mt-6 font-semibold text-gray-600">
            &mdash; Marcus T., Portfolio Investor, Atlanta
          </p>
        </div>
      </section>

      {/* ── What You Get ── */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-10 md:grid-cols-2">
            {/* DON'T need */}
            <div>
              <h3 className="text-xl font-bold">
                What we <span className="text-red-600">DON&rsquo;T</span> need:
              </h3>
              <ul className="mt-4 space-y-3">
                {["Tax returns", "W-2s or pay stubs", "Employment verification", "Income documentation"].map(
                  (item) => (
                    <li key={item} className="flex items-center text-gray-700">
                      <svg
                        className="mr-3 h-5 w-5 flex-shrink-0 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            {/* DO need */}
            <div>
              <h3 className="text-xl font-bold">
                What we <span className="text-[#997100]">DO</span> need:
              </h3>
              <ul className="mt-4 space-y-3">
                {["Property address", "Purchase price or value", "Expected rental income", "Credit score range"].map(
                  (item) => (
                    <li key={item} className="flex items-center text-gray-700">
                      <GoldCheck />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Second CTA ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Ready to see what you qualify for?
          </h2>
          <div className="mt-8">
            <CTAButton />
          </div>
          <p className="mt-6 text-gray-500">
            Or call us:{" "}
            <CallLinkInline className="font-semibold text-[#0a0a0a] underline decoration-[#997100] underline-offset-4">
              (470) 942-5787
            </CallLinkInline>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 bg-gray-50 px-6 py-8">
        <div className="mx-auto max-w-4xl text-center text-xs text-gray-500">
          <p>Preme Home Loans | NMLS 2560616 | premerealestate.com</p>
          <p className="mt-1">Equal Housing Opportunity</p>
        </div>
      </footer>
    </div>
  )
}
