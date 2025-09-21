import { test, expect } from "@playwright/test"

const BASE = process.env.BASE_URL || "https://www.premerealestate.com"

test.describe("Homepage", () => {
  test("loads fast and has no console errors", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text())
    })
    const resp = await page.goto(BASE, { waitUntil: "load" })
    expect(resp?.status()).toBe(200)

    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
      if (nav) return { load: nav.loadEventEnd - nav.startTime }
      const t = performance.timing
      return { load: t.loadEventEnd - t.navigationStart }
    })
    expect(perf.load).toBeLessThan(3000)
    expect(errors).toHaveLength(0)
  })
})

test.describe("Pages", () => {
  const pages = ["/about", "/how-it-works", "/loan-programs", "/contact", "/auth"]
  for (const path of pages) {
    test(`${path} returns 200`, async ({ page }) => {
      const resp = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" })
      expect(resp?.status()).toBe(200)
    })
  }
})

test("API routes respond", async ({ request }) => {
  const checks = [
    { path: "/api/guest/verify-token?token=test", method: "GET" },
    { path: "/api/guest/send-magic-link", method: "POST", data: { email: "test@example.com" } },
    { path: "/api/guest/convert-to-account", method: "POST", data: { token: "ml_test", password: "Password1!", confirmPassword: "Password1!" } },
    { path: "/api/debug/env", method: "GET" },
    { path: "/api/places/search?q=prem", method: "GET" },
  ]

  for (const c of checks) {
    const url = `${BASE}${c.path}`
    const res = c.method === "GET" ? await request.get(url) : await request.post(url, { data: c.data })
    expect(res.status()).toBeLessThan(500)
  }
})

test.describe("Not found route", () => {
  test("returns 404", async ({ request }) => {
    const res = await request.get(`${BASE}/this-route-should-not-exist-404-check`)
    expect(res.status()).toBe(404)
  })
})


