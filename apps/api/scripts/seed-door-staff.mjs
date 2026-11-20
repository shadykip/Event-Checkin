import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import { config } from 'dotenv';
import pg from 'pg';

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const eventSlug = 'nairobi-developer-meetup';

const doorStaff = {
  name: 'Demo Door Staff',
  email: 'door.staff@example.test',
  role: 'DOOR_STAFF',
};

const organizer = {
  name: 'Demo Organizer',
  email: 'organizer@example.test',
  role: 'ORGANIZER',
};

function selectAccount(args) {
  if (args.length === 0) return doorStaff;
  if (args.length === 1 && args[0] === '--organizer') return organizer;

  throw new Error('Usage: node scripts/seed-door-staff.mjs [--organizer]');
}

async function main() {
  const account = selectAccount(process.argv.slice(2));

  const client = new pg.Client({
    host: '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5433),
    database: 'event_checkin',
    user: 'event_app',
    password: process.env.POSTGRES_PASSWORD,
  });

  const password = randomBytes(18).toString('base64url');
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    const eventResult = await client.query(
      'SELECT id FROM events WHERE slug = $1',
      [eventSlug],
    );

    if (eventResult.rowCount !== 1) {
      throw new Error(
        `Event not found: ${eventSlug}. Run the event seed first.`,
      );
    }

    const inserted = await client.query(
      `INSERT INTO staff_accounts (id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [randomUUID(), account.name, account.email, passwordHash],
    );

    const staffResult = await client.query(
      `SELECT id, is_active
       FROM staff_accounts
       WHERE email = $1
       FOR UPDATE`,
      [account.email],
    );

    const staff = staffResult.rows[0];

    if (!staff) {
      throw new Error(`Could not find staff account: ${account.email}`);
    }

    if (!staff.is_active) {
      throw new Error(`Staff account is inactive: ${account.email}`);
    }

    await client.query(
      `INSERT INTO event_staff_assignments (event_id, staff_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, staff_id) DO UPDATE
       SET role = EXCLUDED.role
       WHERE event_staff_assignments.role IS DISTINCT FROM EXCLUDED.role`,
      [eventResult.rows[0].id, staff.id, account.role],
    );

    await client.query('COMMIT');

    console.log(
      `Assigned ${account.email} to ${eventSlug} as ${account.role}.`,
    );

    if (inserted.rowCount === 1) {
      console.log(`Demo password (shown once): ${password}`);
    } else {
      console.log('Existing account retained. Use its original password.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
