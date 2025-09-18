"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browserClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Link from "next/link"

export default function AccountSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        // Force a real check against auth API
        let { data: userRes, error: uErr } = await supabaseBrowser.auth.getUser()
        if (uErr) {
          // Try refreshing session then re-check
          await supabaseBrowser.auth.refreshSession()
          const retry = await supabaseBrowser.auth.getUser()
          userRes = retry.data
        }
        const user = userRes?.user
        if (!user) {
          // Stay on page; show sign-in prompt instead of redirect loop
          setLoading(false)
          return
        }
        setEmail(user.email || "")

        // Load profile from public profiles table if exists
        const { data: prof, error: pErr } = await supabaseBrowser
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle()
        if (!pErr && prof) {
          setFullName(prof.full_name || "")
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load account")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const { data: s, error: sErr } = await supabaseBrowser.auth.getSession()
      if (sErr) throw sErr
      const user = s.session?.user
      if (!user) throw new Error("Not signed in")

      // Upsert profile
      const { error: upErr } = await supabaseBrowser.from("profiles").upsert(
        {
          id: user.id, // keep id stable if schema uses id as pk
          user_id: user.id,
          email: email,
          full_name: fullName,
        },
        { onConflict: "id" },
      )
      if (upErr) throw upErr

      setSuccess("Saved")
    } catch (e: any) {
      setError(e?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <div className="relative">
              <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
              <span className="text-2xl font-bold tracking-wide text-gray-900">PREME</span>
            </div>
          </Link>
          <div className="text-sm">
            <Link href="/dashboard" className="text-[#997100] hover:text-[#b8850a] underline">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Card className="max-w-xl mx-auto bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Account Settings</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-gray-600">Loading...</div>
            ) : !email ? (
              <div className="space-y-4">
                {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}
                <p className="text-gray-700">You're not signed in.</p>
                <Button asChild className="bg-[#997100] hover:bg-[#b8850a] text-white">
                  <Link href="/auth?next=/account">Sign in to manage your account</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}
                {success && <div className="text-sm text-green-700 bg-green-50 p-3 rounded-md">{success}</div>}

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Email</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Full Name</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} type="text" />
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={saving} className="bg-[#997100] hover:bg-[#b8850a] text-white">
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}


