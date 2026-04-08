"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Globe, Users, FileText, ExternalLink } from "lucide-react"

interface Props {
  verticals: any[]
  buyers: any[]
  landingPages: any[]
}

export function SettingsManager({ verticals, buyers, landingPages }: Props) {
  return (
    <Tabs defaultValue="verticals">
      <TabsList>
        <TabsTrigger value="verticals">Verticals</TabsTrigger>
        <TabsTrigger value="buyers">Buyers</TabsTrigger>
        <TabsTrigger value="pages">Landing Pages</TabsTrigger>
      </TabsList>

      <TabsContent value="verticals" className="space-y-4">
        {verticals.map((v) => (
          <Card key={v.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-sm text-gray-500">/{v.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {v.retell_agent_id && (
                  <Badge variant="outline" className="text-xs">Retell configured</Badge>
                )}
                <Badge variant={v.active ? "default" : "secondary"}>
                  {v.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {verticals.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No verticals configured</p>
        )}
      </TabsContent>

      <TabsContent value="buyers" className="space-y-4">
        {buyers.map((b) => (
          <Card key={b.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-sm text-gray-500">
                    {b.zx_verticals?.name} &mdash; {b.pricing_model === "per_lead"
                      ? `$${b.price_per_lead}/lead`
                      : `${b.rev_share_pct}% rev share`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 max-w-[200px] truncate">{b.webhook_url}</span>
                <Badge variant={b.active ? "default" : "secondary"}>
                  {b.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {buyers.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No buyers configured</p>
        )}
      </TabsContent>

      <TabsContent value="pages" className="space-y-4">
        {landingPages.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium">{p.headline}</p>
                  <p className="text-sm text-gray-500">
                    /p/{p.slug} &mdash; {p.zx_verticals?.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`/p/${p.slug}`}
                  target="_blank"
                  className="text-gray-400 hover:text-blue-600"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <Badge variant={p.active ? "default" : "secondary"}>
                  {p.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {landingPages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No landing pages configured</p>
        )}
      </TabsContent>
    </Tabs>
  )
}
