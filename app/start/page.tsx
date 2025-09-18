"use client"

import { useState, useEffect } from "react"
import { StartChoice } from "@/components/StartChoice"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browserClient"

export default function StartPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextUrl = searchParams.get("next") || "/apply"

  useEffect(() => {
    setIsModalOpen(true)
  }, [])

  useEffect(() => {
    let mounted = true
    (async () => {
      try {
        const { data } = await supabaseBrowser.auth.getSession()
        if (!mounted) return
        setHasSession(Boolean(data.session?.user?.email_confirmed_at))
      } catch {
        setHasSession(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleModalClose = () => {
    setIsModalOpen(false)
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="absolute top-4 right-4">
        {hasSession && (
          <a className="text-sm text-[#997100] hover:text-[#b8850a] underline" href="/dashboard">Go to Dashboard</a>
        )}
      </div>
      <div className="text-center">
        <div className="relative mb-8">
          <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
          <span className="text-4xl font-bold tracking-wide text-gray-900">PREME</span>
        </div>
        <p className="text-lg text-gray-600">Loading application options...</p>
      </div>

      <StartChoice isOpen={isModalOpen} onClose={handleModalClose} nextUrl={nextUrl} />
    </div>
  )
}
