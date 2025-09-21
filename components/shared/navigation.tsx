import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AdminLink } from "@/components/shared/AdminLink"

interface NavigationProps {
  currentPage?: string
}

export function Navigation({ currentPage }: NavigationProps) {
  const navItems = [
    { href: "/", label: "Home" },
    { href: "/loan-programs", label: "Loan Programs" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ]

  return (
    <nav className="border-b border-border bg-background">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <div className="relative">
              <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
              <span className="text-2xl font-bold tracking-wide text-foreground">PREME</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`font-medium transition-colors ${
                  currentPage === item.href ? "text-[#997100]" : "text-foreground hover:text-[#997100]"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/account" className="font-medium text-foreground hover:text-[#997100] transition-colors">
              Account Settings
            </Link>
            <AdminLink />
            <Button asChild className="bg-[#997100] hover:bg-[#b8850a] text-white font-semibold px-6">
              <Link href="/start?next=/apply">Start Application</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
