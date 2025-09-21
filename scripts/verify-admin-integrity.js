const { Client } = require("pg");

async function main() {
  const conn = process.argv[2];
  const email = process.argv[3];
  if (!conn || !email) {
    console.error("Usage: node verify-admin-integrity.js <connectionString> <email>");
    process.exit(1);
  }
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    const u = await client.query("select id, email from auth.users where email = $1", [email]);
    const p = await client.query("select id, email, is_admin from public.profiles where email = $1", [email]);
    const user = u.rows[0] || null;
    const profile = p.rows[0] || null;
    const idsMatch = user && profile ? user.id === profile.id : false;
    console.log(JSON.stringify({ user, profile, idsMatch }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
