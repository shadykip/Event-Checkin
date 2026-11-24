import { randomBytes, randomUUID } from 'node:crypto';
import { PaystackService } from '../src/events/paystack.service';
import { TicketCheckoutRepository } from '../src/events/ticket-checkout.repository';
import { TicketPaymentService } from '../src/events/ticket-payment.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('individual ticket quantities', () => {
  const db = new PrismaService();
  const checkout = new TicketCheckoutRepository(db);
  const provider = new PaystackService();
  const payments = new TicketPaymentService(db, provider);
  const buyer = {
    guestName: 'First attendee',
    guestEmail: 'first@example.test',
  };
  const friend = {
    guestName: 'Second attendee',
    guestEmail: 'second@example.test',
  };
  const originalSecret = process.env.PAYMENT_PASS_SECRET;
  let eventId: string, tierId: string, slug: string, key: string;

  beforeAll(() => {
    process.env.PAYMENT_PASS_SECRET = randomBytes(32).toString('hex');
  });
  beforeEach(async () => {
    slug = 'qa-quantity-' + randomUUID();
    key = randomUUID();
    const event = await db.event.create({
      data: {
        slug,
        name: 'Quantity test',
        venue: 'Test venue',
        startsAt: new Date(Date.now() + 86400000),
        ticketTiers: {
          create: {
            name: 'HOPE',
            nameKey: 'hope',
            capacity: 2,
            priceMinor: 10000,
          },
        },
      },
      include: { ticketTiers: true },
    });
    eventId = event.id;
    tierId = event.ticketTiers[0].id;
    jest
      .spyOn(provider, 'initialize')
      .mockResolvedValue('https://checkout.paystack.com/test');
    jest.spyOn(provider, 'verify').mockImplementation(async (id) => ({
      reference: 'ticket-' + id,
      status: 'success',
      currency: 'KES',
      domain: 'test',
      amount: 20000,
      paid_at: new Date().toISOString(),
    }));
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await db.$transaction([
      db.ticketOrder.deleteMany({ where: { tierId } }),
      db.ticketPurchase.deleteMany({ where: { tierId } }),
      db.invitation.deleteMany({ where: { eventId } }),
      db.ticketTier.deleteMany({ where: { eventId } }),
      db.event.delete({ where: { id: eventId } }),
    ]);
  });
  afterAll(async () => {
    if (originalSecret === undefined) delete process.env.PAYMENT_PASS_SECRET;
    else process.env.PAYMENT_PASS_SECRET = originalSecret;
    await db.$disconnect();
  });
  async function reserve(multiple = false) {
    const receipt = await checkout.reserve({
      slug,
      tierId,
      checkoutKey: key,
      ...buyer,
      attendees: multiple ? [buyer, friend] : undefined,
    });
    return 'purchaseId' in receipt ? receipt.purchaseId : receipt.id;
  }

  it('resizes a single hold at the same URL and deadline, verifies the total and issues one pass per attendee', async () => {
    const id = await reserve();
    const original = await payments.status(id, key, false);
    const edit = () => payments.changeQuantity(id, key, 1, 2, [friend]);
    await expect(
      payments.changeQuantity(id, randomUUID(), 1, 2, [friend]),
    ).rejects.toThrow('unavailable');
    const changes = await Promise.all([edit(), edit()]);
    expect(changes[0]).toEqual(changes[1]);
    expect(changes[0]).toMatchObject({
      quantity: 2,
      amountMinor: 20000,
      expiresAt: original.expiresAt,
    });
    expect(await db.ticketOrder.count({ where: { tierId } })).toBe(2);
    await expect(payments.start(id, key, 10000)).rejects.toThrow(
      'total changed',
    );
    await Promise.all([
      payments.start(id, key, 20000),
      payments.start(id, key, 20000),
    ]);
    expect(provider.initialize).toHaveBeenCalledTimes(1);
    expect(provider.initialize).toHaveBeenCalledWith({
      id,
      amountMinor: 20000,
      currency: 'KES',
      guestEmail: buyer.guestEmail,
    });
    await expect(payments.changeQuantity(id, key, 2, 1, [])).rejects.toThrow(
      'before payment',
    );
    await Promise.all([payments.reconcile(id), payments.reconcile(id)]);
    const result = await payments.status(id, key, true);
    expect(result).toMatchObject({
      state: 'paid',
      quantity: 2,
      passes: [{ guestName: buyer.guestName }, { guestName: friend.guestName }],
    });
    const rows = await db.ticketOrder.findMany({
      where: { purchaseId: id },
      select: { invitationId: true, paidAt: true, recoveryAfter: true },
    });
    expect(
      rows.every((row) => row.invitationId && row.paidAt && row.recoveryAfter),
    ).toBe(true);
    expect(new Set(rows.map((r) => r.invitationId)).size).toBe(2);
  });

  it('releases only removed seats and rejects additions after another buyer claims the last place', async () => {
    const id = await reserve(true);
    await payments.changeQuantity(id, key, 2, 1, []);
    await checkout.reserve({
      slug,
      tierId,
      checkoutKey: randomUUID(),
      ...friend,
    });
    await expect(
      payments.changeQuantity(id, key, 1, 2, [friend]),
    ).rejects.toThrow('at most 1 ticket');
    expect(await payments.status(id, key, false)).toMatchObject({
      quantity: 1,
      amountMinor: 10000,
    });
    expect(provider.initialize).not.toHaveBeenCalled();
  });

  it('places the whole payment in review if one attendee receives a separate invitation before fulfillment', async () => {
    const id = await reserve(true);
    await payments.start(id, key, 20000);
    await db.invitation.create({
      data: { eventId, ...friend, tokenHash: randomBytes(32).toString('hex') },
    });
    await payments.reconcile(id);
    expect(await payments.status(id, key, true)).toMatchObject({
      state: 'review',
    });
    expect(await db.invitation.count({ where: { eventId } })).toBe(1);
    expect(
      await db.ticketOrder.count({
        where: { purchaseId: id, invitationId: { not: null } },
      }),
    ).toBe(0);
  });

  it('checks the purchase total before issuing any of its passes', async () => {
    const id = await reserve(true);
    await payments.start(id, key, 20000);
    jest.mocked(provider.verify).mockResolvedValueOnce({
      reference: 'ticket-' + id,
      currency: 'KES',
      domain: 'test',
      status: 'success',
      amount: 10000,
      paid_at: new Date().toISOString(),
    });
    expect(await payments.status(id, key, true)).toMatchObject({
      state: 'review',
    });
    expect(await db.invitation.count({ where: { eventId } })).toBe(0);
  });

  it('serializes a payment from one tab against a quantity change from another', async () => {
    const id = await reserve();
    const [payment, edit] = await Promise.allSettled([
      payments.start(id, key, 10000),
      payments.changeQuantity(id, key, 1, 2, [friend]),
    ]);
    expect([payment.status, edit.status].sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const status = await payments.status(id, key, false);
    if (payment.status === 'fulfilled') {
      expect(status).toMatchObject({ quantity: 1, amountMinor: 10000 });
      expect(provider.initialize).toHaveBeenCalledTimes(1);
    } else {
      expect(status).toMatchObject({ quantity: 2, amountMinor: 20000 });
      expect(provider.initialize).not.toHaveBeenCalled();
    }
  });

  it('keeps one five-person group ticket as one charge and one QR pass', async () => {
    await db.ticketTier.update({
      where: { id: tierId },
      data: { peoplePerTicket: 5 },
    });
    const id = await reserve();
    await expect(
      payments.changeQuantity(id, key, 1, 2, [friend]),
    ).rejects.toThrow('individual-ticket');
    await payments.start(id, key);
    jest
      .mocked(provider.verify)
      .mockResolvedValueOnce({
        reference: 'ticket-' + id,
        currency: 'KES',
        domain: 'test',
        status: 'success',
        amount: 10000,
        paid_at: new Date().toISOString(),
      });
    expect(await payments.status(id, key, true)).toMatchObject({
      state: 'paid',
      quantity: 1,
      peoplePerTicket: 5,
      passPath: expect.stringMatching(/^\/pass#/),
    });
    expect(await db.invitation.count({ where: { eventId } })).toBe(1);
  });
});
