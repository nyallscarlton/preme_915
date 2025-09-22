import Link from "next/link"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-black">
      <nav className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-2xl font-bold tracking-wide">PREME</span>
              </div>
            </Link>
          </div>
        </div>
      </nav>

      <section className="py-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>
          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              We respect your privacy. This page outlines how PREME collects, uses, and protects your information.
            </p>
            <p>
              We collect only the data necessary to process your applications and provide services. We never sell your
              data.
            </p>
            <p>For questions, contact: funding@preme.com</p>
          </div>
        </div>
      </section>
    </div>
  )
}



