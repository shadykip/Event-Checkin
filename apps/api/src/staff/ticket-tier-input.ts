import { BadRequestException } from '@nestjs/common';

export type TicketTierInput = {
  name?: unknown;
  priceKes?: unknown;
  capacity?: unknown;
  peoplePerTicket?: unknown;
  salesStartAt?: unknown;
  salesEndAt?: unknown;
  archived?: unknown;
  version?: unknown;
};

function parsePrice(value: unknown) {
  if (typeof value !== 'string') {
    throw new BadRequestException('Enter the price in KES.');
  }

  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value.trim());

  if (!match) {
    throw new BadRequestException(
      'Enter a KES amount with up to two decimal places.',
    );
  }

  const minor =
    Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));

  if (minor > 2_147_483_647) {
    throw new BadRequestException('The price exceeds the supported amount.');
  }

  return minor;
}

function parseNairobiDate(value: unknown) {
  if (value === undefined || value === null || value === '') return null;

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  ) {
    throw new BadRequestException('Enter a valid Nairobi date and time.');
  }

  const date = new Date(`${value}:00+03:00`);

  if (!Number.isFinite(date.getTime())) {
    throw new BadRequestException('Enter a valid Nairobi date and time.');
  }

  const local = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  if (local.toISOString().slice(0, 16) !== value) {
    throw new BadRequestException('Enter a valid calendar date.');
  }

  return date;
}

export function parseTicketTier(input: TicketTierInput) {
  const name =
    typeof input.name === 'string'
      ? input.name.trim().replace(/\s+/g, ' ')
      : '';

  if (!name || name.length > 80) {
    throw new BadRequestException('Enter a ticket name of 1 to 80 characters.');
  }

  const people = input.peoplePerTicket;
  if (people !== undefined && (
    typeof people !== 'number' || !Number.isInteger(people) ||
    people < 1 || people > 2147483647
  )) {
    throw new BadRequestException('People per ticket must be a positive whole number.');
  }

  const capacity = input.capacity;
  if (
    typeof capacity !== 'number' ||
    !Number.isSafeInteger(capacity) ||
    capacity < 1 ||
    capacity > 100000
  ) {
    throw new BadRequestException(
      'Ticket quantity must be between 1 and 100,000.',
    );
  }

  if (input.archived !== undefined && typeof input.archived !== 'boolean') {
    throw new BadRequestException('Invalid archive setting.');
  }

  const salesStartAt = parseNairobiDate(input.salesStartAt);
  const salesEndAt = parseNairobiDate(input.salesEndAt);

  if (salesStartAt && salesEndAt && salesEndAt <= salesStartAt) {
    throw new BadRequestException('Sales must end after they start.');
  }

  return {
    name,
    nameKey: name.normalize('NFKC').toLowerCase(),
    priceMinor: parsePrice(input.priceKes),
    currency: 'KES',
    capacity,
    ...(typeof people === 'number' ? { peoplePerTicket: people } : {}),
    salesStartAt,
    salesEndAt,
    archived: input.archived === true,
  };
}
