import Link from "next/link"

export const metadata = {
  title: "Privacy Policy | Preme Home Loans",
  description: "Privacy Policy for Preme Home Loans — how we collect, use, and protect your personal information.",
}

export default function PrivacyPolicyPage() {
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
              <Link href="/contact" className="text-white hover:text-[#997100] transition-colors font-medium">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-gray-400 mb-12">Last updated: March 14, 2026</p>

            <div className="prose prose-invert prose-lg max-w-none space-y-10">
              {/* Introduction */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Introduction</h2>
                <p className="text-gray-300 leading-relaxed">
                  Preme Home Loans (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you visit our website, use our services, or interact with us in any way. By using our website or services, you consent to the data practices described in this policy.
                </p>
              </section>

              {/* Information We Collect */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Information We Collect</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  We collect information that you voluntarily provide to us when you fill out forms on our website, apply for a loan, or contact us. This information may include:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Personal identifiers:</strong> Full name, email address, phone number, mailing address</li>
                  <li><strong className="text-white">Financial information:</strong> Income, employment details, credit score range, assets, liabilities, bank statements</li>
                  <li><strong className="text-white">Loan details:</strong> Loan amount requested, loan type, property information, down payment amount</li>
                  <li><strong className="text-white">Identity verification:</strong> Social Security Number, date of birth, government-issued ID</li>
                  <li><strong className="text-white">Property information:</strong> Property address, property type, estimated property value</li>
                  <li><strong className="text-white">Technical data:</strong> IP address, browser type, device information, cookies, and usage analytics</li>
                </ul>
              </section>

              {/* How We Use Your Phone Number */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">How We Use Your Phone Number</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  When you provide your phone number on any form on our website, you may be contacted via:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Phone calls,</strong> including calls made using automated telephone dialing systems, prerecorded or artificial voice messages, and artificial intelligence technology</li>
                  <li><strong className="text-white">SMS/text messages,</strong> including automated text messages regarding your inquiry, application status, or related services</li>
                  <li><strong className="text-white">Emails</strong> related to your inquiry, application, or services offered by Preme Home Loans</li>
                </ul>
                <p className="text-gray-300 leading-relaxed mt-4">
                  These communications may come from Preme Home Loans or our lending partners and affiliates. Message and data rates may apply. Message frequency varies based on your interaction with us.
                </p>
              </section>

              {/* TCPA Compliance */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">TCPA Compliance &amp; Consent</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  In compliance with the Telephone Consumer Protection Act (TCPA), 47 U.S.C. &sect; 227, we obtain your express written consent before contacting you via automated means. By checking the consent checkbox on any of our forms, you provide your express written consent to receive:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li>Calls using an automatic telephone dialing system (ATDS)</li>
                  <li>Prerecorded or artificial voice messages</li>
                  <li>Calls and messages generated using artificial intelligence</li>
                  <li>SMS/text messages</li>
                  <li>Emails about your inquiry</li>
                </ul>
                <p className="text-gray-300 leading-relaxed mt-4">
                  <strong className="text-white">Consent is not a condition of purchasing any goods or services.</strong> You may revoke your consent at any time.
                </p>
              </section>

              {/* How to Opt Out */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">How to Opt Out</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  You can revoke your consent and opt out of communications at any time by:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Text messages:</strong> Reply <strong className="text-[#997100]">STOP</strong> to any text message you receive from us</li>
                  <li><strong className="text-white">Phone:</strong> Call us at <a href="tel:+14709425787" className="text-[#997100] hover:underline">(470) 942-5787</a> and request to be removed from our contact list</li>
                  <li><strong className="text-white">Email:</strong> Send an opt-out request to <a href="mailto:lending@premehomeloans.com" className="text-[#997100] hover:underline">lending@premehomeloans.com</a></li>
                </ul>
                <p className="text-gray-300 leading-relaxed mt-4">
                  We will process your opt-out request within a reasonable timeframe, typically within 10 business days for calls and texts, and within 10 business days for email.
                </p>
              </section>

              {/* How We Use Your Information */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">How We Use Your Information</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  We use the information we collect for the following purposes:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li>Processing and evaluating your loan application</li>
                  <li>Communicating with you about your inquiry or application status</li>
                  <li>Verifying your identity and financial information</li>
                  <li>Matching you with appropriate loan programs and lending partners</li>
                  <li>Complying with legal and regulatory obligations</li>
                  <li>Improving our website, services, and customer experience</li>
                  <li>Preventing fraud and ensuring security</li>
                </ul>
              </section>

              {/* Data Sharing */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Data Sharing &amp; Disclosure</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  We may share your personal information with the following parties:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Lending partners and affiliates:</strong> To process your loan application and match you with loan programs</li>
                  <li><strong className="text-white">Service providers:</strong> Third-party vendors who assist in operating our website, conducting our business, or serving you (e.g., CRM systems, email providers, analytics)</li>
                  <li><strong className="text-white">Credit bureaus and reporting agencies:</strong> As necessary for loan processing and underwriting</li>
                  <li><strong className="text-white">Legal and regulatory authorities:</strong> When required by law, regulation, or legal process</li>
                </ul>
                <p className="text-gray-300 leading-relaxed mt-4">
                  We do not sell your personal information to third parties for their own marketing purposes.
                </p>
              </section>

              {/* Data Retention */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Data Retention</h2>
                <p className="text-gray-300 leading-relaxed">
                  We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy, unless a longer retention period is required or permitted by law. For loan applications, we retain records for a minimum of 25 months after final action is taken on the application, in accordance with the Equal Credit Opportunity Act (ECOA) and Regulation B. After this period, your data may be securely deleted or anonymized.
                </p>
              </section>

              {/* ESIGN Act */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Electronic Signatures (ESIGN Act)</h2>
                <p className="text-gray-300 leading-relaxed">
                  In accordance with the Electronic Signatures in Global and National Commerce Act (ESIGN Act), 15 U.S.C. &sect; 7001 et seq., your electronic consent provided via our website forms constitutes a valid and enforceable &quot;express written consent&quot; under the TCPA. By checking the consent checkbox and submitting a form, you agree that your electronic signature has the same legal effect as a handwritten signature.
                </p>
              </section>

              {/* CCPA */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">California Consumer Privacy Act (CCPA)</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), as amended by the California Privacy Rights Act (CPRA):
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Right to Know:</strong> You may request disclosure of the categories and specific pieces of personal information we have collected about you</li>
                  <li><strong className="text-white">Right to Delete:</strong> You may request that we delete your personal information, subject to certain exceptions</li>
                  <li><strong className="text-white">Right to Correct:</strong> You may request correction of inaccurate personal information</li>
                  <li><strong className="text-white">Right to Opt-Out of Sale:</strong> We do not sell personal information. If this changes, we will provide a &quot;Do Not Sell My Personal Information&quot; link</li>
                  <li><strong className="text-white">Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA rights</li>
                </ul>
                <p className="text-gray-300 leading-relaxed mt-4">
                  To exercise your CCPA rights, contact us at <a href="mailto:lending@premehomeloans.com" className="text-[#997100] hover:underline">lending@premehomeloans.com</a> or call <a href="tel:+14709425787" className="text-[#997100] hover:underline">(470) 942-5787</a>. We will verify your identity before processing your request.
                </p>
              </section>

              {/* Security */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Data Security</h2>
                <p className="text-gray-300 leading-relaxed">
                  We implement industry-standard administrative, technical, and physical security measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction. These measures include encryption of data in transit and at rest, secure server infrastructure, access controls, and regular security assessments. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              {/* Cookies */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Cookies &amp; Tracking Technologies</h2>
                <p className="text-gray-300 leading-relaxed">
                  Our website uses cookies and similar tracking technologies to enhance your browsing experience, analyze website traffic, and understand how visitors interact with our site. You can control cookie preferences through your browser settings. Disabling cookies may limit some functionality of our website.
                </p>
              </section>

              {/* Third-Party Links */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Third-Party Links</h2>
                <p className="text-gray-300 leading-relaxed">
                  Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of these external sites. We encourage you to read the privacy policies of any third-party websites you visit.
                </p>
              </section>

              {/* Children */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Children&apos;s Privacy</h2>
                <p className="text-gray-300 leading-relaxed">
                  Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If we learn that we have collected personal information from a child under 18, we will promptly delete it.
                </p>
              </section>

              {/* Changes */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Changes to This Policy</h2>
                <p className="text-gray-300 leading-relaxed">
                  We may update this Privacy Policy from time to time to reflect changes in our practices or applicable laws. We will post the updated policy on this page with a revised &quot;Last updated&quot; date. We encourage you to review this policy periodically.
                </p>
              </section>

              {/* Contact */}
              <section className="border-t border-gray-800 pt-10">
                <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  If you have questions or concerns about this Privacy Policy, your personal information, or wish to exercise any of your rights, please contact us:
                </p>
                <div className="bg-gray-900 rounded-lg p-6 space-y-3">
                  <p className="text-gray-300"><strong className="text-white">Preme Home Loans</strong></p>
                  <p className="text-gray-300">Atlanta, GA</p>
                  <p className="text-gray-300">
                    Phone: <a href="tel:+14709425787" className="text-[#997100] hover:underline">(470) 942-5787</a>
                  </p>
                  <p className="text-gray-300">
                    Email: <a href="mailto:lending@premehomeloans.com" className="text-[#997100] hover:underline">lending@premehomeloans.com</a>
                  </p>
                  <p className="text-gray-300">NMLS ID: 2560616</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

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
              <Link href="/privacy" className="text-[#997100] transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-[#997100] transition-colors">
                Terms of Service
              </Link>
              <Link href="/contact" className="hover:text-[#997100] transition-colors">
                Contact
              </Link>
            </div>
          </div>
          <div className="text-center text-gray-500 mt-8">
            <p>&copy; 2024 PREME. All rights reserved. NMLS ID: 2560616</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
