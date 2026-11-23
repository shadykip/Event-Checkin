"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import PassCamera from "./pass-camera";
import styles from "./staff-styles";


type Admission = {
  status: "checked_in" | "already_checked_in";
  guestName: string;
  checkedInAt: string;
  checkedInBy: string;
  ticketTier?: string | null;
};

type EntryMode = "idle" | "camera" | "manual" | "scanned";

const passPattern = /^[A-Za-z0-9_-]{43}$/;

const admissionTime = new Intl.DateTimeFormat("en-KE", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Africa/Nairobi",
});

const checkInErrors: Record<number, string> = {
  401: "Your session expired. Refresh this page to sign in.",
  403: "You are no longer assigned to this event.",
  404: "This pass is unavailable for this event. Check the invitation and event name.",
};

type CheckInFormProps = {
  slug: string;
  onConfirmed: () => void;
};

export default function CheckInForm({ slug, onConfirmed }: CheckInFormProps) {
  const [mode, setMode] = useState<EntryMode>("idle");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [admission, setAdmission] = useState<Admission | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const scanButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousMode = useRef<EntryMode>("idle");
  const helpId = useId();

  useEffect(() => {
    const previous = previousMode.current;
    previousMode.current = mode;

    if (mode === "camera") {
      headingRef.current?.focus();
    } else if (mode === "scanned") {
      confirmButtonRef.current?.focus();
    } else if (mode === "idle" && previous !== "idle") {
      scanButtonRef.current?.focus();
    }
  }, [mode]);

  const value = token.trim();
  const valid = passPattern.test(value);

  function begin(next: "idle" | "camera" | "manual") {
    setToken("");
    setError("");
    setAdmission(null);
    setMode(next);
  }

  const acceptScan = useCallback((scannedToken: string) => {
    setToken(scannedToken);
    setError("");
    setMode("scanned");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy || !valid) return;

    setBusy(true);
    setError("");
    setAdmission(null);

    try {
      const response = await fetch(
        `/api/staff/events/${encodeURIComponent(slug)}/check-ins`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: value }),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        setError(
          checkInErrors[response.status] ??
          "Admission could not be confirmed. Retry with the same pass.",
        );
        return;
      }

      const result: Admission = await response.json();

      setAdmission(result);
      setToken("");
      setMode("idle");
      onConfirmed();
    } catch {
      setError(
        "Connection interrupted. Retry with the same pass to confirm admission.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className={`${styles.sectionTitle} rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700`}
      >
        Guest check-in
      </h3>

      <div role="status" aria-atomic="true">
        {admission && (
          <div
            className={[
              styles.feedback,
              admission.status === "checked_in" ? styles.success : styles.repeat,
              "mt-4",
            ].join(" ")}
          >
            <strong className="block break-words text-base">
              {admission.status === "checked_in"
                ? "Checked in"
                : "Already checked in"}
              {" — "}
              {admission.guestName}
            </strong>

            <p className="mt-1 break-words text-sm">
              {admission.status === "already_checked_in" && "Original check-in: "}
              <time dateTime={admission.checkedInAt}>
                {admissionTime.format(new Date(admission.checkedInAt))}
              </time>
              {" · Nairobi time · "}
              {admission.checkedInBy}
            </p>

            {admission.ticketTier && (
              <p className="mt-1 text-sm font-semibold">Ticket · {admission.ticketTier}</p>
            )}
          </div>
        )}
      </div>

      {mode === "idle" && (
        <div className={styles.stack}>
          <button
            ref={scanButtonRef}
            type="button"
            className={`${styles.primary} min-h-12 w-full`}
            onClick={() => begin("camera")}
          >
            {admission ? "Scan next guest" : "Scan guest QR"}
          </button>

          <button
            type="button"
            className={styles.secondary}
            onClick={() => begin("manual")}
          >
            Enter pass manually
          </button>
        </div>
      )}

      {mode === "camera" && (
        <PassCamera
          onRead={acceptScan}
          onManual={() => begin("manual")}
          onClose={() => begin("idle")}
        />
      )}

      {(mode === "manual" || mode === "scanned") && (
        <form className={styles.stack} onSubmit={submit}>
          {mode === "manual" ? (
            <div className="grid gap-2">
              <label className={styles.label}>
                Guest pass token
                <input
                  className={styles.input}
                  type="password"
                  value={token}
                  onChange={(event) => {
                    setToken(event.target.value);
                    setError("");
                  }}
                  aria-describedby={helpId}
                  disabled={busy}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                />
              </label>

              <p id={helpId} className="text-sm leading-6 text-slate-600">
                {value && !valid
                  ? "Check the token. It must contain 43 letters, numbers, hyphens, or underscores."
                  : "Paste the 43-character token from the guest pass."}
              </p>
            </div>
          ) : (
            <p role="status" className="text-sm font-medium text-slate-700">
              QR captured. Confirm to check in this guest.
            </p>
          )}

          {error && (
            <p role="alert" className={`${styles.feedback} ${styles.error}`}>
              {error}
            </p>
          )}

          <button
            ref={confirmButtonRef}
            type="submit"
            className={`${styles.primary} min-h-12 w-full`}
            disabled={busy || !valid}
          >
            {busy ? "Confirming…" : "Confirm check-in"}
          </button>

          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => begin("idle")}
          >
            Cancel
          </button>
        </form>
      )}
    </section>
  );
}