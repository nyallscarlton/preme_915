#!/usr/bin/env node
const { Client } = require('pg')

async function main() {
  const connectionString = process.argv[2]
  const email = process.argv[3]
  if (!connectionString || !email) {
    console.error('Usage: node scripts/e2e-mark-verified.js <connectionString> <email>')
    process.exit(1)
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    const res = await client.query(
      `update auth.users set email_confirmed_at = now() where email = $1 returning email, email_confirmed_at`,
      [email]
    )
    console.log(JSON.stringify({ updated: res.rowCount, row: res.rows?.[0] || null }, null, 2))
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(2)
  } finally {
    try { await client.end() } catch {}
  }
}

main()


