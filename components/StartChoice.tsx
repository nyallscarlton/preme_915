"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { User, UserPlus } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browserClient"

interface StartChoiceProps {
  isOpen: boolean
  onClose: () => void
  nextUrl?: string
}

export function StartChoice({ isOpen, onClose, nextUrl = "/apply" }: StartChoiceProps) {
  const [hasSession, setHasSession] = useState<boolean>(false)

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const { data } = await supabaseBrowser.auth.getSession()
        if (!mounted) return
        setHasSession(Boolean(data.session?.user?.email_confirmed_at))
      } catch {
        setHasSession(false)
      }
    }
    check()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-gray-900">
            How would you like to proceed?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-6">
          {hasSession && (
            <Button
              asChild
              size="lg"
              className="w-full h-16 bg-[#0f766e] hover:bg-[#115e59] text-white font-semibold text-lg"
            >
              <Link href="/dashboard" onClick={onClose}>
                Go to Dashboard
              </Link>
            </Button>
          )}
          <Button
            asChild
            size="lg"
            className="w-full h-16 bg-[#997100] hover:bg-[#b8850a] text-white font-semibold text-lg"
          >
            <Link href={`${nextUrl}?guest=1`} onClick={onClose}>
              <User className="mr-3 h-6 w-6" />
              Continue as Guest
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full h-16 border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-white font-semibold text-lg bg-white"
          >
            <Link href={`/auth?next=${nextUrl}`} onClick={onClose}>
              <UserPlus className="mr-3 h-6 w-6" />
              Sign up to Apply
            </Link>
          </Button>

          <p className="text-sm text-gray-600 text-center mt-4">
            Create an account to save progress and manage documents later.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
