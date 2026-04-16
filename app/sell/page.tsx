"use client"

import { useState, useEffect } from "react"

export default function SellPage() {
  const [ref, setRef] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    phone: "",
    property_address: "",
    property_condition: "",
    timeline: "",
    asking_price: "",
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const r = new URLSearchParams(window.location.search).get("ref")
    if (r) setRef(r)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/webhooks/hh-form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ref }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || "something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Thanks!</h1>
          <p style={styles.p}>
            We're pulling your numbers right now. Expect a call in the next 5–10 minutes.
          </p>
          <p style={styles.pSmall}>
            — Nyalls, Marathon Empire Holdings
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Get a cash offer on your property</h1>
        <p style={styles.p}>
          Five quick fields. We'll have a cash offer range for you in about 5–10 minutes.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Your name
            <input
              style={styles.input}
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="First Last"
            />
          </label>

          <label style={styles.label}>
            Property address *
            <input
              style={styles.input}
              type="text"
              required
              value={form.property_address}
              onChange={(e) => setForm({ ...form, property_address: e.target.value })}
              placeholder="1234 Main St, Atlanta, GA 30303"
            />
          </label>

          <label style={styles.label}>
            Phone number *
            <input
              style={styles.input}
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(470) 555-5555"
            />
          </label>

          <label style={styles.label}>
            Property condition
            <select
              style={styles.input}
              value={form.property_condition}
              onChange={(e) => setForm({ ...form, property_condition: e.target.value })}
            >
              <option value="">Select one…</option>
              <option value="move_in_ready">Move-in ready</option>
              <option value="needs_work">Needs some work</option>
              <option value="major_repairs">Major repairs</option>
              <option value="not_sure">Not sure</option>
            </select>
          </label>

          <label style={styles.label}>
            Timeline
            <select
              style={styles.input}
              value={form.timeline}
              onChange={(e) => setForm({ ...form, timeline: e.target.value })}
            >
              <option value="">Select one…</option>
              <option value="asap">ASAP</option>
              <option value="1_3_months">1–3 months</option>
              <option value="3_6_months">3–6 months</option>
              <option value="just_exploring">Just exploring</option>
            </select>
          </label>

          <label style={styles.label}>
            What are you hoping to get? <span style={styles.optional}>(optional)</span>
            <input
              style={styles.input}
              type="text"
              value={form.asking_price}
              onChange={(e) => setForm({ ...form, asking_price: e.target.value })}
              placeholder="$250,000 or 'not sure'"
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? "Sending…" : "Get my cash offer"}
          </button>
          <p style={styles.pSmall}>
            No obligation. We'll call within 5–10 minutes.
          </p>
        </form>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b1020",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 32,
    maxWidth: 520,
    width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  },
  h1: { margin: "0 0 12px", fontSize: 28, color: "#0b1020" },
  p: { margin: "0 0 24px", color: "#333", lineHeight: 1.5 },
  pSmall: { margin: "12px 0 0", color: "#666", fontSize: 13, textAlign: "center" as const },
  form: { display: "flex", flexDirection: "column" as const, gap: 14 },
  label: { display: "flex", flexDirection: "column" as const, gap: 6, color: "#333", fontSize: 14, fontWeight: 500 },
  input: { padding: "12px 14px", fontSize: 16, border: "1px solid #ccc", borderRadius: 8, color: "#111", background: "#fff" },
  optional: { color: "#888", fontWeight: 400, fontSize: 12 },
  button: {
    marginTop: 8,
    padding: "14px 20px",
    background: "#0b72e6",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  error: { background: "#fee", color: "#900", padding: 10, borderRadius: 6, fontSize: 14 },
}
