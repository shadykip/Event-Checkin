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

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const base = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3002';
  const link = new URL('/staff/reset-password', base);
  link.hash = token;

  await transport.sendMail({
    from: {
      name: 'Event Check-in',
      address: 'invitations@example.test',
    },
    to: { address: email, name: '' },
    subject: 'Reset your Event Check-in staff password',
    text: [
      'A password reset was requested for your Event Check-in staff account.',
      '',
      'Open this link to choose a new password:',
      link.href,
      '',
      'The link expires in 30 minutes and can be used once.',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
  });
}

export async function sendCheckoutRecoveryEmail(order: {
  id: string;
  checkoutKey: string;
  buyerName: string;
  buyerEmail: string;
}): Promise<void> {
  const base = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3002';
  const link = new URL(`/checkout/${order.id}`, base);
  link.hash = order.checkoutKey;

  await transport.sendMail({
    from: {
      name: 'Event Check-in',
      address: 'invitations@example.test',
    },
    to: { name: order.buyerName, address: order.buyerEmail },
    subject: 'Your Event Check-in booking link',
    text: [
      `Hello ${order.buyerName},`,
      '',
      'Use this private link to reopen your booking and check your payment status:',
      link.href,
      '',
      `Order reference: ticket-${order.id}`,
      '',
      'The link can also open tickets that have already been paid for.',
      'Keep it private. If you did not request it, you can ignore this email.',
    ].join('\n'),
  });
}

export async function sendStaffSetupEmail(
  name: string,
  email: string,
  eventName: string,
  token: string,
): Promise<void> {
  const base = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3002';
  const link = new URL('/staff/reset-password', base);
  link.hash = token;

  await transport.sendMail({
    from: {
      name: 'Event Check-in',
      address: 'invitations@example.test',
    },
    to: { name, address: email },
    subject: `Set up your Event Check-in access for ${eventName}`,
    text: [
      `Hello ${name},`,
      '',
      `You have been invited as door staff for ${eventName}.`,
      'Open this private link to set your password:',
      link.href,
      '',
      'The link expires in 30 minutes and can be used once.',
      'After setting your password, sign in to access the event check-in screen.',
      'If you did not expect this invitation, you can ignore this email.',
    ].join('\n'),
  });
}
