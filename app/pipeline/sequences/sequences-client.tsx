"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, Clock, MessageSquare, Phone, Mail, Save, Loader2 } from "lucide-react"

interface Sequence {
  id: string
  slug: string
  name: string
  active: boolean
}

interface Template {
  id: string
  slug: string
  name: string
  body: string
}

interface Step {
  id: string
  sequence_id: string
  step_number: number
  channel: string
  delay_minutes: number
  active: boolean
  send_after_hour: number
  send_before_hour: number
  template_id: string | null
  message_templates: Template | null
}

interface Props {
  sequences: Sequence[]
  steps: Step[]
  templates: Template[]
  enrollmentCounts: Record<string, { active: number; paused: number }>
}

function formatDelay(minutes: number): string {
  if (minutes === 0) return "Instant"
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `Day ${Math.round(minutes / 1440)}`
}

function channelIcon(channel: string) {
  if (channel === "auto_call") return <Phone className="h-3.5 w-3.5" />
  if (channel === "auto_sms") return <MessageSquare className="h-3.5 w-3.5" />
  if (channel === "auto_email") return <Mail className="h-3.5 w-3.5" />
  return <Clock className="h-3.5 w-3.5" />
}

function channelLabel(channel: string): string {
  if (channel === "auto_call") return "Call"
  if (channel === "auto_sms") return "SMS"
  if (channel === "auto_email") return "Email"
  return channel
}

export function SequencesClient({ sequences, steps, templates, enrollmentCounts }: Props) {
  const [expandedSeq, setExpandedSeq] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [templateEdits, setTemplateEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [togglingSeq, setTogglingSeq] = useState<string | null>(null)
  const [togglingStep, setTogglingStep] = useState<string | null>(null)
  const [localSequences, setLocalSequences] = useState(sequences)
  const [localSteps, setLocalSteps] = useState(steps)
  const [delayEdits, setDelayEdits] = useState<Record<string, string>>({})

  const stepsForSeq = (seqId: string) => localSteps.filter(s => s.sequence_id === seqId).sort((a, b) => a.step_number - b.step_number)

  async function toggleSequence(seqId: string, currentActive: boolean) {
    setTogglingSeq(seqId)
    try {
      const res = await fetch("/api/pipeline/sequences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sequence", id: seqId, active: !currentActive }),
      })
      if (res.ok) {
        setLocalSequences(prev => prev.map(s => s.id === seqId ? { ...s, active: !currentActive } : s))
      }
    } finally {
      setTogglingSeq(null)
    }
  }

  async function toggleStep(stepId: string, currentActive: boolean) {
    setTogglingStep(stepId)
    try {
      const res = await fetch("/api/pipeline/sequences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "step", id: stepId, active: !currentActive }),
      })
      if (res.ok) {
        setLocalSteps(prev => prev.map(s => s.id === stepId ? { ...s, active: !currentActive } : s))
      }
    } finally {
      setTogglingStep(null)
    }
  }

  async function saveTemplate(templateId: string) {
    const body = templateEdits[templateId]
    if (!body) return
    setSaving(templateId)
    try {
      const res = await fetch("/api/pipeline/sequences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "template", id: templateId, body }),
      })
      if (res.ok) {
        setEditingTemplate(null)
        setLocalSteps(prev => prev.map(s => {
          if (s.message_templates?.id === templateId) {
            return { ...s, message_templates: { ...s.message_templates, body } }
          }
          return s
        }))
      }
    } finally {
      setSaving(null)
    }
  }

  async function saveDelay(stepId: string) {
    const val = delayEdits[stepId]
    if (val === undefined) return
    const delay_minutes = parseInt(val)
    if (isNaN(delay_minutes) || delay_minutes < 0) return
    setSaving(stepId)
    try {
      const res = await fetch("/api/pipeline/sequences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "step_delay", id: stepId, delay_minutes }),
      })
      if (res.ok) {
        setLocalSteps(prev => prev.map(s => s.id === stepId ? { ...s, delay_minutes } : s))
        setDelayEdits(prev => { const n = { ...prev }; delete n[stepId]; return n })
      }
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-3">
      {localSequences.map(seq => {
        const seqSteps = stepsForSeq(seq.id)
        const activeSteps = seqSteps.filter(s => s.active).length
        const isExpanded = expandedSeq === seq.id
        const counts = enrollmentCounts[seq.id] || { active: 0, paused: 0 }

        return (
          <Card key={seq.id}>
            <CardContent className="p-0">
              {/* Sequence header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setExpandedSeq(isExpanded ? null : seq.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <div>
                    <div className="font-semibold text-gray-900">{seq.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {activeSteps}/{seqSteps.length} steps active
                      {counts.active > 0 && <span className="ml-2 text-green-600">{counts.active} leads enrolled</span>}
                      {counts.paused > 0 && <span className="ml-2 text-yellow-600">{counts.paused} paused</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Badge variant={seq.active ? "default" : "secondary"} className={seq.active ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500"}>
                    {seq.active ? "Active" : "Disabled"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={togglingSeq === seq.id}
                    onClick={() => toggleSequence(seq.id, seq.active)}
                  >
                    {togglingSeq === seq.id ? <Loader2 className="h-3 w-3 animate-spin" /> : seq.active ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>

              {/* Expanded steps */}
              {isExpanded && (
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="text-left px-4 py-2 w-12">#</th>
                        <th className="text-left px-4 py-2">Channel</th>
                        <th className="text-left px-4 py-2">Timing</th>
                        <th className="text-left px-4 py-2">Hours</th>
                        <th className="text-left px-4 py-2">Template</th>
                        <th className="text-left px-4 py-2">Status</th>
                        <th className="text-right px-4 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {seqSteps.map(step => {
                        const tpl = step.message_templates
                        const isEditingTpl = editingTemplate === tpl?.id
                        return (
                          <tr key={step.id} className={`hover:bg-gray-50 transition ${!step.active ? "opacity-50" : ""}`}>
                            <td className="px-4 py-2.5 text-gray-400 font-mono">{step.step_number}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1.5 text-gray-700">
                                {channelIcon(step.channel)}
                                {channelLabel(step.channel)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {delayEdits[step.id] !== undefined ? (
                                <span className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    className="w-20 border rounded px-2 py-0.5 text-xs"
                                    value={delayEdits[step.id]}
                                    onChange={e => setDelayEdits(prev => ({ ...prev, [step.id]: e.target.value }))}
                                    onClick={e => e.stopPropagation()}
                                  />
                                  <span className="text-xs text-gray-400">min</span>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => saveDelay(step.id)} disabled={saving === step.id}>
                                    {saving === step.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                  </Button>
                                </span>
                              ) : (
                                <span
                                  className="text-gray-600 cursor-pointer hover:underline"
                                  onClick={e => { e.stopPropagation(); setDelayEdits(prev => ({ ...prev, [step.id]: String(step.delay_minutes) })) }}
                                >
                                  {formatDelay(step.delay_minutes)}
                                  <span className="text-xs text-gray-400 ml-1">({step.delay_minutes}m)</span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">
                              {step.send_after_hour}:00–{step.send_before_hour}:00
                            </td>
                            <td className="px-4 py-2.5">
                              {tpl ? (
                                <div>
                                  <div className="text-xs font-medium text-gray-700">{tpl.name}</div>
                                  {isEditingTpl ? (
                                    <div className="mt-1" onClick={e => e.stopPropagation()}>
                                      <textarea
                                        className="w-full border rounded p-2 text-xs min-h-[80px] font-mono"
                                        value={templateEdits[tpl.id] ?? tpl.body}
                                        onChange={e => setTemplateEdits(prev => ({ ...prev, [tpl.id]: e.target.value }))}
                                      />
                                      <div className="flex gap-1 mt-1">
                                        <Button size="sm" className="h-6 text-xs" onClick={() => saveTemplate(tpl.id)} disabled={saving === tpl.id}>
                                          {saving === tpl.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                          Save
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className="text-xs text-gray-400 truncate max-w-xs cursor-pointer hover:text-gray-600"
                                      onClick={e => { e.stopPropagation(); setEditingTemplate(tpl.id); setTemplateEdits(prev => ({ ...prev, [tpl.id]: tpl.body })) }}
                                    >
                                      {tpl.body.slice(0, 60)}...
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant="secondary" className={step.active ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-400"}>
                                {step.active ? "On" : "Off"}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs"
                                disabled={togglingStep === step.id}
                                onClick={e => { e.stopPropagation(); toggleStep(step.id, step.active) }}
                              >
                                {togglingStep === step.id ? <Loader2 className="h-3 w-3 animate-spin" /> : step.active ? "Disable" : "Enable"}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
