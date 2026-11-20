"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import PassCamera from "./pass-camera";
type Admission = {
  status: "checked_in" | "already_checked_in";
  guestName: string;
  checkedInAt: string;
  checkedInBy: string;
};

type Result =
  | { kind: "admission"; admission: Admission }
  | { kind: "error"; message: string };

const admissionTime = new Intl.DateTimeFormat("en-KE", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Africa/Nairobi",
});

export default function CheckInForm({ slug }: { slug: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanReady, setScanReady] = useState(false);

  const acceptScan = useCallback((token: string) => {
    if (inputRef.current) inputRef.current.value = token;

    setResult(null);
    setScanReady(true);
    setCameraOpen(false);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const token = String(new FormData(form).get("token") ?? "").trim();

    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setResult({
        kind: "error",
        message: "Enter the 43-character token from the guest pass.",
      });
      return;
    }
    setCameraOpen(false);
    setScanReady(false);
    setSubmitting(true);
    setResult(null);

    try {
      const response = await fetch(
        `/api/staff/events/${encodeURIComponent(slug)}/check-ins`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const messages: Record<number, string> = {
          401: "Your session has expired. Refresh this page and sign in again.",
          403: "You are no longer assigned to this event.",
          404: "This pass is unavailable for this event. Check the pass and event.",
        };
        throw new Error(
          messages[response.status] ??
          "Could not confirm admission. Submit the same pass again to check its status.",
        );
      }

      const admission: Admission = await response.json();
      setResult({ kind: "admission", admission });
      form.reset();
    } catch (error) {
      setResult({
        kind: "error",
        message:
          error instanceof TypeError
            ? "Connection lost. Submit the same pass again to confirm its status."
            : error instanceof Error
              ? error.message
              : "Could not confirm admission. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <details onToggle={(event) => {
      if (!event.currentTarget.open) setCameraOpen(false);
    }} className="mt-4 border-t border-stone-200 pt-3">
      <summary className="cursor-pointer font-medium">Check in a guest</summary>

      <form onSubmit={submit} className="mt-4 space-y-3">
        {cameraOpen ? (
          <PassCamera onRead={acceptScan} onClose={() => setCameraOpen(false)} />
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setResult(null);
              setScanReady(false);
              if (inputRef.current) inputRef.current.value = "";
              setCameraOpen(true);
            }}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium"
          >
            Scan guest QR
          </button>
        )}

        {scanReady && (
          <p role="status" className="text-sm text-stone-700">
            Pass scanned. Select Confirm check-in to admit this guest.
          </p>
        )}
        <label className="block">
          <span className="text-sm font-medium">Guest pass token</span>
          <input
            name="token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            required
            ref={inputRef}
            readOnly={submitting}
            onChange={() => {
              setScanReady(false);
              setResult(null);
            }}
            className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {submitting ? "Checking pass…" : "Confirm check-in"}
        </button>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {result?.kind === "error" && (
          <p className="mt-4 text-sm text-red-700">{result.message}</p>
        )}

        {result?.kind === "admission" && (
          <div className="mt-4 rounded-md bg-stone-100 p-3">
            <p className="font-semibold">
              {result.admission.status === "checked_in"
                ? "Checked in"
                : "Already checked in"}
              {" — "}{result.admission.guestName}
            </p>
            <p className="mt-1 text-sm text-stone-700">
              {admissionTime.format(new Date(result.admission.checkedInAt))}
              {" · Nairobi time · "}{result.admission.checkedInBy}
            </p>
          </div>
        )}
      </div>
    </details>
  );
}
