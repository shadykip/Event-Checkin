import type { RsvpStatus } from '../generated/prisma/client';

type GuestRow = {
  guestName: string;
  guestEmail: string;
  rsvpStatus: RsvpStatus;
  revokedAt: Date | null;
  checkIns: { checkedInAt: Date }[];
};

const rsvpLabels: Record<RsvpStatus, string> = {
  ACCEPTED: 'Going',
  DECLINED: 'Can’t attend',
  PENDING: 'Awaiting response',
};

const nairobiTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Nairobi',
  dateStyle: 'medium',
  timeStyle: 'medium',
});

function csvCell(value: string): string {
  // Keep guest-entered names and emails as text when opened in a spreadsheet.
  const needsTextPrefix = /^[\t\r\n]/u.test(value) || /^\s*[=+\-@]/u.test(value);
  const text = needsTextPrefix ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

export function guestRosterCsv(guests: GuestRow[]): string {
  const lines = [
    ['Guest name', 'Email', 'RSVP', 'Admission', 'Check-in (Africa/Nairobi)']
      .map(csvCell)
      .join(','),
  ];

  for (const guest of guests) {
    const checkIn = guest.checkIns[0];
    let admission = 'Expected';
    if (checkIn) admission = 'Checked in';
    else if (guest.revokedAt) admission = 'Revoked';

    lines.push(
      [
        guest.guestName,
        guest.guestEmail,
        rsvpLabels[guest.rsvpStatus],
        admission,
        checkIn ? nairobiTime.format(checkIn.checkedInAt) : '',
      ].map(csvCell).join(','),
    );
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
