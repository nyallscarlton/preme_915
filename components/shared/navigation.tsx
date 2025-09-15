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
    { href: "/contact", label: "Contact" },
    { href: "/login", label: "Login" },
  ]

  return (
    <nav className="border-b border-border">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <div className="relative">
              <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-primary"></div>
              <span className="text-2xl font-bold tracking-wide text-foreground">PREME</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`font-medium transition-colors ${
                  currentPage === item.href ? "text-primary" : "text-foreground hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6">
              Start Application
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
