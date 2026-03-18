import Link from "next/link"

export const metadata = {
  title: "SMS Consent | Preme Home Loans",
  description: "SMS messaging consent and opt-in policy for Preme Home Loans.",
}

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-gray-800">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <span className="text-2xl font-bold tracking-wide">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
              </div>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="text-4xl font-bold mb-8">SMS Messaging Consent</h1>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Opt-In &amp; Consent</h2>
            <p>
              By calling Preme Home Loans or submitting a loan application on our website,
              you consent to receive SMS text messages from Preme Home Loans related to
              your loan inquiry, application status, and next steps. During your phone call
              with our team, you will be verbally informed that a text message with your
              application link will be sent to your phone number, and your verbal
              confirmation serves as opt-in consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">What Messages You Will Receive</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>A link to your pre-filled loan application for review and submission</li>
              <li>Application status updates</li>
              <li>Follow-up messages from your assigned loan officer</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Message Frequency</h2>
            <p>
              Message frequency varies based on your loan application activity.
              Typically 1–5 messages per loan inquiry. No recurring marketing messages
              will be sent without additional consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Opt-Out</h2>
            <p>
              You may opt out of SMS messages at any time by replying <strong>STOP</strong> to
              any message from Preme Home Loans. You will receive a confirmation message
              and no further texts will be sent. You may also contact us at{" "}
              <a href="mailto:info@premerealestate.com" className="text-[#997100] underline">
                info@premerealestate.com
              </a>{" "}
              to request removal.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Help</h2>
            <p>
              Reply <strong>HELP</strong> to any message for assistance, or contact us at{" "}
              <a href="mailto:info@premerealestate.com" className="text-[#997100] underline">
                info@premerealestate.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Rates &amp; Carriers</h2>
            <p>
              Message and data rates may apply. Preme Home Loans is not responsible for
              carrier charges. Compatible with all major US carriers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Privacy</h2>
            <p>
              Your phone number and personal information are handled in accordance with our{" "}
              <Link href="/privacy" className="text-[#997100] underline">
                Privacy Policy
              </Link>. We do not sell or share your phone number with third parties for
              marketing purposes.
            </p>
          </section>

          <section className="border-t border-gray-800 pt-8 text-sm text-gray-500">
            <p>Preme Home Loans | premerealestate.com</p>
            <p>For questions: info@premerealestate.com</p>
          </section>
        </div>
      </main>
    </div>
  )
}
