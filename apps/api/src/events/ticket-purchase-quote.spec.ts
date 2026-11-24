import { Test, TestingModule } from '@nestjs/testing';
import {
  MAX_TICKETS_PER_PURCHASE,
  quoteTicketPurchase,
  TicketPurchaseInputError,
} from './ticket-purchase-quote';

describe('quoteTicketPurchase', () => {
  const solo = {
    unitAmountMinor: 50_000,
    peoplePerTicket: 1,
  };

  it('defaults to one ticket', () => {
    expect(quoteTicketPurchase(solo)).toEqual({
      quantity: 1,
      unitAmountMinor: 50_000,
      amountMinor: 50_000,
      peoplePerTicket: 1,
    });
  });

  it('prices three individual tickets as one purchase', () => {
    expect(quoteTicketPurchase({ ...solo, quantity: 3 })).toEqual({
      quantity: 3,
      unitAmountMinor: 50_000,
      amountMinor: 150_000,
      peoplePerTicket: 1,
    });
  });

  it('accepts the maximum permitted quantity', () => {
    expect(
      quoteTicketPurchase({
        ...solo,
        quantity: MAX_TICKETS_PER_PURCHASE,
      }).amountMinor,
    ).toBe(500_000);
  });

  it.each([null, 0, -1, 1.5, '3', NaN, Infinity, 11])(
    'rejects invalid quantity %s',
    (quantity) => {
      expect(() => quoteTicketPurchase({ ...solo, quantity })).toThrow(
        TicketPurchaseInputError,
      );
    },
  );

  it('keeps one Mbogi ticket as a five-person pass', () => {
    expect(
      quoteTicketPurchase({
        quantity: 1,
        unitAmountMinor: 250_000,
        peoplePerTicket: 5,
      }),
    ).toEqual({
      quantity: 1,
      unitAmountMinor: 250_000,
      amountMinor: 250_000,
      peoplePerTicket: 5,
    });
  });

  it('rejects multiple group tickets in one purchase', () => {
    expect(() =>
      quoteTicketPurchase({
        quantity: 2,
        unitAmountMinor: 250_000,
        peoplePerTicket: 5,
      }),
    ).toThrow('Group tickets must be purchased one at a time.');
  });

  it('rejects a total that cannot fit the monetary database column', () => {
    expect(() =>
      quoteTicketPurchase({
        ...solo,
        quantity: 2,
        unitAmountMinor: 1_500_000_000,
      }),
    ).toThrow('The purchase total is too large.');
  });
});
