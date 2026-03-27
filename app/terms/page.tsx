import Link from "next/link"

export const metadata = {
  title: "Terms of Service | Preme Home Loans",
  description: "Terms of Service for Preme Home Loans — usage terms, SMS program terms, and legal agreements.",
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation Bar */}
      <nav className="border-b border-gray-800">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <span className="text-2xl font-bold tracking-wide">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
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
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
            <p className="text-gray-400 mb-12">Last updated: March 23, 2026</p>

            <div className="prose prose-invert prose-lg max-w-none space-y-10">
              {/* Introduction */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Introduction</h2>
                <p className="text-gray-300 leading-relaxed">
                  Welcome to Preme Home Loans (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). These Terms of Service (&quot;Terms&quot;) govern your access to and use of our website at premerealestate.com and all related services, including our SMS messaging program. By accessing or using our website or services, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our website or services.
                </p>
              </section>

              {/* Eligibility */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Eligibility</h2>
                <p className="text-gray-300 leading-relaxed">
                  You must be at least 18 years of age and a resident of the United States to use our services. By using our website or services, you represent and warrant that you meet these eligibility requirements. If you are using our services on behalf of a business or entity, you represent that you have the authority to bind that entity to these Terms.
                </p>
              </section>

              {/* SMS Program Terms */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">SMS Program Terms</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Preme Home Loans offers an SMS messaging program (&quot;Preme Home Loans SMS Communications&quot;) to provide you with service updates, loan application status notifications, appointment reminders, and follow-up communications related to your inquiry or loan application.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Message frequency varies. You may receive up to 5 messages per inquiry. The number of messages you receive depends on the nature of your interaction with us and the status of your loan application.
                </p>
                <p className="text-white font-bold text-lg mb-4">
                  MESSAGE AND DATA RATES MAY APPLY
                </p>
                <p className="text-gray-300 leading-relaxed">
                  Our SMS program is compatible with all major US carriers, including but not limited to AT&amp;T, T-Mobile, Verizon, Sprint, Boost Mobile, Cricket, MetroPCS, U.S. Cellular, and other supported carriers. Carriers are not liable for delayed or undelivered messages. We are not responsible for transmission failures caused by carrier networks, device incompatibility, or other factors outside our control.
                </p>
              </section>

              {/* Opt-In & Consent */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Opt-In &amp; Consent</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  You opt in to our SMS program by submitting a form on our website with your phone number and checking the consent checkbox, or by otherwise providing your express written consent to receive text messages from Preme Home Loans. By opting in, you confirm that you agree to receive SMS messages from Preme Home Loans at the phone number you provided.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong className="text-white">Consent is not a condition of purchase.</strong> You are not required to opt in to SMS messaging in order to purchase any goods, services, or property from Preme Home Loans. You may choose to receive communications by other means, such as phone or email.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  By opting in, you also confirm that the phone number you provided is your own and that you are authorized to receive text messages at that number. You agree to notify us promptly if you change your phone number.
                </p>
              </section>

              {/* Opt-Out Instructions */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Opt-Out Instructions</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  You may opt out of receiving SMS messages from us at any time. To opt out:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Reply STOP</strong> to any text message you receive from us to unsubscribe immediately</li>
                  <li><strong className="text-white">Reply HELP</strong> to any text message for support information</li>
                  <li><strong className="text-white">Call us</strong> at <a href="tel:+14709425787" className="text-[#997100] hover:underline">(470) 942-5787</a></li>
                  <li><strong className="text-white">Email us</strong> at <a href="mailto:loans@premerealestate.com" className="text-[#997100] hover:underline">loans@premerealestate.com</a></li>
                </ul>
                <p className="text-gray-300 leading-relaxed mt-4">
                  We honor all standard opt-out keywords, including: STOP, stop, Stop, CANCEL, END, UNSUBSCRIBE, and QUIT. After you send an opt-out keyword, you will receive a final confirmation message and no further SMS messages will be sent unless you re-opt in.
                </p>
              </section>

              {/* Message Examples */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Message Examples</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Below are examples of the types of SMS messages you may receive from us:
                </p>
                <div className="bg-gray-900 rounded-lg p-6 space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Follow-up message:</p>
                    <p className="text-gray-300 italic">
                      &quot;Hi [Name], this is Riley from Preme Home Loans following up on your DSCR loan inquiry. Do you have a moment to discuss your financing needs?&quot;
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Status update:</p>
                    <p className="text-gray-300 italic">
                      &quot;Your loan application status has been updated. Log in to view details or reply to this message.&quot;
                    </p>
                  </div>
                </div>
              </section>

              {/* Carrier Liability */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Carrier Liability</h2>
                <p className="text-gray-300 leading-relaxed">
                  Carriers are not liable for delayed or undelivered messages. We are not responsible for transmission failures, including but not limited to failures caused by carrier network issues, device incompatibility, changes in your phone number or service, or other conditions outside our control. T-Mobile is not liable for delayed or undelivered messages.
                </p>
              </section>

              {/* Privacy & Data */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Privacy &amp; Data</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Your privacy is important to us. No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All text messaging originator opt-in data and consent will not be shared with any third parties.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  We collect and use your phone number and messaging data solely for the purposes described in these Terms and our{" "}
                  <Link href="/privacy" className="text-[#997100] hover:underline">Privacy Policy</Link>.
                  We retain your SMS opt-in data for as long as you remain subscribed to our messaging program. You may request deletion of your data at any time by contacting us.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  For full details on how we collect, use, and protect your personal information, please review our{" "}
                  <Link href="/privacy" className="text-[#997100] hover:underline">Privacy Policy</Link>.
                </p>
              </section>

              {/* Use of Website */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Use of Website &amp; Services</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  You agree to use our website and services only for lawful purposes and in accordance with these Terms. You agree not to:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li>Use our website in any way that violates applicable federal, state, local, or international law</li>
                  <li>Submit false, inaccurate, or misleading information on any form</li>
                  <li>Attempt to gain unauthorized access to our systems, servers, or networks</li>
                  <li>Interfere with or disrupt the operation of our website or services</li>
                  <li>Use automated tools, bots, or scrapers to access our website without our written permission</li>
                  <li>Impersonate or attempt to impersonate Preme Home Loans, a Preme employee, or another user</li>
                </ul>
              </section>

              {/* Intellectual Property */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Intellectual Property</h2>
                <p className="text-gray-300 leading-relaxed">
                  All content on our website, including text, graphics, logos, images, software, and the compilation thereof, is the property of Preme Home Loans or its licensors and is protected by United States and international copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any content on our website without our prior written consent, except as incidental to normal web browsing.
                </p>
              </section>

              {/* Limitation of Liability */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Limitation of Liability</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  To the fullest extent permitted by applicable law, Preme Home Loans, its officers, directors, employees, agents, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other intangible losses, arising out of or in connection with:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li>Your access to or use of (or inability to access or use) our website or services</li>
                  <li>Any conduct or content of any third party on our website</li>
                  <li>Any content obtained from our website</li>
                  <li>Unauthorized access, use, or alteration of your transmissions or content</li>
                  <li>Delayed or undelivered SMS messages</li>
                </ul>
                <p className="text-gray-300 leading-relaxed mt-4">
                  Our total liability for any claims arising under these Terms shall not exceed the total amount you have paid to us in the twelve (12) months preceding the claim, or $100, whichever is greater.
                </p>
              </section>

              {/* Disclaimer of Warranties */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Disclaimer of Warranties</h2>
                <p className="text-gray-300 leading-relaxed">
                  Our website and services are provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind, either express or implied. We disclaim all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that our website will be uninterrupted, error-free, or free of viruses or other harmful components.
                </p>
              </section>

              {/* Indemnification */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Indemnification</h2>
                <p className="text-gray-300 leading-relaxed">
                  You agree to defend, indemnify, and hold harmless Preme Home Loans, its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising from your use of our website or services, your violation of these Terms, or your violation of any rights of a third party.
                </p>
              </section>

              {/* Governing Law */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Governing Law</h2>
                <p className="text-gray-300 leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the State of Georgia, without regard to its conflict of law provisions. Any legal suit, action, or proceeding arising out of or related to these Terms or our website shall be instituted exclusively in the state or federal courts located in Fulton County, Georgia. You waive any and all objections to the exercise of jurisdiction over you by such courts and to venue in such courts.
                </p>
              </section>

              {/* Modifications */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Modifications to Terms</h2>
                <p className="text-gray-300 leading-relaxed">
                  We reserve the right to modify these Terms at any time at our sole discretion. If we make material changes, we will update the &quot;Last updated&quot; date at the top of this page. Your continued use of our website or services after any changes constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.
                </p>
              </section>

              {/* Severability */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Severability</h2>
                <p className="text-gray-300 leading-relaxed">
                  If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect. The invalid or unenforceable provision shall be modified to the minimum extent necessary to make it valid and enforceable while preserving the original intent of the parties.
                </p>
              </section>

              {/* Entire Agreement */}
              <section>
                <h2 className="text-2xl font-bold text-white mb-4">Entire Agreement</h2>
                <p className="text-gray-300 leading-relaxed">
                  These Terms, together with our <Link href="/privacy" className="text-[#997100] hover:underline">Privacy Policy</Link>, constitute the entire agreement between you and Preme Home Loans regarding your use of our website and services, and supersede all prior and contemporaneous understandings, agreements, representations, and warranties.
                </p>
              </section>

              {/* Contact */}
              <section className="border-t border-gray-800 pt-10">
                <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  If you have questions about these Terms of Service, our SMS program, or need assistance, please contact us:
                </p>
                <div className="bg-gray-900 rounded-lg p-6 space-y-3">
                  <p className="text-gray-300"><strong className="text-white">Preme Home Loans</strong></p>
                  <p className="text-gray-300">Atlanta, GA</p>
                  <p className="text-gray-300">
                    Phone: <a href="tel:+14709425787" className="text-[#997100] hover:underline">(470) 942-5787</a>
                  </p>
                  <p className="text-gray-300">
                    Email: <a href="mailto:loans@premerealestate.com" className="text-[#997100] hover:underline">loans@premerealestate.com</a>
                  </p>
                  <p className="text-gray-300">Hours: Monday&ndash;Friday, 8AM&ndash;8PM EST</p>
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
                <span className="text-xl font-bold tracking-wide">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
              </div>
            </div>
            <div className="flex space-x-8 text-gray-400">
              <Link href="/privacy" className="hover:text-[#997100] transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-[#997100] transition-colors">
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
