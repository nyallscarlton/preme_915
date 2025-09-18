#!/usr/bin/env node
const { Client } = require('pg');

const connectionString = process.argv[2];
if (!connectionString) {
  console.error('Usage: node scripts/list-tables.js <connectionString>');
  process.exit(1);
}

(async () => {
  const client = new Client({
    connectionString,
    // For local scripts on some networks, cert chains may fail.
    // This bypasses cert validation. Do NOT use in production code.
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    const tables = res.rows.map(r => `${r.table_schema}.${r.table_name}`);
    console.log(JSON.stringify({ count: tables.length, tables }, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  } finally {
    try { await client.end(); } catch (_) { /* noop */ }
  }
})();


