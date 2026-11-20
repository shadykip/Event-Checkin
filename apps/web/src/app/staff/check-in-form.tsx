"use client";

import { useCallback, useState, type FormEvent } from "react";
import PassCamera from "./pass-camera";
import styles from "./staff-styles";

type Admission = {
  status: "checked_in" | "already_checked_in";
  guestName: string;
  checkedInAt: string;
  checkedInBy: string;
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
      <h3 className={styles.sectionTitle}>Guest check-in</h3>

      <div aria-live="polite" aria-atomic="true">
        {admission && (
          <div
            className={[
              styles.feedback,
              admission.status === "checked_in" ? styles.success : styles.repeat,
              "mt-4",
            ].join(" ")}
          >
            <strong>
              {admission.status === "checked_in"
                ? "Checked in"
                : "Already checked in"}
              {" — "}
              {admission.guestName}
            </strong>

            <p className="mt-1 text-sm">
              <time dateTime={admission.checkedInAt}>
                {admissionTime.format(new Date(admission.checkedInAt))}
              </time>
              {" · Nairobi time · "}
              {admission.checkedInBy}
            </p>
          </div>
        )}
      </div>

      {mode === "idle" && (
        <div className={styles.stack}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => begin("camera")}
          >
            {admission ? "Scan next guest" : "Scan guest QR"}
          </button>

          <button
            type="button"
            className={styles.textButton}
            onClick={() => begin("manual")}
          >
            Enter pass manually
          </button>
        </div>
      )}

      {mode === "camera" && (
        <>
          <PassCamera onRead={acceptScan} onClose={() => begin("idle")} />

          <button
            type="button"
            className={styles.textButton}
            onClick={() => begin("manual")}
          >
            Enter pass manually
          </button>
        </>
      )}

      {(mode === "manual" || mode === "scanned") && (
        <form className={styles.stack} onSubmit={submit}>
          {mode === "manual" ? (
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
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />

              <span className="text-sm font-normal text-slate-600">
                Paste the 43-character token from the guest pass.
              </span>
            </label>
          ) : (
            <p role="status">QR captured. Confirm to check in this guest.</p>
          )}

          {error && (
            <p role="alert" className={`${styles.feedback} ${styles.error}`}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className={styles.primary}
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