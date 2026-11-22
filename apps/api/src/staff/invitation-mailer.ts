import { ServiceUnavailableException } from '@nestjs/common';
import { createTransport } from 'nodemailer';

type InvitationEmail = {
  guestName: string;
  guestEmail: string;
  event: {
    name: string;
    venue: string;
    startsAt: Date;
  };
};

const transport = createTransport({
  host: process.env.SMTP_HOST ?? '127.0.0.1',
  port: Number(process.env.SMTP_PORT ?? '1025'),
  secure: false,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

const eventTime = new Intl.DateTimeFormat('en-KE', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'Africa/Nairobi',
});

export async function sendInvitationEmail(
  invitation: InvitationEmail,
  token: string,
): Promise<void> {
  const base = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3002';
  const link = new URL('/pass', base);
  link.hash = token;

  const { guestName, guestEmail, event } = invitation;

  try {
    await transport.sendMail({
      from: {
        name: 'Event Check-in',
        address: 'invitations@example.test',
      },
      to: { name: guestName, address: guestEmail },
      subject: `Your invitation to ${event.name}`,
      text: [
        `Hello ${guestName},`,
        '',
        `You're invited to ${event.name}.`,
        `Venue: ${event.venue}`,
        `When: ${eventTime.format(event.startsAt)} (Nairobi time)`,
        '',
        'Open your private invitation to RSVP and show your QR code at the entrance:',
        link.href,
        '',
        'Please keep this link private.',
      ].join('\n'),
    });
  } catch {
    throw new ServiceUnavailableException(
      'Email delivery could not be confirmed. Your invitation link is still available.',
    );
  }
}
