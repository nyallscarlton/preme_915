import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function RouteCard() {
  const routes = [
    {
      path: "/start?next=/apply",
      label: "Start Application Flow",
      description: "Opens choice modal, then redirects to apply",
    },
    {
      path: "/apply",
      label: "Direct Apply Page",
      description: "Direct access to application form",
    },
    {
      path: "/auth",
      label: "Authentication Page",
      description: "Login/signup page",
    },
    {
      path: "/dashboard",
      label: "User Dashboard",
      description: "Main user dashboard",
    },
  ]

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Route Debug Helper</CardTitle>
        <CardDescription>Quick links to test navigation flows</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {routes.map((route) => (
          <div key={route.path} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="font-medium">{route.label}</div>
              <div className="text-sm text-muted-foreground">{route.description}</div>
              <div className="text-xs font-mono text-blue-600 mt-1">{route.path}</div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={route.path}>Visit</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
