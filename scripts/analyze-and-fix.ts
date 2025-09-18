/* eslint-disable no-console */
import { promises as fs } from 'fs'

export async function analyzeFailures() {
  const reportData = await fs.readFile('test-report.json', 'utf-8')
  const report = JSON.parse(reportData)

  if (!report.failures || report.failures.length === 0) {
    console.log('✅ No failures to fix!')
    return
  }

  const fixes: string[] = []
  for (const failure of report.failures) {
    const fix = generateFixForFailure(failure)
    fixes.push(fix)
  }

  const fixInstructions = fixes.join('\n\n---\n\n')
  await fs.writeFile('cursor-fixes.md', fixInstructions)
  console.log(`📝 Generated ${fixes.length} fixes in cursor-fixes.md`)
}

function generateFixForFailure(failure: any): string {
  const { route, error, status } = failure

  let fix = `## Fix for ${route}\n\n`
  fix += `**Error:** ${error}\n`
  fix += `**Status:** ${status}\n\n`

  const err = String(error || '')
  if (err.includes('getComputedStyle')) {
    fix += `**Fix:** Add "use client" directive and wrap browser APIs in useEffect\n`
    fix += '```tsx\n"use client";\nimport { useEffect } from "react";\nuseEffect(() => { /* browser-only */ }, []);\n```'
  } else if (err.includes('static') || err.includes('dynamic')) {
    fix += `**Fix:** Add dynamic exports at the top of the file\n`
    fix += '```ts\nexport const dynamic = "force-dynamic";\nexport const revalidate = 0;\nexport const runtime = "nodejs";\n```'
  } else if (status === 404) {
    fix += `**Fix:** Create the missing page or API route\n`
    fix += `File needed: /app${route}/page.tsx or /app${route}/route.ts`
  } else if (status === 500) {
    fix += `**Fix:** Check server logs for the specific error\n`
    fix += `Common issues: env vars, DB connection, import issues`
  } else {
    fix += `**Fix:** Inspect implementation and logs for details.`
  }

  return fix
}

if (import.meta.main) {
  analyzeFailures().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}


