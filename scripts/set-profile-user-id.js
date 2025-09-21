const { Client } = require("pg");

async function main() {
  const conn = process.argv[2];
  const email = process.argv[3];
  if (!conn || !email) {
    console.error("Usage: node set-profile-user-id.js <connectionString> <email>");
    process.exit(1);
  }
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    await client.query("BEGIN");
    const { rows: urows } = await client.query("select id from auth.users where email=$1", [email]);
    if (urows.length === 0) throw new Error("No auth user for email");
    const authId = urows[0].id;

    // Ensure column exists
    await client.query("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id uuid;");

    const upd = await client.query(
      "update public.profiles set user_id=$1, is_admin=true where email=$2 returning id, email, user_id, is_admin",
      [authId, email]
    );

    await client.query("COMMIT");
    console.log(JSON.stringify({ updatedRows: upd.rowCount, profile: upd.rows[0] || null }, null, 2));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
