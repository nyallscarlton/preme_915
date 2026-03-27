import Link from "next/link"

export const metadata = {
  title: "SMS Consent & Opt-In | Preme Home Loans",
  description: "SMS messaging consent, opt-in policy, and opt-out instructions for Preme Home Loans.",
}

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <span className="text-2xl font-bold tracking-wide text-black">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
              </div>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-black mb-2">SMS Consent &amp; Opt-In</h1>
        <p className="text-lg text-gray-600 mb-12">Preme Home Loans SMS Communication Policy</p>

        <div className="space-y-10 text-gray-700 leading-relaxed">
          {/* Disclosure Text */}
          <section>
            <h2 className="text-2xl font-semibold text-black mb-4">Consent Disclosure</h2>
            <p>
              By checking this box, I provide my express written consent to receive text messages
              and phone calls (including via automated dialing systems and artificial intelligence)
              about my inquiry from Preme Home Loans at the phone number provided. Consent is not
              a condition of purchase. Message frequency varies. Message and data rates may apply.
              I can revoke consent at any time by replying STOP or calling (470) 942-5787.
            </p>
          </section>

          {/* Opt-In Checkbox Mockup */}
          <section>
            <h2 className="text-2xl font-semibold text-black mb-4">Opt-In Example</h2>
            <p className="mb-4 text-sm text-gray-500">Example of our opt-in checkbox on forms:</p>
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  disabled
                  className="mt-1 h-4 w-4 rounded border-gray-300 accent-[#997100]"
                />
                <span className="text-xs text-gray-500 leading-relaxed">
                  By checking this box, I provide my express written consent to receive text messages
                  and phone calls (including via automated dialing systems and artificial intelligence)
                  about my inquiry from Preme Home Loans at the phone number provided. Consent is not
                  a condition of purchase. Message frequency varies. Message and data rates may apply.
                  I can revoke consent at any time by replying STOP or calling (470) 942-5787.
                </span>
              </div>
            </div>
          </section>

          {/* How to Opt Out */}
          <section>
            <h2 className="text-2xl font-semibold text-black mb-4">How to Opt Out</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Reply <strong>STOP</strong> to any message</li>
              <li>Call <strong>(470) 942-5787</strong></li>
              <li>Email <a href="mailto:loans@premerealestate.com" className="text-[#997100] underline">loans@premerealestate.com</a></li>
            </ul>
          </section>

          {/* Message Details */}
          <section>
            <h2 className="text-2xl font-semibold text-black mb-4">Message Details</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Message frequency varies</li>
              <li>Message and data rates may apply</li>
              <li>Consent is not required to use our services</li>
            </ul>
          </section>

          {/* Footer Links */}
          <section className="border-t border-gray-200 pt-8 flex space-x-6 text-sm">
            <Link href="/privacy" className="text-[#997100] underline hover:text-[#b8850a]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-[#997100] underline hover:text-[#b8850a]">
              Terms of Service
            </Link>
          </section>
        </div>
      </main>
    </div>
  )
}
