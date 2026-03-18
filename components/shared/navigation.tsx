import { Button } from "@/components/ui/button"
import Link from "next/link"

interface NavigationProps {
  currentPage?: string
}

export function Navigation({ currentPage }: NavigationProps) {
  const navItems = [
    { href: "/", label: "Home" },
    { href: "/loan-programs", label: "Loan Programs" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/about", label: "About" },
    { href: "/blog", label: "Resources" },
    { href: "/calculator", label: "Calculator" },
    { href: "/contact", label: "Contact" },
  ]

  return (
    <nav className="border-b border-gray-200">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <div className="relative">
              <span className="text-2xl font-bold tracking-wide text-gray-900">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`font-medium transition-colors ${
                  currentPage === item.href ? "text-[#997100]" : "text-gray-900 hover:text-[#997100]"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/auth" className="font-medium text-gray-900 hover:text-[#997100] transition-colors">
              Log in
            </Link>
            <Button asChild className="bg-[#997100] hover:bg-[#b8850a] text-white font-semibold px-6">
              <Link href="/start?next=/apply">Start Application</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
