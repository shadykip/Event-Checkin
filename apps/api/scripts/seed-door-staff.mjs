import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import { config } from "dotenv";
import pg from "pg";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const email = "door.staff@example.test";
const eventSlug = "nairobi-developer-meetup";

async function main() {
  const client = new pg.Client({
    host: "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || 5433),
    database: "event_checkin",
    user: "event_app",
    password: process.env.POSTGRES_PASSWORD,
  });

  const password = randomBytes(18).toString("base64url");
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await client.connect();
  try {
    await client.query("BEGIN");

    const event = await client.query(
      "SELECT id FROM events WHERE slug = $1",
      [eventSlug],
    );
    if (!event.rowCount) throw new Error(`Event not found: ${eventSlug}`);

    const inserted = await client.query(
      `INSERT INTO staff_accounts (id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [randomUUID(), "Demo Door Staff", email, passwordHash],
    );

    const staff = await client.query(
      "SELECT id, is_active FROM staff_accounts WHERE email = $1 FOR UPDATE",
      [email],
    );
    if (!staff.rows[0]?.is_active) throw new Error("Demo staff account is inactive.");

    await client.query(
      `INSERT INTO event_staff_assignments (event_id, staff_id)
       VALUES ($1, $2)
       ON CONFLICT (event_id, staff_id) DO NOTHING`,
      [event.rows[0].id, staff.rows[0].id],
    );

    await client.query("COMMIT");

    console.log(`Assigned ${email} to ${eventSlug}.`);
    if (inserted.rowCount === 1) {
      console.log(`Demo password (shown once): ${password}`);
    } else {
      console.log("Existing account retained. Use its original password.");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
