const { Client } = require("pg");

async function main() {
  const conn = process.argv[2];
  if (!conn) {
    console.error("Usage: node add-application-archived.js <connectionString>");
    process.exit(1);
  }
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    await client.query("BEGIN");

    // Add archived column
    await client.query(
      "ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;"
    );

    // Helpful indexes
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_applications_archived ON public.applications(archived);"
    );

    // Admin policies: allow admins to read/update all applications
    // Try to create; ignore if already exists
    const tryCreate = async (sql) => {
      try { await client.query(sql); } catch (_) {}
    };
    await tryCreate(
      "CREATE POLICY \"Admins can read all applications\" ON public.applications FOR SELECT USING (\n        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)\n      );"
    );
    await tryCreate(
      "CREATE POLICY \"Admins can update all applications\" ON public.applications FOR UPDATE USING (\n        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)\n      );"
    );

    await client.query("COMMIT");
    console.log(JSON.stringify({ ok: true }, null, 2));
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
