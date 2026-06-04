import Image from "next/image"
import Link from "next/link"

export const metadata = {
  title: "SMS Opt-In Proof | Preme Home Loans",
  description: "Evidence of SMS opt-in consent collection on Preme Home Loans forms",
}

export default function SmsOptInProofPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          SMS Opt-In Verification
        </h1>
        <p className="text-gray-600 mb-12">
          Preme Home Loans LLC collects express written SMS consent through an opt-in checkbox on our public contact form. Below is a screenshot and the exact consent disclosure text used.
        </p>

        {/* Section 1: Contact Page */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            1. Contact Page — Public Form
          </h2>
          <p className="text-gray-600 mb-1">
            <strong>URL:</strong>{" "}
            <Link href="/contact" className="text-blue-600 hover:underline">
              https://www.premerealestate.com/contact
            </Link>
          </p>
          <p className="text-gray-600 mb-4">
            Users fill out a contact form with their phone number. An unchecked SMS consent checkbox with full TCPA disclosure is displayed. The checkbox is <strong>not required</strong> to submit the form — users must actively opt in. The form submits successfully whether or not the box is checked.
          </p>
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <img
              src="/sms-proof/contact-form-optin-unchecked.png"
              alt="Contact page form showing phone number field and unchecked SMS consent checkbox with full TCPA disclosure text"
              className="w-full"
            />
          </div>
        </div>

        {/* Consent Text */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            2. Exact Consent Disclosure Text
          </h2>
          <div className="bg-gray-50 border rounded-xl p-6">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                disabled
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <p className="text-sm text-gray-700 leading-relaxed">
                By checking this box, I agree to receive SMS text messages from Preme Home Loans LLC at the phone number provided, including loan status updates, document requests, and appointment reminders. This is optional and is not required to submit this form. Consent is not a condition of purchase. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out or HELP for help. View our{" "}
                <Link href="/sms-consent" className="text-blue-600 hover:underline">SMS Terms</Link>
                {" "}·{" "}
                <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
                {" "}·{" "}
                <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>.
              </p>
            </div>
          </div>
        </div>

        {/* Key Compliance Points */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            4. Compliance Details
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h3 className="font-semibold text-green-800 mb-2">Checkbox Defaults</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>Checkbox is unchecked by default on all forms</li>
                <li>Users must actively click to opt in</li>
                <li>Checkbox is NOT required to submit any form</li>
              </ul>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h3 className="font-semibold text-green-800 mb-2">Disclosure Content</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>Express written consent language</li>
                <li>Automated dialing & AI disclosure</li>
                <li>Message frequency varies</li>
                <li>Message and data rates may apply</li>
              </ul>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h3 className="font-semibold text-green-800 mb-2">Opt-Out Methods</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>Reply STOP to any message</li>
                <li>Call (470) 942-5787</li>
                <li>Email loans@premerealestate.com</li>
              </ul>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h3 className="font-semibold text-green-800 mb-2">No Third-Party Sharing</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>Consent is collected for Preme Home Loans only</li>
                <li>No sharing of opt-in data with third parties</li>
                <li>Consent is not a condition of purchase</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Related Pages */}
        <div className="border-t pt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Pages</h2>
          <div className="flex flex-wrap gap-4">
            <Link href="/contact" className="text-blue-600 hover:underline text-sm">
              Contact Form
            </Link>
            <Link href="/apply" className="text-blue-600 hover:underline text-sm">
              Loan Application
            </Link>
            <Link href="/sms-consent" className="text-blue-600 hover:underline text-sm">
              SMS Consent Policy
            </Link>
            <Link href="/privacy" className="text-blue-600 hover:underline text-sm">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-blue-600 hover:underline text-sm">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
