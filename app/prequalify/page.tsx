"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, ArrowRight, Building2, Clock } from "lucide-react"
import { PrequalifyForm, type PrequalResult } from "@/components/prequalify/prequalify-form"
import { gtagApplicationStart, gtagFormStep, gtagLeadConversion } from "@/lib/gtag"

export default function PrequalifyPage() {
  const [result, setResult] = useState<PrequalResult | null>(null)

  useEffect(() => {
    gtagApplicationStart("guest")
    gtagFormStep(1, "guest")
  }, [])

  if (result) {
    return <PreApprovalScreen result={result} />
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <Link href="/" className="inline-block">
            <span className="text-3xl font-bold tracking-wide">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
          </Link>
        </div>
      </header>
      <main className="container mx-auto px-6 py-12">
        <PrequalifyForm onApproved={(r) => { gtagLeadConversion(); setResult(r) }} />
      </main>
    </div>
  )
}

function PreApprovalScreen({ result }: { result: PrequalResult }) {
  const qualified = result.qualifiedCount > 0
  const continueHref = `/apply-full?guest=1&token=${encodeURIComponent(result.guestToken)}`

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <Link href="/" className="inline-block">
            <span className="text-3xl font-bold tracking-wide">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
          </Link>
        </div>
      </header>
      <main className="container mx-auto px-6 py-16">
        <div className="max-w-2xl mx-auto text-center">
          {qualified ? (
            <>
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-50 mb-6">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <h1 className="text-4xl font-bold mb-3">You're pre-qualified.</h1>
              <p className="text-xl text-gray-600 mb-8">
                Based on what you told us, you fit {" "}
                <span className="font-semibold text-[#997100]">
                  {result.qualifiedCount} lender{result.qualifiedCount === 1 ? "" : "s"}'
                </span>{" "}
                guidelines.
                {result.topLender?.name && (
                  <>
                    {" "}Top match: <strong>{result.topLender.name}</strong>.
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-yellow-50 mb-6">
                <Building2 className="h-12 w-12 text-yellow-600" />
              </div>
              <h1 className="text-4xl font-bold mb-3">Let's talk first.</h1>
              <p className="text-xl text-gray-600 mb-8">
                Based on what you told us, we couldn't pre-match you to a lender automatically — but that doesn't mean no. One of our loan officers can walk through alternatives with you. {result.matchReason && <span className="text-sm block mt-2 text-gray-500">Reason: {result.matchReason}</span>}
              </p>
            </>
          )}

          <Card className="text-left bg-gray-50 border-gray-200 mb-8">
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold">What's next</h3>
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#997100] text-white flex items-center justify-center text-xs font-bold">1</span>
                  <span>Complete the full 1003 application <Clock className="inline h-3 w-3 ml-1" /> about 5–8 minutes. We've already pre-filled what you gave us.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#997100] text-white flex items-center justify-center text-xs font-bold">2</span>
                  <span>We route your file to the {qualified ? "best-matched" : "best-fit"} wholesale lender and quote you a rate.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#997100] text-white flex items-center justify-center text-xs font-bold">3</span>
                  <span>You lock terms, order an appraisal, and close in 21–30 days.</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Button asChild className="px-10 py-6 text-base bg-[#997100] hover:bg-[#997100]/90">
            <Link href={continueHref}>
              Continue to Full Application<ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <p className="text-xs text-gray-500 mt-6">
            Ref: <span className="font-mono text-[#997100]">{result.applicationNumber}</span>{" "}
            · We also emailed you a secure link to come back later if you need a break.
          </p>
        </div>
      </main>
    </div>
  )
}
