import { admissions } from "../../public-events";
import { publicStyles } from "../../public-styles";

type Props = {
  tierName: string;
  peoplePerTicket: number;
  passPath?: string;
  passes?: { ticketNumber: number; guestName: string; passPath?: string }[];
};

export default function PaymentConfirmation({
  tierName,
  peoplePerTicket,
  passPath,
  passes,
}: Props) {
  return (
    <section
      aria-labelledby="payment-confirmation-title"
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6"
    >
      <span
        aria-hidden="true"
        className="mb-5 grid size-14 place-items-center rounded-full bg-emerald-100 text-3xl font-bold text-emerald-800 ring-4 ring-white"
      >
        ✓
      </span>

      <p role="status" className="text-sm font-semibold text-emerald-800">
        Payment confirmed
      </p>

      <h2
        id="payment-confirmation-title"
        className="mt-2 text-2xl font-bold tracking-tight text-emerald-950"
      >
        {passes
          ? "Your tickets"
          : passPath
            ? "Your QR pass is ready"
            : "Get your QR pass"}
      </h2>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="max-w-full break-words rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900">
          {tierName}
        </span>
        <span className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-900">
          {passes
            ? `${passes.length} individual tickets`
            : admissions(peoplePerTicket)}
        </span>
      </div>

      {passes ? (
        <ul className="mt-5 grid gap-3">
          {passes.map((pass) => (
            <li
              key={pass.ticketNumber}
              className="grid gap-2 rounded-xl bg-white p-3"
            >
              <span className="break-words text-sm font-semibold text-slate-950">
                Ticket {pass.ticketNumber} · {pass.guestName}
              </span>
              {pass.passPath ? (
                <a href={pass.passPath} className={publicStyles.secondary}>
                  Open QR pass for {pass.guestName}
                </a>
              ) : (
                <span className="text-sm text-slate-700">
                  Contact the organizer for the current pass.
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : passPath ? (
        <>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-6 text-emerald-950">
            <li>Open your pass and keep its private link for the event.</li>
            <li>Show the QR code to event staff at the entrance.</li>
          </ol>

          {peoplePerTicket > 1 && (
            <p className="mt-4 text-sm leading-6 text-emerald-900">
              This group pass covers up to {peoplePerTicket} people in total.
              Each admission reduces the remaining allowance on this pass.
            </p>
          )}

          <a href={passPath} className={`${publicStyles.primary} mt-6 w-full`}>
            Open my QR pass
          </a>
        </>
      ) : (
        <p className="mt-5 text-sm leading-6 text-emerald-900">
          Your payment is confirmed. Use “Check payment status” below to
          retrieve your pass. You do not need to pay again.
        </p>
      )}
    </section>
  );
}
