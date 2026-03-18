"use client"

import { useState, useEffect } from "react"
import { StartChoice } from "@/components/StartChoice"
import { useRouter, useSearchParams } from "next/navigation"

export default function StartPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextUrl = searchParams.get("next") || "/apply"

  useEffect(() => {
    setIsModalOpen(true)
  }, [])

  const handleModalClose = () => {
    setIsModalOpen(false)
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="relative mb-8">
          <span className="text-4xl font-bold tracking-wide text-gray-900">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
        </div>
        <p className="text-lg text-gray-600">Loading application options...</p>
      </div>

      <StartChoice isOpen={isModalOpen} onClose={handleModalClose} nextUrl={nextUrl} />
    </div>
  )
}
