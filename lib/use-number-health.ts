"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface NumberHealthEntry {
  phone_number: string
  status: "healthy" | "warning" | "burned"
  contact_rate: number | null
  voicemail_rate: number | null
  pool_status: string | null
  entity_name: string | null
}

type HealthMap = Record<string, NumberHealthEntry>

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Module-level cache so all components share the same data
let cachedData: HealthMap | null = null
let cacheTimestamp = 0
let fetchPromise: Promise<HealthMap> | null = null

async function fetchHealthMap(): Promise<HealthMap> {
  const res = await fetch("/api/admin/number-health-map")
  if (!res.ok) return {}
  const json = await res.json()
  return json.numbers || {}
}

/**
 * Hook that provides phone number health data, cached for 5 minutes.
 * All instances share the same module-level cache so only one fetch is made.
 */
export function useNumberHealth() {
  const [healthMap, setHealthMap] = useState<HealthMap>(cachedData || {})
  const [loading, setLoading] = useState(!cachedData)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    const now = Date.now()
    if (cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
      setHealthMap(cachedData)
      setLoading(false)
      return
    }

    // Deduplicate concurrent fetches
    if (!fetchPromise) {
      fetchPromise = fetchHealthMap().then((data) => {
        cachedData = data
        cacheTimestamp = Date.now()
        fetchPromise = null
        return data
      }).catch(() => {
        fetchPromise = null
        return {} as HealthMap
      })
    }

    fetchPromise.then((data) => {
      if (mounted.current) {
        setHealthMap(data)
        setLoading(false)
      }
    })
  }, [])

  const getHealth = useCallback(
    (phoneNumber: string | null | undefined): NumberHealthEntry | null => {
      if (!phoneNumber) return null
      // Try exact match first
      if (healthMap[phoneNumber]) return healthMap[phoneNumber]
      // Try matching last 10 digits
      const digits = phoneNumber.replace(/\D/g, "").slice(-10)
      for (const key of Object.keys(healthMap)) {
        if (key.replace(/\D/g, "").slice(-10) === digits) {
          return healthMap[key]
        }
      }
      return null
    },
    [healthMap]
  )

  return { healthMap, loading, getHealth }
}

/**
 * Get display properties for a health status
 */
export function getHealthDisplay(status: NumberHealthEntry["status"]) {
  switch (status) {
    case "healthy":
      return {
        dotColor: "bg-green-500",
        borderColor: "border-green-400",
        bgColor: "bg-green-50",
        textColor: "text-green-700",
        badgeBg: "bg-green-100 text-green-700 border-green-300",
        label: "Healthy",
      }
    case "warning":
      return {
        dotColor: "bg-yellow-500",
        borderColor: "border-yellow-400",
        bgColor: "bg-yellow-50",
        textColor: "text-yellow-700",
        badgeBg: "bg-yellow-100 text-yellow-700 border-yellow-300",
        label: "Warning",
      }
    case "burned":
      return {
        dotColor: "bg-red-500",
        borderColor: "border-red-400",
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        badgeBg: "bg-red-100 text-red-700 border-red-300",
        label: "Burned",
      }
  }
}
