const { Client } = require("pg");

async function main() {
  const conn = process.argv[2];
  const email = process.argv[3];
  if (!conn || !email) {
    console.error("Usage: node fix-profile-id.js <connectionString> <email>");
    process.exit(1);
  }
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    await client.query("BEGIN");

    const { rows: urows } = await client.query(
      "select id from auth.users where email=$1",
      [email]
    );
    if (urows.length === 0) {
      throw new Error("No auth.users row for that email");
    }
    const authId = urows[0].id;

    const { rows: prows } = await client.query(
      "select id, email, is_admin from public.profiles where email=$1",
      [email]
    );

    if (prows.length === 0) {
      // Insert missing profile with correct id
      await client.query(
        "insert into public.profiles (id, email, is_admin) values ($1, $2, true) on conflict (id) do update set email=excluded.email, is_admin=true",
        [authId, email]
      );
      await client.query("COMMIT");
      console.log(JSON.stringify({ fixed: "inserted_profile", id: authId, email, is_admin: true }, null, 2));
      return;
    }

    const profile = prows[0];
    if (profile.id === authId) {
      // Just ensure admin flag
      await client.query(
        "update public.profiles set is_admin=true where id=$1",
        [authId]
      );
      await client.query("COMMIT");
      console.log(JSON.stringify({ fixed: "aligned_ids", id: authId, email, is_admin: true }, null, 2));
      return;
    }

    // Migrate ownership from old profile id to auth id
    const oldId = profile.id;
    await client.query("update public.applications set user_id=$1 where user_id=$2", [authId, oldId]);
    await client.query("update public.documents set user_id=$1 where user_id=$2", [authId, oldId]);

    // Delete old profile and insert correct one
    await client.query("delete from public.profiles where id=$1", [oldId]);
    await client.query(
      "insert into public.profiles (id, email, is_admin) values ($1, $2, true) on conflict (id) do update set email=excluded.email, is_admin=true",
      [authId, email]
    );

    await client.query("COMMIT");
    console.log(JSON.stringify({ fixed: "migrated_profile", from: oldId, to: authId, email, is_admin: true }, null, 2));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
