"use client"

import { useState, useEffect } from "react"
import { EntryChoiceModal } from "@/components/entry-choice-modal"
import { useRouter, useSearchParams } from "next/navigation"

export default function StartPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextUrl = searchParams.get("next") || "/apply"

  useEffect(() => {
    // Open modal immediately when page loads
    setIsModalOpen(true)
  }, [])

  const handleModalClose = () => {
    setIsModalOpen(false)
    // Redirect to home if modal is closed without selection
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="relative mb-8">
          <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
          <span className="text-4xl font-bold tracking-wide text-gray-900">PREME</span>
        </div>
        <p className="text-lg text-gray-600">Loading application options...</p>
      </div>

      <EntryChoiceModal isOpen={isModalOpen} onClose={handleModalClose} nextUrl={nextUrl} />
    </div>
  )
}
