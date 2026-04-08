"use client"

import { useEffect, useState } from "react"
import { Shield, AlertTriangle, Phone, Activity } from "lucide-react"

interface PhoneHealth {
  number: string
  nickname: string
  role: string
  poolStatus: string
  callsToday: number
  callsWeek: number
  answerRate: number
  voicemailRate: number
  noAnswerRate: number
  healthScore: number
  status: "healthy" | "warning" | "danger" | "critical"
  alerts: string[]
  contactRate: number | null
  vmRate: number | null
  dbHealthStatus: string | null
}

const POOL_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  warming: "bg-yellow-100 text-yellow-700",
  catch: "bg-orange-100 text-orange-700",
  burned: "bg-red-100 text-red-700",
}

const ROLE_LABELS: Record<string, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
  both: "In/Out",
}

const STATUS_CONFIG = {
  healthy: { bg: "bg-green-50 border-green-200", text: "text-green-700", badge: "bg-green-100 text-green-800", icon: "text-green-500", label: "Healthy" },
  warning: { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-800", icon: "text-yellow-500", label: "Warning" },
  danger: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", badge: "bg-orange-100 text-orange-800", icon: "text-orange-500", label: "At Risk" },
  critical: { bg: "bg-red-50 border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-800", icon: "text-red-500", label: "Spam Risk" },
}

export function PhoneHealthPanel() {
  const [phones, setPhones] = useState<PhoneHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/pipeline/phone-health")
      .then(r => r.json())
      .then(data => {
        setPhones(data.phones || [])
        setLoading(false)
      })
      .catch(err => {
        setError("Failed to load phone health")
        setLoading(false)
      })
  }, [])

  const worstStatus = phones.reduce((worst, p) => {
    const order = { critical: 0, danger: 1, warning: 2, healthy: 3 }
    return order[p.status] < order[worst] ? p.status : worst
  }, "healthy" as PhoneHealth["status"])

  const headerConfig = STATUS_CONFIG[worstStatus]

  return (
    <div className={`rounded-xl border-2 ${phones.length > 0 && worstStatus !== "healthy" ? headerConfig.bg : "bg-white border-gray-200"} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {worstStatus === "critical" || worstStatus === "danger" ? (
            <AlertTriangle className={`h-5 w-5 ${headerConfig.icon}`} />
          ) : (
            <Shield className={`h-5 w-5 ${headerConfig.icon || "text-gray-500"}`} />
          )}
          <h3 className="text-base font-semibold">Preme Phone Health</h3>
          {!loading && phones.length > 0 && worstStatus !== "healthy" && (
            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${headerConfig.badge}`}>
              {headerConfig.label}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">Auto-refreshes on page load</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <Activity className="h-4 w-4 animate-pulse" /> Checking phone health...
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && phones.length === 0 && !error && (
        <p className="text-sm text-gray-400">No active Preme Home Loans numbers in number pool</p>
      )}

      {!loading && phones.length > 0 && (
        <div className="space-y-3">
          {phones.map((p) => {
            const config = STATUS_CONFIG[p.status]
            return (
              <div key={p.number} className={`rounded-lg border p-4 ${config.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Phone className={`h-4 w-4 ${config.icon}`} />
                    <div>
                      <span className="font-medium text-sm">{p.nickname}</span>
                      <span className="text-xs text-gray-500 ml-2">{p.number}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.role && (
                          <span className="text-[10px] rounded px-1.5 py-0.5 bg-gray-100 text-gray-600 font-medium">
                            {ROLE_LABELS[p.role] || p.role}
                          </span>
                        )}
                        {p.poolStatus && (
                          <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${POOL_STATUS_COLORS[p.poolStatus] || "bg-gray-100 text-gray-600"}`}>
                            {p.poolStatus}
                          </span>
                        )}
                        {p.dbHealthStatus && p.dbHealthStatus !== "healthy" && (
                          <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${
                            p.dbHealthStatus === "burned" ? "bg-red-100 text-red-700" :
                            p.dbHealthStatus === "warning" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {p.dbHealthStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-bold">{p.healthScore}</div>
                      <div className="text-xs text-gray-500">/ 100</div>
                    </div>
                    <div className={`h-10 w-2 rounded-full ${
                      p.healthScore >= 75 ? "bg-green-400" :
                      p.healthScore >= 50 ? "bg-yellow-400" :
                      p.healthScore >= 30 ? "bg-orange-400" : "bg-red-500"
                    }`} />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-xs mb-2">
                  <div>
                    <span className="text-gray-500">Today</span>
                    <p className={`font-semibold ${p.callsToday > 80 ? "text-red-600" : ""}`}>{p.callsToday} calls</p>
                  </div>
                  <div>
                    <span className="text-gray-500">This Week</span>
                    <p className="font-semibold">{p.callsWeek} calls</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Answer Rate</span>
                    <p className={`font-semibold ${p.answerRate < 15 ? "text-red-600" : p.answerRate < 30 ? "text-yellow-600" : "text-green-600"}`}>
                      {p.answerRate}%
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Voicemail</span>
                    <p className={`font-semibold ${p.voicemailRate > 70 ? "text-orange-600" : ""}`}>{p.voicemailRate}%</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Contact Rate</span>
                    <p className={`font-semibold ${
                      p.contactRate === null ? "text-gray-400" :
                      p.contactRate < 15 ? "text-red-600" :
                      p.contactRate < 30 ? "text-yellow-600" : "text-green-600"
                    }`}>
                      {p.contactRate !== null ? `${p.contactRate}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">VM Rate</span>
                    <p className={`font-semibold ${
                      p.vmRate === null ? "text-gray-400" :
                      p.vmRate > 70 ? "text-orange-600" : ""
                    }`}>
                      {p.vmRate !== null ? `${p.vmRate}%` : "—"}
                    </p>
                  </div>
                </div>

                {/* Alerts */}
                {p.alerts.length > 0 && p.alerts[0] !== "All clear" && (
                  <div className="space-y-1">
                    {p.alerts.map((a, i) => (
                      <p key={i} className={`text-xs ${config.text}`}>
                        {a.startsWith("Critical") ? "🚨" : a === "All clear" ? "✓" : "⚠"} {a}
                      </p>
                    ))}
                  </div>
                )}
                {p.alerts[0] === "All clear" && (
                  <p className="text-xs text-green-600">All clear</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
