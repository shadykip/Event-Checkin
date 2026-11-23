import type { Prisma } from '../generated/prisma/client';

export async function lockTicketTier(
  tx: Prisma.TransactionClient,
  eventId: string,
  tierId: string,
) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM ticket_tiers
    WHERE id = ${tierId}::uuid AND event_id = ${eventId}::uuid
    FOR UPDATE
  `;

  return rows.length === 1;
}

export async function inventoryTime(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`
    SELECT clock_timestamp() AS now
  `;
  return row.now;
}

export function committedTickets(
  tx: Prisma.TransactionClient,
  tierId: string,
  now: Date,
) {
  return tx.ticketOrder.count({
    where: {
      tierId,
      OR: [{ paidAt: { not: null } }, { expiresAt: { gt: now } }],
    },
  });
}
