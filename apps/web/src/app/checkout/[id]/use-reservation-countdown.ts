"use client";

import { useEffect, useState } from "react";

export default function useReservationCountdown(expiresAt?: string) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;

    function updateClock() {
      setNow(Date.now());
    }

    const timer = window.setInterval(updateClock, 1000);

    window.addEventListener("focus", updateClock);
    document.addEventListener("visibilitychange", updateClock);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", updateClock);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, [expiresAt]);

  const deadline = expiresAt ? Date.parse(expiresAt) : Number.NaN;

  const secondsLeft =
    now !== null && Number.isFinite(deadline)
      ? Math.max(0, Math.ceil((deadline - now) / 1000))
      : null;

  const label =
    secondsLeft === null
      ? "--:--"
      : `${Math.floor(secondsLeft / 60)
          .toString()
          .padStart(2, "0")}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  return {
    secondsLeft,
    label,
    expired: secondsLeft === 0,
  };
}
