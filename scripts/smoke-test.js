// This script will test all pages and API routes (Node 18+)
import { promises as fs } from 'fs'

const BASE_URL = 'https://v0-preme-home-page-part-2.vercel.app'

const ROUTES_TO_TEST = {
  pages: [
    '/',
    '/about',
    '/apply',
    '/contact',
    '/faq',
    '/privacy',
    '/terms',
  ],
  api: [
    '/api/guest/verify-token?token=test',
  ],
}

const results = []

async function testRoute(route, type) {
  console.log(`Testing ${type}: ${route}`)

  try {
    const response = await fetch(`${BASE_URL}${route}`, {
      method: 'GET',
      headers: type === 'api' ? { 'Content-Type': 'application/json' } : {},
    })

    const status = response.status
    const isOk = status >= 200 && status < 400

    let body = ''
    let error = null

    try {
      if (type === 'api') {
        const data = await response.json()
        body = JSON.stringify(data)
      } else {
        body = await response.text()
        if (
          body.includes('Application error') ||
          body.includes('500') ||
          body.toLowerCase().includes('error')
        ) {
          error = 'Page contains error indicators'
        }
      }
    } catch (e) {
      error = `Failed to parse response: ${e}`
    }

    const passed = isOk && !error
    results.push({ route, type, status, passed, error, timestamp: new Date().toISOString() })
    return { route, passed, error }
  } catch (e) {
    const errMsg = `Network error: ${e}`
    results.push({ route, type, status: 0, passed: false, error: errMsg, timestamp: new Date().toISOString() })
    return { route, passed: false, error: errMsg }
  }
}

async function runAllTests() {
  console.log('🚀 Starting smoke tests...\n')

  for (const route of ROUTES_TO_TEST.pages) {
    await testRoute(route, 'page')
    await new Promise((r) => setTimeout(r, 400))
  }

  for (const route of ROUTES_TO_TEST.api) {
    await testRoute(route, 'api')
    await new Promise((r) => setTimeout(r, 400))
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    timestamp: new Date().toISOString(),
    url: BASE_URL,
  }

  const report = {
    summary,
    results,
    failures: results.filter((r) => !r.passed),
  }

  await fs.writeFile('test-report.json', JSON.stringify(report, null, 2))

  console.log('\n📊 Test Results:')
  console.log(`✅ Passed: ${summary.passed}`)
  console.log(`❌ Failed: ${summary.failed}`)
  console.log('📁 Full report saved to test-report.json')

  if (report.failures.length > 0) {
    console.log('\n❌ Failed Tests:')
    report.failures.forEach((f) => console.log(`  - ${f.route}: ${f.error}`))
  }

  return report
}

if (import.meta.main) {
  runAllTests().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

export { runAllTests, testRoute }


