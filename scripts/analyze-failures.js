// Analyze smoke test failures and generate fix suggestions (Node 18+ ESM)
import { promises as fs } from 'fs'

async function analyzeFailures() {
  try {
    const reportData = await fs.readFile('test-report.json', 'utf-8')
    const report = JSON.parse(reportData)

    if (!report.failures || report.failures.length === 0) {
      console.log('✅ No failures to fix!')
      return
    }

    const fixes = []
    for (const failure of report.failures) {
      const fix = generateFixForFailure(failure)
      fixes.push(fix)
    }

    const fixInstructions = fixes.join('\n\n---\n\n')
    await fs.writeFile('cursor-fixes.md', fixInstructions)
    console.log(`📝 Generated ${fixes.length} fixes in cursor-fixes.md`)
    console.log('Copy the contents to Cursor Composer to apply fixes!')
  } catch (err) {
    console.error('Failed to analyze failures:', err)
    process.exitCode = 1
  }
}

function generateFixForFailure(failure) {
  const { route, error, status } = failure

  let fix = `## Fix for ${route}\n\n`
  fix += `**Error:** ${error}\n`
  fix += `**Status:** ${status}\n\n`

  const errorText = String(error || '')

  if (errorText.includes('getComputedStyle')) {
    fix += `**Fix:** Add "use client" directive and wrap browser APIs in useEffect\n`
    fix += '```tsx\n"use client";\nimport { useEffect } from "react";\n// Move browser code into useEffect\nuseEffect(() => { /* browser-only code */ }, []);\n```'
  } else if (errorText.includes('static') || errorText.includes('dynamic')) {
    fix += `**Fix:** Add dynamic exports at the top of the file\n`
    fix += '```ts\nexport const dynamic = "force-dynamic";\nexport const revalidate = 0;\nexport const runtime = "nodejs";\n```'
  } else if (status === 404) {
    fix += `**Fix:** Create the missing page or API route\n`
    fix += `File needed: /app${route}/page.tsx or /app${route}/route.ts`
  } else if (status === 500) {
    fix += `**Fix:** Check server logs for the specific error\n`
    fix += `Common issues: Missing environment variables, database connection errors, or import issues`
  } else {
    fix += `**Fix:** Inspect the route implementation and server logs for details.`
  }

  return fix
}

if (import.meta.main) {
  analyzeFailures().catch(console.error)
}

export { analyzeFailures }


