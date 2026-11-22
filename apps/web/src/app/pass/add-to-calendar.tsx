"use client";

type CalendarEvent = {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
};

function calendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function utcTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

// Calendar lines are folded at 75 UTF-8 bytes. A continuation starts with a space.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let part = "";
  let bytes = 0;

  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      parts.push(part);
      part = " ";
      bytes = 1;
    }
    part += character;
    bytes += size;
  }

  parts.push(part);
  return parts.join("\r\n");
}

export default function AddToCalendar({ event }: { event: CalendarEvent }) {
  function download() {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Event Check-in//Guest Calendar//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${event.id}@event-checkin`,
      `DTSTAMP:${utcTimestamp(new Date())}`,
      `DTSTART:${utcTimestamp(new Date(event.startsAt))}`,
      `SUMMARY:${calendarText(event.name)}`,
      `LOCATION:${calendarText(event.venue)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const file = new Blob([lines.map(foldLine).join("\r\n") + "\r\n"], {
      type: "text/calendar;charset=utf-8",
    });

    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `event-${event.id}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
    >
      Add to calendar
    </button>
  );
}
