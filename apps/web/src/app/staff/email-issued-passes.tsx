"use client";

import { useRef, useState } from "react";
import styles from "./staff-styles";

type Pass = {
    record: number;
    guestName: string;
    guestEmail: string;
    url: string;
};

type Delivery = {
    state: "sending" | "accepted" | "failed";
    message: string;
};

type Props = {
    slug: string;
    passes: Pass[];
    disabled: boolean;
    onBusyChange: (busy: boolean) => void;
};

export default function EmailIssuedPasses({
    slug,
    passes,
    disabled,
    onBusyChange,
}: Props) {
    const running = useRef(false);
    const [busy, setBusy] = useState(false);
    const [deliveries, setDeliveries] = useState<Record<number, Delivery>>({});

    const accepted = passes.filter(
        (pass) => deliveries[pass.record]?.state === "accepted",
    ).length;
    const failed = passes.filter(
        (pass) => deliveries[pass.record]?.state === "failed",
    ).length;

    async function send() {
        if (running.current || disabled) return;

        const pending = passes.filter(
            (pass) => deliveries[pass.record]?.state !== "accepted",
        );
        if (pending.length === 0) return;

        running.current = true;
        setBusy(true);
        onBusyChange(true);

        function update(record: number, state: Delivery["state"], message: string) {
            setDeliveries((previous) => ({
                ...previous,
                [record]: { state, message },
            }));
        }

        try {
            for (const pass of pending) {
                update(pass.record, "sending", "Sending…");

                try {
                    const response = await fetch(
                        `/api/staff/events/${encodeURIComponent(slug)}/invitations/email`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                token: new URL(pass.url).hash.slice(1),
                            }),
                            cache: "no-store",
                        },
                    );

                    if (!response.ok) {
                        const detail = await response.json().catch(() => null);
                        const message = typeof detail?.message === "string"
                            ? detail.message
                            : "Email delivery could not be confirmed.";

                        update(pass.record, "failed", message);

                        // These failures can affect the whole batch.
                        if ([401, 403, 429].includes(response.status) || response.status >= 500) {
                            break;
                        }
                        continue;
                    }

                    update(pass.record, "accepted", "Accepted by mail server");
                } catch {
                    update(
                        pass.record,
                        "failed",
                        "Connection interrupted. Check the inbox before retrying.",
                    );
                    break;
                }
            }
        } finally {
            running.current = false;
            setBusy(false);
            onBusyChange(false);
        }
    }

    if (passes.length === 0) return null;

    return (
        <section className="space-y-3 rounded-lg border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-950">Email issued passes</h4>

            <p role="status" className="text-sm text-slate-700">
                Accepted: {accepted} of {passes.length} · Failed: {failed}
                {" · "}Waiting: {passes.filter((pass) => !deliveries[pass.record]).length}
            </p>

            <ul className="divide-y divide-slate-200">
                {passes.map((pass) => {
                    const delivery = deliveries[pass.record];
                    return (
                        <li
                            key={pass.record}
                            className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                        >
                            <span>
                                <strong>{pass.guestName}</strong>
                                <span className="ml-2 break-all text-slate-600">
                                    {pass.guestEmail}
                                </span>
                            </span>
                            <span className={
                                delivery?.state === "failed"
                                    ? "text-red-700"
                                    : delivery?.state === "accepted"
                                        ? "text-teal-800"
                                        : "text-slate-600"
                            }>
                                {delivery?.message ?? "Waiting"}
                            </span>
                        </li>
                    );
                })}
            </ul>

            {accepted < passes.length && (
                <button
                    type="button"
                    className={styles.primary}
                    onClick={send}
                    disabled={busy || disabled}
                >
                    {busy
                        ? "Sending emails…"
                        : failed > 0
                            ? "Retry remaining emails"
                            : "Email issued passes"}
                </button>
            )}
        </section>
    );
}
