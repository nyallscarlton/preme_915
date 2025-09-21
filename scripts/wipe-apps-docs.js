const { Client } = require("pg");

async function main() {
  const conn = process.argv[2];
  if (!conn) {
    console.error("Usage: node wipe-apps-docs.js <connectionString>");
    process.exit(1);
  }
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM public.documents");
    await client.query("DELETE FROM public.applications");
    await client.query("COMMIT");

    const counts = {};
    const { rows: a } = await client.query("select count(*)::int as c from public.applications");
    const { rows: d } = await client.query("select count(*)::int as c from public.documents");
    counts.applications = a[0].c;
    counts.documents = d[0].c;
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
