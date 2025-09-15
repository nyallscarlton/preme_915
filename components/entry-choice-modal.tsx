"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserPlus, FileText, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

interface EntryChoiceModalProps {
  isOpen: boolean
  onClose: () => void
  nextUrl?: string
}

export function EntryChoiceModal({ isOpen, onClose, nextUrl = "/apply" }: EntryChoiceModalProps) {
  const router = useRouter()

  const handleGuestChoice = () => {
    onClose()
    router.push(`${nextUrl}?guest=1`)
  }

  const handleAuthChoice = () => {
    onClose()
    router.push(`/auth?next=${encodeURIComponent(nextUrl)}`)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 bg-white">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-3xl font-bold text-center text-gray-900">Choose How to Get Started</DialogTitle>
          <DialogDescription className="text-center text-lg text-gray-600">
            Create an account to save progress and manage documents later.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-0">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Continue as Guest */}
            <Card
              className="border-2 hover:border-gray-300 transition-colors cursor-pointer"
              onClick={handleGuestChoice}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-gray-600" />
                </div>
                <CardTitle className="text-xl">Continue as Guest</CardTitle>
                <CardDescription>
                  Start your application immediately without creating an account. Quick and easy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>No account required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Start application immediately</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Email link to track progress</span>
                  </div>
                </div>
                <Button className="w-full bg-[#997100] hover:bg-[#b8850a] text-white">
                  Continue as Guest
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Sign up / Log in */}
            <Card
              className="border-2 hover:border-gray-300 transition-colors cursor-pointer"
              onClick={handleAuthChoice}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <UserPlus className="w-8 h-8 text-gray-600" />
                </div>
                <CardTitle className="text-xl">Sign up / Log in</CardTitle>
                <CardDescription>
                  Create a secure account to save progress, track applications, and access your dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Save progress automatically</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Access personal dashboard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Manage multiple applications</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-white bg-transparent"
                >
                  Sign up / Log in
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center text-sm text-gray-500 mt-6">
            <p>Secure • Fast • Professional Loan Processing</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
