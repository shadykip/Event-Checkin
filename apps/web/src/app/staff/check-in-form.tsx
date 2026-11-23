"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import PassCamera from "./pass-camera";
import styles from "./staff-styles";

type Balance = {
  status: "preview" | "checked_in" | "already_checked_in" | "confirmation_replayed";
  guestName: string;
  ticketTier: string | null;
  capacity: number;
  admitted: number;
  remaining: number;
  quantity?: number;
  checkedInAt: string | null;
  checkedInBy: string | null;
};

type Mode = "idle" | "camera" | "manual" | "captured";
type Attempt = { requestId: string; quantity: number };

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const time = new Intl.DateTimeFormat("en-KE", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Africa/Nairobi",
});

export default function CheckInForm({
  slug, onConfirmed,
}: { slug: string; onConfirmed: () => void }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [token, setToken] = useState("");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const running = useRef(false);

  function begin(next: Mode) {
    setToken("");
    setBalance(null);
    setQuantity("1");
    setAttempt(null);
    setError("");
    setMode(next);
  }

  const acceptScan = useCallback((value: string) => {
    setToken(value);
    setMode("captured");
    setError("");
  }, []);

  async function send(action: "preview" | "admit") {
    if (running.current || !tokenPattern.test(token.trim())) return;

    const count = Number(quantity);
    let confirmation = attempt;
    if (action === "admit" && !confirmation) {
      if (!balance || !Number.isSafeInteger(count) || count < 1 || count > balance.remaining) return;
      confirmation = { requestId: crypto.randomUUID(), quantity: count };
      setAttempt(confirmation);
    }

    running.current = true;
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/staff/events/${encodeURIComponent(slug)}/check-ins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          token: token.trim(),
          action,
          ...(action === "admit" ? confirmation : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status >= 500) throw new Error("Unknown outcome");
        setError(
          typeof data.message === "string" ? data.message : "Could not check this pass.",
        );
        setAttempt(null);
        setBalance(null);
        return;
      }

      setBalance(data as Balance);
      setAttempt(null);
      setQuantity("1");

      if (action === "admit") {
        setToken("");
        setMode("idle");
        onConfirmed();
      }
    } catch {
      setError(action === "admit"
        ? "Confirmation interrupted. Retry this confirmation before admitting anyone else."
        : "Could not read the pass. Try again.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send("preview");
  }

  const inspecting = balance?.status === "preview";
  const canConfirm = Number.isInteger(Number(quantity)) &&
    Number(quantity) >= 1 && Number(quantity) <= (balance?.remaining ?? 0);

  return (
    <section className={styles.panel}>
      <h3 className={styles.sectionTitle}>Guest check-in</h3>

      {mode === "camera" && (
        <PassCamera onRead={acceptScan} onManual={() => begin("manual")} onClose={() => begin("idle")} />
      )}

      {!balance && (mode === "manual" || mode === "captured") && (
        <form className={styles.stack} onSubmit={preview}>
          {mode === "manual" ? (
            <label className={styles.label}>
              Guest pass token
              <input
                className={styles.input} type="password" value={token}
                onChange={(event) => { setToken(event.target.value); setError(""); }}
                disabled={busy} autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false}
              />
            </label>
          ) : <p role="status">QR captured. View the pass to check its balance.</p>}

          <button className={styles.primary} disabled={busy || !tokenPattern.test(token.trim())}>
            {busy ? "Reading pass…" : "View pass"}
          </button>
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => begin("idle")}>
            Cancel
          </button>
        </form>
      )}

      {balance && (
        <div className={styles.stack}>
          <div role="status" className={`${styles.feedback} ${balance.status === "checked_in" ? styles.success : styles.repeat
            }`}>
            <strong>
              {balance.status === "confirmation_replayed" ? "Already confirmed" :
                balance.status === "already_checked_in" ? "Already checked in" :
                  balance.status === "checked_in" ? `Admitted ${balance.quantity}` :
                    balance.remaining === 0 ? "Fully admitted" : "Pass balance"}
              {" · "}{balance.guestName}
            </strong>
            {balance.ticketTier && <p>{balance.ticketTier}</p>}
            <p>{balance.admitted} of {balance.capacity} admitted · {balance.remaining} remaining</p>
            {balance.checkedInAt && (
              <p>{time.format(new Date(balance.checkedInAt))} · Nairobi time · {balance.checkedInBy}</p>
            )}
          </div>

          {inspecting && balance.remaining > 0 && (
            <>
              {balance.capacity > 1 && (
                <label className={styles.label}>
                  People entering now
                  <input className={styles.input} type="number" min="1" max={balance.remaining}
                    step="1" value={quantity} disabled={busy || !!attempt}
                    onChange={(event) => setQuantity(event.target.value)} />
                </label>
              )}
              <button type="button" className={styles.primary}
                disabled={busy || !canConfirm} onClick={() => void send("admit")}>
                {busy ? "Confirming…" : attempt ? "Retry same confirmation" :
                  `Admit ${quantity} ${Number(quantity) === 1 ? "person" : "people"}`}
              </button>
            </>
          )}
          {inspecting && !attempt && (
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => begin("idle")}>
              {balance.remaining === 0 ? "Done" : "Cancel"}
            </button>
          )}
        </div>
      )}

      {error && <p role="alert" className={`${styles.feedback} ${styles.error}`}>{error}</p>}

      {mode === "idle" && (
        <div className={styles.stack}>
          <button type="button" className={styles.primary} onClick={() => begin("camera")}>
            {balance ? "Scan next guest" : "Scan guest QR"}
          </button>
          <button type="button" className={styles.secondary} onClick={() => begin("manual")}>
            Enter pass manually
          </button>
        </div>
      )}
    </section>
  );
}