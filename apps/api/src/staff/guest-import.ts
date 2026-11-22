import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

export function validateGuest(rawName: unknown, rawEmail: unknown) {
  const guestName = typeof rawName === 'string' ? rawName.trim() : '';
  const guestEmail =
    typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  let error = '';

  if (!guestName || guestName.length > 200) {
    error = 'Enter a guest name of 1 to 200 characters.';
  } else if (
    guestEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)
  ) {
    error = 'Enter a valid guest email address.';
  }

  return { guestName, guestEmail, error };
}

export function parseGuestCsv(csv: unknown) {
  if (typeof csv !== 'string' || !csv.trim()) {
    throw new BadRequestException('Choose a CSV file with guest records.');
  }

  if (Buffer.byteLength(csv, 'utf8') > 32 * 1024) {
    throw new BadRequestException('Choose a CSV file of 32 KiB or less.');
  }

  let records: string[][];

  try {
    records = parse(csv, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
  } catch {
    throw new BadRequestException(
      'Could not read the CSV. Check the quoting and use commas between columns.',
    );
  }

  const [header = [], ...rows] = records;
  const columns = header.map((name) => name.trim());
  const nameIndex = columns.indexOf('guestName');
  const emailIndex = columns.indexOf('guestEmail');

  if (columns.length !== 2 || nameIndex < 0 || emailIndex < 0) {
    throw new BadRequestException(
      'Use the two column headers guestName and guestEmail.',
    );
  }

  if (rows.length === 0 || rows.length > 200) {
    throw new BadRequestException('Include between 1 and 200 guest records.');
  }

  return rows.map((fields, index) => {
    const guest = validateGuest(fields[nameIndex], fields[emailIndex]);

    return {
      record: index + 1,
      ...guest,
      error:
        fields.length === 2 ? guest.error : 'Expected exactly two columns.',
    };
  });
}
