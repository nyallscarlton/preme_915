import Link from "next/link"

export const metadata = {
  title: "SMS Terms & Opt-In | Preme Home Loans",
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
        <h1 className="text-4xl font-bold text-black mb-2">SMS Terms &amp; Opt-In</h1>
        <p className="text-lg text-gray-600 mb-12">Preme Home Loans LLC — SMS Communication Policy</p>

        <div className="space-y-10 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-black mb-4">Who Sends These Messages</h2>
            <p>
              Preme Home Loans LLC ("Preme") is a licensed direct mortgage lender. SMS messages are sent from
              our number <strong>(470) 942-5787</strong> to applicants and clients who have expressly opted in
              on our website forms. We do not share your phone number with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-black mb-4">Consent Disclosure</h2>
            <p>
              By checking the opt-in box on any Preme form, you agree to receive SMS text messages from
              Preme Home Loans LLC at the phone number provided, including loan status updates, document requests,
              and appointment reminders. This is optional and is not required to submit this form. Consent is not
              a condition of purchase. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to
              opt out or HELP for help.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-black mb-4">Opt-In Checkbox — Example</h2>
            <p className="mb-4 text-sm text-gray-500">This is the exact checkbox shown on our contact and application forms:</p>
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  disabled
                  className="mt-1 h-4 w-4 rounded border-gray-300 accent-[#997100]"
                />
                <span className="text-xs text-gray-500 leading-relaxed">
                  By checking this box, I agree to receive SMS text messages from Preme Home Loans LLC at the
                  phone number provided, including loan status updates, document requests, and appointment
                  reminders. This is optional and is not required to submit this form. Consent is not a condition
                  of purchase. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out
                  or HELP for help.{" "}
                  <span className="text-[#997100] underline">SMS Terms</span>{" "}·{" "}
                  <span className="text-[#997100] underline">Privacy Policy</span>{" "}·{" "}
                  <span className="text-[#997100] underline">Terms of Service</span>
                </span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-black mb-4">Message Types</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Loan application status updates</li>
              <li>Document requests and reminders</li>
              <li>Appointment confirmations and reminders</li>
              <li>Loan milestone notifications (approval, closing date, etc.)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-black mb-4">How to Opt Out</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Reply <strong>STOP</strong> to any message — you will receive one confirmation and no further messages</li>
              <li>Reply <strong>HELP</strong> for support information</li>
              <li>Call <strong>(470) 942-5787</strong></li>
              <li>Email <a href="mailto:loans@premerealestate.com" className="text-[#997100] underline">loans@premerealestate.com</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-black mb-4">Message Details</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Message frequency varies based on your loan stage</li>
              <li>Message and data rates may apply</li>
              <li>Consent is not required to apply for or receive a loan</li>
              <li>We do not share your phone number with third parties for marketing</li>
            </ul>
          </section>

          <section className="border-t border-gray-200 pt-8 flex space-x-6 text-sm">
            <Link href="/privacy" className="text-[#997100] underline hover:text-[#b8850a]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-[#997100] underline hover:text-[#b8850a]">
              Terms of Service
            </Link>
            <Link href="/contact" className="text-[#997100] underline hover:text-[#b8850a]">
              Contact Us
            </Link>
          </section>
        </div>
      </main>
    </div>
  )
}
