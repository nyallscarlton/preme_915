const { Client } = require('pg')

const CONNECTION_STRING = 'postgresql://postgres.hriipovloelnqrlwtswy:2Yungnyalls!@aws-1-us-east-2.pooler.supabase.com:6543/postgres'
const ADMIN_EMAIL = 'nyallscarlton@gmail.com'

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    await client.query('BEGIN')

    // 1) Fetch auth user by email
    const { rows: userRows } = await client.query(
      'SELECT id, email FROM auth.users WHERE email = $1 LIMIT 1',
      [ADMIN_EMAIL]
    )
    if (userRows.length === 0) {
      throw new Error(`No auth.users row found for ${ADMIN_EMAIL}. Sign in once to create the user, then retry.`)
    }
    const authUser = userRows[0]

    // 2) Inspect profiles schema
    const { rows: columns } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles'`
    )
    const colSet = new Set(columns.map(c => c.column_name))

    const hasId = colSet.has('id')
    const hasUserId = colSet.has('user_id')
    const hasEmail = colSet.has('email')
    const hasIsAdmin = colSet.has('is_admin')
    const hasRole = colSet.has('role')

    // 3) Ensure is_admin exists
    if (!hasIsAdmin) {
      await client.query('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;')
    }

    // 4) Upsert profile with admin flag, depending on schema
    if (hasUserId) {
      // Prefer user_id linkage
      if (hasEmail) {
        await client.query(
          `INSERT INTO public.profiles (user_id, email, is_admin)
           VALUES ($1, $2, true)
           ON CONFLICT (user_id) DO UPDATE SET is_admin = EXCLUDED.is_admin`,
          [authUser.id, ADMIN_EMAIL]
        )
      } else {
        await client.query(
          `INSERT INTO public.profiles (user_id, is_admin)
           VALUES ($1, true)
           ON CONFLICT (user_id) DO UPDATE SET is_admin = EXCLUDED.is_admin`,
          [authUser.id]
        )
      }
    } else if (hasId) {
      // Use id linkage to auth.users.id
      if (hasEmail) {
        await client.query(
          `INSERT INTO public.profiles (id, email, is_admin)
           VALUES ($1, $2, true)
           ON CONFLICT (id) DO UPDATE SET is_admin = EXCLUDED.is_admin`,
          [authUser.id, ADMIN_EMAIL]
        )
      } else {
        await client.query(
          `INSERT INTO public.profiles (id, is_admin)
           VALUES ($1, true)
           ON CONFLICT (id) DO UPDATE SET is_admin = EXCLUDED.is_admin`,
          [authUser.id]
        )
      }
    } else {
      throw new Error('profiles table does not have id or user_id columns; cannot link to auth.users')
    }

    // 5) Optionally set role if column exists
    if (hasRole) {
      if (hasUserId) {
        await client.query(`UPDATE public.profiles SET role = 'admin' WHERE user_id = $1`, [authUser.id])
      } else if (hasId) {
        await client.query(`UPDATE public.profiles SET role = 'admin' WHERE id = $1`, [authUser.id])
      }
    }

    // 6) Verify result
    let verifyQuery = ''
    let verifyParam = null
    if (hasUserId) {
      verifyQuery = `SELECT * FROM public.profiles WHERE user_id = $1`
      verifyParam = authUser.id
    } else if (hasId) {
      verifyQuery = `SELECT * FROM public.profiles WHERE id = $1`
      verifyParam = authUser.id
    }
    const { rows: verify } = await client.query(verifyQuery, [verifyParam])

    await client.query('COMMIT')

    console.log('Admin profile updated:', verify[0] || null)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Grant admin failed:', err.message || err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
