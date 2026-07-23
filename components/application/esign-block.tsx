"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Eraser, PenLine } from "lucide-react"

/**
 * ESIGN/UETA-style electronic signature capture: consent checkbox, typed
 * legal name, and a drawn signature pad. Emits {esignName, esignImage,
 * esignConsent} through onChange — the submit handler ships it as _esign.
 */
export function ESignBlock({
  defaultName,
  onChange,
}: {
  defaultName?: string
  onChange: (data: { esignName: string; esignImage: string | null; esignConsent: boolean }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [name, setName] = useState(defaultName || "")
  const [consent, setConsent] = useState(false)

  const emit = (n: string, c: boolean, drawn: boolean) => {
    onChange({
      esignName: n,
      esignImage: drawn && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null,
      esignConsent: c,
    })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#1a1a1a"

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height }
    }
    const down = (e: PointerEvent) => {
      drawing.current = true
      const p = pos(e)
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      e.preventDefault()
    }
    const move = (e: PointerEvent) => {
      if (!drawing.current) return
      const p = pos(e)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      e.preventDefault()
    }
    const up = () => {
      if (drawing.current) {
        drawing.current = false
        setHasDrawn(true)
      }
    }

    canvas.addEventListener("pointerdown", down)
    canvas.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  }, [])

  // Re-emit whenever any piece changes (drawn strokes emit on pointer up via state)
  useEffect(() => {
    emit(name, consent, hasDrawn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, consent, hasDrawn])

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  return (
    <Card className="border-[#997100]/50 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <PenLine className="h-5 w-5 text-[#997100]" />
          Electronic Signature
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-foreground">Type your full legal name *</Label>
          <Input
            placeholder="Jane Q. Borrower"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-input border-border text-foreground"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground">Draw your signature *</Label>
            <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-7 gap-1 px-2 text-xs text-muted-foreground">
              <Eraser className="h-3 w-3" /> Clear
            </Button>
          </div>
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            className="w-full touch-none rounded-md border border-dashed border-border bg-white"
            style={{ height: 120 }}
          />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="esignConsent"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5"
          />
          <label htmlFor="esignConsent" className="cursor-pointer text-xs leading-snug text-muted-foreground">
            I agree to conduct this transaction electronically and to sign this application with an
            electronic signature under the federal ESIGN Act and applicable state law (UETA). I certify
            that the information provided in this application is true and correct to the best of my
            knowledge, and I authorize Preme Home Loans to verify the information provided and to
            obtain a consumer credit report.
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
