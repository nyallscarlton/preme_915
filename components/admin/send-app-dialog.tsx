"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, Copy, Loader2, Send } from "lucide-react"

/**
 * Team action: text a lead their (prefilled) application link.
 * Creates the file on the board in 1003 Out and fires the SMS via Riley's number.
 */
export function SendAppDialog({ onSent }: { onSent?: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [requestedBy, setRequestedBy] = useState("Nyalls")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ link: string; smsSent: boolean; applicationNumber: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setName("")
    setPhone("")
    setEmail("")
    setResult(null)
    setError(null)
    setCopied(false)
  }

  const send = async () => {
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/send-app-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, requestedBy }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Send failed")
      setResult(data)
      onSent?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => { reset(); setOpen(true) }}
        className="bg-[#997100] text-black hover:bg-[#b8850a]"
      >
        <Send className="mr-2 h-4 w-4" />
        Send Application
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Text a lead their application</DialogTitle>
            <DialogDescription>
              Creates their file on the board and texts the prefilled, signable 1003 link from (470) 942-5787.
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle className="h-5 w-5" />
                <p className="text-sm font-medium">
                  {result.smsSent ? "Text sent" : "File created (SMS failed — send the link manually)"} · {result.applicationNumber}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={result.link} className="bg-input border-border text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-border"
                  onClick={() => { navigator.clipboard.writeText(result.link); setCopied(true) }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Button onClick={() => setOpen(false)} className="w-full bg-[#997100] text-black hover:bg-[#b8850a]">
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-foreground">Lead name *</Label>
                <Input placeholder="Jane Borrower" value={name} onChange={(e) => setName(e.target.value)} className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">Mobile number *</Label>
                <Input placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">Email (optional)</Label>
                <Input placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">Who's this from?</Label>
                <Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className="bg-input border-border" />
                <p className="text-xs text-muted-foreground">
                  Riley's text reads: "{requestedBy || "our team"} asked me to send over your application."
                </p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                onClick={send}
                disabled={sending || !name.trim() || phone.replace(/\D/g, "").length < 10}
                className="w-full bg-[#997100] text-black hover:bg-[#b8850a]"
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send the text
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
