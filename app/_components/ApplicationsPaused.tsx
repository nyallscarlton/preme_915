import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Phone, Mail } from "lucide-react"

export default function ApplicationsPaused() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <Link href="/">
            <span className="text-3xl font-bold tracking-wide text-gray-900">
              PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-lg mx-auto px-6 text-center">
          <div className="w-16 h-16 bg-[#997100]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-8 h-8 rounded-full bg-[#997100]" />
          </div>

          <h1 className="text-3xl font-bold mb-4">Online Applications Temporarily Unavailable</h1>
          <p className="text-lg text-gray-600 mb-10 leading-relaxed">
            We're making improvements to our application system. Our team is ready to
            start your file right now — just reach out directly.
          </p>

          <div className="space-y-4 mb-10">
            <a
              href="tel:+14709425787"
              className="flex items-center justify-center gap-3 w-full bg-[#997100] hover:bg-[#b8850a] text-white font-semibold py-4 px-6 rounded-lg transition-colors"
            >
              <Phone className="h-5 w-5" />
              Call (470) 942-5787
            </a>

            <a
              href="mailto:loans@premerealestate.com"
              className="flex items-center justify-center gap-3 w-full border border-gray-300 hover:border-[#997100] hover:text-[#997100] text-gray-700 font-semibold py-4 px-6 rounded-lg transition-colors"
            >
              <Mail className="h-5 w-5" />
              loans@premerealestate.com
            </a>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <Button variant="ghost" asChild className="text-gray-500 hover:text-gray-900">
              <Link href="/contact">Send a message instead</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
