const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const conn = process.argv[2];
  const adminEmail = process.argv[3] || "nyallscarlton@gmail.com";
  if (!conn) {
    console.error("Usage: node run-cleanup.js <connectionString> [adminEmail]");
    process.exit(1);
  }

  const sql = fs.readFileSync(path.join(__dirname, "cleanup-sample-data.sql"), "utf8");
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    await client.query("BEGIN");
    // Replace hardcoded email with provided adminEmail for safety
    const safeSql = sql.replaceAll('nyallscarlton@gmail.com', adminEmail);
    await client.query(safeSql);
    await client.query("COMMIT");

    const counts = {};
    const q = async (name, text) => {
      const { rows } = await client.query(text);
      counts[name] = rows[0]?.count || 0;
    };

    await q("profiles", "select count(*)::int as count from public.profiles");
    await q("applications", "select count(*)::int as count from public.applications");
    await q("documents", "select count(*)::int as count from public.documents");
    try { await q("messages", "select count(*)::int as count from public.messages"); } catch {}
    try { await q("notifications", "select count(*)::int as count from public.notifications"); } catch {}

    console.log(JSON.stringify({ ok: true, counts }, null, 2));
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
