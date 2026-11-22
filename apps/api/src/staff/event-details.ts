import { BadRequestException } from '@nestjs/common';
import { convert } from 'html-to-text';
import sanitizeHtml from 'sanitize-html';

type EventDetailsInput = {
  name: unknown;
  venue: unknown;
  startsAt: unknown;
  description?: unknown;
  descriptionHtml?: unknown;
};

function requiredText(value: unknown, label: string, limit: number) {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text || text.length > limit) {
    throw new BadRequestException(
      `Enter ${label} of 1 to ${limit} characters.`,
    );
  }

  return text;
}

function parseNairobiTime(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  ) {
    throw new BadRequestException('Enter a valid Nairobi date and time.');
  }

  const date = new Date(`${value}:00+03:00`);
  const wallTime = new Date(date.getTime() + 3 * 60 * 60 * 1000);

  if (
    !Number.isFinite(date.getTime()) ||
    wallTime.toISOString().slice(0, 16) !== value
  ) {
    throw new BadRequestException('Enter a valid Nairobi date and time.');
  }

  return date;
}

function parseDescription(plain: unknown, rich: unknown) {
  if (rich !== undefined) {
    if (typeof rich !== 'string' || Buffer.byteLength(rich, 'utf8') > 32_768) {
      throw new BadRequestException('The formatted description is too large.');
    }

    const html = sanitizeHtml(rich, {
      allowedTags: ['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li'],
      allowedAttributes: {},
    });

    const text = convert(html, {
      wordwrap: false,
      selectors: [
        { selector: 'h2', options: { uppercase: false } },
        { selector: 'h3', options: { uppercase: false } },
      ],
    }).trim();

    if (text.length > 3000) {
      throw new BadRequestException(
        'Keep the description within 3,000 characters, including list markers.',
      );
    }

    return {
      description: text || null,
      descriptionHtml: text ? html : null,
    };
  }

  if (plain !== undefined && typeof plain !== 'string') {
    throw new BadRequestException('Enter a valid description.');
  }

  const text = typeof plain === 'string' ? plain.trim() : '';

  if (text.length > 3000) {
    throw new BadRequestException(
      'Keep the description within 3,000 characters.',
    );
  }

  return { description: text || null, descriptionHtml: null };
}

export function parseEventDetails(input: EventDetailsInput) {
  return {
    name: requiredText(input.name, 'an event name', 160),
    venue: requiredText(input.venue, 'a venue', 200),
    startsAt: parseNairobiTime(input.startsAt),
    ...parseDescription(input.description, input.descriptionHtml),
  };
}
