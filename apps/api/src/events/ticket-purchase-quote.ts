export const MAX_TICKETS_PER_PURCHASE = 10;

// Monetary columns currently use PostgreSQL INTEGER.
const MAX_AMOUNT_MINOR = 2_147_483_647;

export class TicketPurchaseInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketPurchaseInputError';
  }
}

type Input = {
  quantity?: unknown;
  unitAmountMinor: number;
  peoplePerTicket: number;
};

export function quoteTicketPurchase(input: Input) {
  const quantity = input.quantity === undefined ? 1 : input.quantity;

  if (
    typeof quantity !== 'number' ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_TICKETS_PER_PURCHASE
  ) {
    throw new TicketPurchaseInputError(
      `Choose between 1 and ${MAX_TICKETS_PER_PURCHASE} tickets.`,
    );
  }

  if (
    !Number.isSafeInteger(input.unitAmountMinor) ||
    input.unitAmountMinor <= 0 ||
    input.unitAmountMinor > MAX_AMOUNT_MINOR
  ) {
    throw new TicketPurchaseInputError('Ticket price is invalid.');
  }

  if (
    !Number.isSafeInteger(input.peoplePerTicket) ||
    input.peoplePerTicket < 1
  ) {
    throw new TicketPurchaseInputError(
      'Ticket admission allowance is invalid.',
    );
  }

  if (input.peoplePerTicket > 1 && quantity !== 1) {
    throw new TicketPurchaseInputError(
      'Group tickets must be purchased one at a time.',
    );
  }

  const amountMinor = input.unitAmountMinor * quantity;

  if (!Number.isSafeInteger(amountMinor) || amountMinor > MAX_AMOUNT_MINOR) {
    throw new TicketPurchaseInputError('The purchase total is too large.');
  }

  return {
    quantity,
    unitAmountMinor: input.unitAmountMinor,
    amountMinor,
    peoplePerTicket: input.peoplePerTicket,
  };
}
