import { createHash, randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

async function main() {
  const [slug, rawName, rawEmail] = process.argv.slice(2);
  const guestName = rawName?.trim();
  const guestEmail = rawEmail?.trim().toLowerCase();

  if (!slug || !guestName || !guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    throw new Error('Usage: pass:issue -- <event-slug> "Guest Name" guest@example.com');
  }

  const client = new pg.Client(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: "127.0.0.1",
          port: Number(process.env.POSTGRES_PORT || 5433),
          database: "event_checkin",
          user: "event_app",
          password: process.env.POSTGRES_PASSWORD,
        },
  );

  await client.connect();
  try {
    const event = await client.query(
      "SELECT id, name FROM events WHERE slug = $1",
      [slug],
    );
    if (!event.rowCount) throw new Error(`Event not found: ${slug}`);

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invitationId = randomUUID();

    await client.query("BEGIN");
    try {
      const inserted = await client.query(
        `INSERT INTO invitations (id, event_id, guest_name, guest_email, token_hash)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_id, guest_email) DO NOTHING
         RETURNING id`,
        [invitationId, event.rows[0].id, guestName, guestEmail, tokenHash],
      );

      if (!inserted.rowCount) {
        await client.query("ROLLBACK");
        console.log("This guest already has an invitation for this event.");
        return;
      }

      const lookup = await client.query(
        "SELECT id FROM invitations WHERE token_hash = $1 AND event_id = $2",
        [tokenHash, event.rows[0].id],
      );
      if (lookup.rows[0]?.id !== invitationId) {
        throw new Error("Pass lookup did not resolve to the new invitation.");
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    console.log(`Issued pass for ${guestName} — ${event.rows[0].name}`);
    console.log(`Invitation ID: ${invitationId}`);
    console.log(`Pass token (shown once): ${token}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
