const { Client } = require("pg");

async function main() {
  const argConn = process.argv[2];
  const argEmail = process.argv[3];

  const connectionString = process.env.SUPABASE_POOLER_URL || argConn;
  const targetEmail = process.env.TARGET_EMAIL || argEmail || "";

  if (!connectionString) {
    console.error("Missing SUPABASE_POOLER_URL env var or argv[2] connection string");
    process.exit(1);
  }
  if (!targetEmail) {
    console.error("Missing TARGET_EMAIL env var or argv[3] target email");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Ensure is_admin column exists
    await client.query(
      "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;"
    );

    // Update the target profile
    const result = await client.query(
      "UPDATE public.profiles SET is_admin = true WHERE email = $1 RETURNING id, email, is_admin",
      [targetEmail]
    );

    // If no row updated, surface a hint
    if (result.rowCount === 0) {
      console.log(
        JSON.stringify(
          {
            updatedRows: 0,
            hint:
              "No profile row matched that email. Ensure the user exists in auth.users and a profile row is created.",
          },
          null,
          2
        )
      );
      return;
    }

    console.log(
      JSON.stringify(
        {
          updatedRows: result.rowCount,
          profile: result.rows[0],
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
