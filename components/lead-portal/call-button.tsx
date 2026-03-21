"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Phone, Loader2, PhoneOff, Clock, Bot, ChevronDown, Mic, MicOff } from "lucide-react"

interface CallButtonProps {
  leadId: string
  phone: string
  firstName: string
  lastName: string
  loanType?: string
}

type CallState = "idle" | "connecting" | "ringing" | "connected" | "ended" | "error"

export function CallButton({
  leadId,
  phone,
  firstName,
  lastName,
  loanType,
}: CallButtonProps) {
  const [callState, setCallState] = useState<CallState>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [callMode, setCallMode] = useState<"browser" | "ai" | null>(null)
  const deviceRef = useRef<any>(null)
  const callRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const sdkLoadedRef = useRef(false)

  // Load Twilio Voice SDK v2
  useEffect(() => {
    if (sdkLoadedRef.current) return
    if (typeof window !== "undefined" && !(window as any).Twilio?.Device) {
      const script = document.createElement("script")
      script.src = "https://sdk.twilio.com/js/client/v2.1/twilio.min.js"
      script.async = true
      script.onload = () => { sdkLoadedRef.current = true }
      document.head.appendChild(script)
    } else {
      sdkLoadedRef.current = true
    }
  }, [])

  // Duration timer
  useEffect(() => {
    if (callState === "connected") {
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callState])

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const handleBrowserCall = async () => {
    if (callState !== "idle") return
    setCallState("connecting")
    setCallMode("browser")
    setErrorMsg(null)

    try {
      const tokenRes = await fetch("/api/twilio/token")
      const tokenData = await tokenRes.json()

      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Failed to get voice token")
      }

      const Twilio = (window as any).Twilio
      if (!Twilio?.Device) {
        throw new Error("Voice SDK not loaded. Please refresh and try again.")
      }

      const device = new Twilio.Device(tokenData.token, {
        logLevel: "error",
        codecPreferences: ["opus", "pcmu"],
      })

      deviceRef.current = device

      device.on("error", (err: any) => {
        setErrorMsg(err?.message || "Device error")
        setCallState("error")
      })

      await device.register()

      const digits = phone.replace(/\D/g, "")
      const toNumber = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

      const call = await device.connect({
        params: {
          To: toNumber,
          lead_id: leadId,
        },
      })

      callRef.current = call

      call.on("ringing", () => setCallState("ringing"))
      call.on("accept", () => setCallState("connected"))
      call.on("disconnect", () => {
        setCallState("ended")
        device.destroy()
      })
      call.on("error", (err: any) => {
        setErrorMsg(err?.message || "Call error")
        setCallState("error")
        device.destroy()
      })
      call.on("cancel", () => {
        setCallState("ended")
        device.destroy()
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Call failed")
      setCallState("error")
    }
  }

  const handleAiCall = async () => {
    if (callState !== "idle") return
    setCallState("connecting")
    setCallMode("ai")
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/leads/${leadId}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ai" }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate AI call")
      }

      setCallState("connected")
      setTimeout(() => {
        setCallState((prev) => (prev === "connected" ? "ended" : prev))
      }, 300000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Call failed")
      setCallState("error")
    }
  }

  const handleHangup = () => {
    if (callRef.current) {
      callRef.current.disconnect()
    }
    if (deviceRef.current) {
      deviceRef.current.unregister()
      deviceRef.current.destroy()
    }
    setCallState("ended")
  }

  const toggleMute = () => {
    if (callRef.current) {
      const newMuted = !muted
      callRef.current.mute(newMuted)
      setMuted(newMuted)
    }
  }

  const reset = () => {
    setCallState("idle")
    setErrorMsg(null)
    setCallMode(null)
    setMuted(false)
    setDuration(0)
    callRef.current = null
    deviceRef.current = null
  }

  if (callState === "idle") {
    return (
      <div className="flex items-center gap-2">
        <Button
          className="bg-[#997100] hover:bg-[#b8850a] text-black font-semibold"
          onClick={handleBrowserCall}
        >
          <Phone className="h-4 w-4 mr-2" />
          Call {firstName}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground hover:bg-muted bg-transparent px-2"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleBrowserCall}>
              <Phone className="h-3.5 w-3.5 mr-2" />
              Call from browser
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAiCall}>
              <Bot className="h-3.5 w-3.5 mr-2" />
              Have Riley (AI) call {firstName}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  if (callState === "connecting") {
    return (
      <Button className="bg-[#997100]/70 text-black font-semibold cursor-wait" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Connecting...
      </Button>
    )
  }

  if (callState === "ringing") {
    return (
      <div className="flex items-center gap-2">
        <Button className="bg-blue-700 text-white font-semibold" disabled>
          <Phone className="h-4 w-4 mr-2 animate-pulse" />
          Ringing {firstName}...
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-red-800 text-red-400 hover:bg-red-950 bg-transparent"
          onClick={handleHangup}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  if (callState === "connected") {
    return (
      <div className="flex items-center gap-2">
        <Button className="bg-emerald-700 text-white font-semibold" disabled>
          <Phone className="h-4 w-4 mr-2 animate-pulse" />
          {callMode === "ai" ? "Riley on call" : formatDuration(duration)}
        </Button>
        {callMode === "browser" && (
          <Button
            variant="outline"
            size="sm"
            className={`bg-transparent ${muted ? "border-red-600 text-red-400" : "border-border text-muted-foreground hover:bg-muted"}`}
            onClick={toggleMute}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="border-red-800 text-red-400 hover:bg-red-950 bg-transparent"
          onClick={callMode === "browser" ? handleHangup : () => setCallState("ended")}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  if (callState === "ended") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Call ended{duration > 0 ? ` (${formatDuration(duration)})` : ""}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-border text-foreground hover:bg-muted bg-transparent"
          onClick={reset}
        >
          <Phone className="h-3.5 w-3.5 mr-1.5" />
          Call Again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <p className="text-xs text-red-400">{errorMsg || "Call failed"}</p>
      <Button
        variant="outline"
        size="sm"
        className="border-border text-foreground hover:bg-muted bg-transparent"
        onClick={reset}
      >
        <Phone className="h-3.5 w-3.5 mr-1.5" />
        Try Again
      </Button>
    </div>
  )
}
