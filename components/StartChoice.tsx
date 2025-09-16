"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { User, UserPlus } from "lucide-react"
import Link from "next/link"

interface StartChoiceProps {
  isOpen: boolean
  onClose: () => void
  nextUrl?: string
}

export function StartChoice({ isOpen, onClose, nextUrl = "/apply" }: StartChoiceProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-foreground">
            How would you like to proceed?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-6">
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
            className="w-full h-16 border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-white font-semibold text-lg bg-transparent"
          >
            <Link href={`/auth?next=${nextUrl}`} onClick={onClose}>
              <UserPlus className="mr-3 h-6 w-6" />
              Sign up / Log in
            </Link>
          </Button>

          <p className="text-sm text-muted-foreground text-center mt-4">
            Create an account to save progress and manage documents later.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
