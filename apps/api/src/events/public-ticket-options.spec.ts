import { presentPublicTier } from './public-ticket-options';

const now = new Date('2026-11-23T09:00:00.000Z');
const startsAt = new Date('2026-11-28T11:00:00.000Z');
const tier = {
  id: 'mbogi',
  name: 'Mbogi Pass',
  peoplePerTicket: 5,
  priceMinor: 250_000,
  currency: 'KES',
  capacity: 20,
  salesStartAt: null,
  salesEndAt: null,
  _count: { orders: 2 },
};

describe('Public ticket availability', () => {
  it('counts group ticket inventory in tickets and keeps the whole group price', () => {
    const result = presentPublicTier(tier, startsAt, now);
    expect(result.status).toBe('available');
    expect(result.remaining).toBe(18);
    expect(result.peoplePerTicket).toBe(5);
    expect(result.priceMinor).toBe(250_000);
  });

  it('shows a fully committed tier as sold out', () => {
    const result = presentPublicTier(
      { ...tier, _count: { orders: 20 } },
      startsAt,
      now,
    );
    expect(result.status).toBe('sold_out');
    expect(result.remaining).toBe(0);
  });

  it('reopens availability when a hold no longer counts as committed', () => {
    expect(
      presentPublicTier({ ...tier, _count: { orders: 20 } }, startsAt, now)
        .status,
    ).toBe('sold_out');
    const result = presentPublicTier(
      { ...tier, _count: { orders: 19 } },
      startsAt,
      now,
    );
    expect(result.status).toBe('available');
    expect(result.remaining).toBe(1);
  });

  it('keeps inventory nonnegative if capacity is reduced below existing sales', () => {
    const result = presentPublicTier({ ...tier, capacity: 1 }, startsAt, now);
    expect(result.status).toBe('sold_out');
    expect(result.remaining).toBe(0);
  });

  it('opens sales at the exact sales start time', () => {
    const scheduled = { ...tier, salesStartAt: now };
    expect(
      presentPublicTier(scheduled, startsAt, new Date(now.getTime() - 1))
        .status,
    ).toBe('upcoming');
    expect(presentPublicTier(scheduled, startsAt, now).status).toBe(
      'available',
    );
  });

  it('closes sales at the exact sales end time', () => {
    expect(
      presentPublicTier({ ...tier, salesEndAt: now }, startsAt, now).status,
    ).toBe('closed');
  });

  it('closes all ticket options when the event starts', () => {
    expect(presentPublicTier(tier, now, now).status).toBe('closed');
  });
});
