import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Client } from 'pg';

test('three tickets cannot take two seats, and only one buyer can reserve the last pair', async () => {
  const base = process.env.API_BASE_URL;
  assert.ok(base, 'Set API_BASE_URL to the development Nest API.');
  const db = new Client(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: '127.0.0.1',
          port: Number(process.env.POSTGRES_PORT || 5433),
          user: 'event_app',
          password: process.env.POSTGRES_PASSWORD,
          database: 'event_checkin',
        },
  );
  const eventId = randomUUID();
  const tierId = randomUUID();
  const slug = 'qa-solo-' + eventId;
  const url = new URL(`/events/${slug}/ticket-tiers/${tierId}/reservations`, base);

  function request(quantity) {
    const checkoutKey = randomUUID();
    return {
      checkoutKey,
      guestName: 'Test buyer',
      guestEmail: `buyer-${checkoutKey}@example.test`,
      quantity,
      attendees: Array.from({ length: quantity }, (_, i) => ({
        guestName: `Guest ${i + 1}`,
        guestEmail: `guest-${i + 1}-${checkoutKey}@example.test`,
      })),
    };
  }
  async function reserve(body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, receipt: await response.json() };
  }
  async function counts() {
    const { rows } = await db.query(
      `
      SELECT (SELECT count(*)::int FROM ticket_purchases WHERE tier_id = $1) AS purchases,
             (SELECT count(*)::int FROM ticket_orders WHERE tier_id = $1) AS tickets`,
      [tierId],
    );
    return rows[0];
  }

  await db.connect();
  try {
    await db.query(
      `INSERT INTO events (id, slug, name, venue, starts_at, updated_at)
      VALUES ($1, $2, 'Quantity test', 'Test venue', now() + interval '1 day', now())`,
      [eventId, slug],
    );
    const tier = await db.query(
      `
      INSERT INTO ticket_tiers (id, event_id, name, name_key, price_minor, capacity, sales_end_at, updated_at)
      VALUES ($1, $2, 'Solo', 'solo', 50000, 2, now() + interval '6 minutes', now())
      RETURNING sales_end_at`,
      [tierId, eventId],
    );

    const rejected = await reserve(request(3));
    assert.equal(rejected.status, 409, JSON.stringify(rejected.receipt));
    assert.match(rejected.receipt.message, /only 2 tickets remain/i);
    assert.deepEqual(await counts(), { purchases: 0, tickets: 0 });

    const buyers = [request(2), request(2)];
    const results = await Promise.all(buyers.map(reserve));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const winner = results.findIndex((r) => r.status === 200);
    assert.equal(results[winner].receipt.amountMinor, 100000);
    assert.equal(results[winner].receipt.expiresAt, tier.rows[0].sales_end_at.toISOString());
    assert.deepEqual(await reserve(buyers[winner]), results[winner]);
    assert.deepEqual(await counts(), { purchases: 1, tickets: 2 });
    const tickets = await db.query(
      `
      SELECT ticket_number, amount_minor, paid_at IS NULL AND invitation_id IS NULL AS pending
      FROM ticket_orders WHERE purchase_id = $1 ORDER BY ticket_number`,
      [results[winner].receipt.purchaseId],
    );
    assert.deepEqual(tickets.rows, [
      { ticket_number: 1, amount_minor: 50000, pending: true },
      { ticket_number: 2, amount_minor: 50000, pending: true },
    ]);
  } finally {
    try {
      await db.query('BEGIN');
      await db.query('DELETE FROM ticket_orders WHERE tier_id = $1', [tierId]);
      await db.query('DELETE FROM ticket_purchases WHERE tier_id = $1', [tierId]);
      await db.query('DELETE FROM ticket_tiers WHERE id = $1', [tierId]);
      await db.query('DELETE FROM events WHERE id = $1', [eventId]);
      await db.query('COMMIT');
    } finally {
      await db.end();
    }
  }
});
