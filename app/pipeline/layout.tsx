import Link from "next/link"
import { BarChart3, Users, Zap, Settings, Home, Kanban, CheckSquare, Phone, Headphones, ListOrdered } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/pipeline" className="text-lg font-bold tracking-tight">
              Preme Admin
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/pipeline" icon={<Home className="h-4 w-4" />} label="Overview" />
              <NavLink href="/pipeline/leads" icon={<Users className="h-4 w-4" />} label="Leads" />
              <NavLink href="/pipeline/calls" icon={<Phone className="h-4 w-4" />} label="Calls" />
              <NavLink href="/pipeline/voice-lab" icon={<Headphones className="h-4 w-4" />} label="Voice Lab" />
              <NavLink href="/pipeline/pipeline" icon={<Kanban className="h-4 w-4" />} label="Pipeline" />
              <NavLink href="/pipeline/tasks" icon={<CheckSquare className="h-4 w-4" />} label="Tasks" />
              <NavLink href="/pipeline/sequences" icon={<ListOrdered className="h-4 w-4" />} label="Sequences" />
              <NavLink href="/pipeline/analytics" icon={<BarChart3 className="h-4 w-4" />} label="Analytics" />
              <NavLink href="/pipeline/settings" icon={<Settings className="h-4 w-4" />} label="Settings" />
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Zap className="h-4 w-4 text-yellow-500" />
            Lead Engine
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
    >
      {icon}
      {label}
    </Link>
  )
}
