import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SettingsManager } from "@/components/pipeline/settings-manager"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "zentryx" } }
)

export default async function SettingsPage() {
  const [verticals, buyers, pages] = await Promise.all([
    supabase.from("zx_verticals").select("*").order("created_at"),
    supabase.from("zx_buyers").select("*, zx_verticals(name)").order("created_at"),
    supabase.from("zx_landing_pages").select("*, zx_verticals(name)").order("created_at"),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500">Manage verticals, buyers, and landing pages</p>
      </div>

      <SettingsManager
        verticals={verticals.data || []}
        buyers={buyers.data || []}
        landingPages={pages.data || []}
      />
    </div>
  )
}
