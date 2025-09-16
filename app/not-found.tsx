import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Home, FileText, LogIn } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">Page not found</CardTitle>
          <CardDescription>The page you're looking for doesn't exist or has been moved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full" variant="default">
            <Link href="/dashboard" className="flex items-center justify-center gap-2">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>

          <Button asChild className="w-full bg-transparent" variant="outline">
            <Link href="/start?next=/apply" className="flex items-center justify-center gap-2">
              <FileText className="h-4 w-4" />
              Start an Application
            </Link>
          </Button>

          <Button asChild className="w-full bg-transparent" variant="outline">
            <Link href="/auth" className="flex items-center justify-center gap-2">
              <LogIn className="h-4 w-4" />
              Go to Auth
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
