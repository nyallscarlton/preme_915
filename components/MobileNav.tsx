"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import Link from "next/link"

interface MobileNavProps {
  currentPage?: string
}

export function MobileNav({ currentPage }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  const closeMenu = () => {
    setIsOpen(false)
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggleMenu}
        className="md:hidden p-2 rounded-md text-foreground hover:bg-gray-100 transition-colors"
        aria-label="Toggle mobile menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={closeMenu} />
          <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center">
                  <div className="relative">
                    <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                    <span className="text-2xl font-bold tracking-wide text-black">PREME</span>
                  </div>
                </div>
                <button
                  onClick={closeMenu}
                  className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Close mobile menu"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 px-6 py-8">
                <div className="space-y-6">
                  <Link
                    href="/"
                    className={`block text-lg font-medium transition-colors ${
                      currentPage === "home" ? "text-[#997100]" : "text-gray-700 hover:text-[#997100]"
                    }`}
                    onClick={closeMenu}
                  >
                    Home
                  </Link>
                  <Link
                    href="/loan-programs"
                    className={`block text-lg font-medium transition-colors ${
                      currentPage === "loan-programs" ? "text-[#997100]" : "text-gray-700 hover:text-[#997100]"
                    }`}
                    onClick={closeMenu}
                  >
                    Loan Programs
                  </Link>
                  <Link
                    href="/how-it-works"
                    className={`block text-lg font-medium transition-colors ${
                      currentPage === "how-it-works" ? "text-[#997100]" : "text-gray-700 hover:text-[#997100]"
                    }`}
                    onClick={closeMenu}
                  >
                    How It Works
                  </Link>
                  <Link
                    href="/about"
                    className={`block text-lg font-medium transition-colors ${
                      currentPage === "about" ? "text-[#997100]" : "text-gray-700 hover:text-[#997100]"
                    }`}
                    onClick={closeMenu}
                  >
                    About
                  </Link>
                  <Link
                    href="/contact"
                    className={`block text-lg font-medium transition-colors ${
                      currentPage === "contact" ? "text-[#997100]" : "text-gray-700 hover:text-[#997100]"
                    }`}
                    onClick={closeMenu}
                  >
                    Contact
                  </Link>
                  <Link
                    href="/auth"
                    className={`block text-lg font-medium transition-colors ${
                      currentPage === "auth" ? "text-[#997100]" : "text-gray-700 hover:text-[#997100]"
                    }`}
                    onClick={closeMenu}
                  >
                    Login
                  </Link>
                </div>

                {/* CTA Button */}
                <div className="mt-8 pt-6 border-t">
                  <Button
                    className="w-full bg-[#997100] hover:bg-[#b8850a] text-black font-semibold py-3"
                    asChild
                  >
                    <Link href="/start?next=/apply" onClick={closeMenu}>
                      Start Application
                    </Link>
                  </Button>
                </div>
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
