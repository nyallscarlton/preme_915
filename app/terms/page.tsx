import Link from "next/link"

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold mb-6">Terms of Service</h1>
          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>By using PREME, you agree to the following terms and conditions.</p>
            <p>All loans are subject to underwriting and approval. Not a commitment to lend.</p>
            <p>For questions, contact: funding@preme.com</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function TermsPage() {
  return (
    <main className="container mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
      <p className="text-muted-foreground">Our terms of service will be available here.</p>
    </main>
  )
}


