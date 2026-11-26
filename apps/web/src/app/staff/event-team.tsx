"use client";

import { useId, useState, type FormEvent } from "react";
import styles from "./staff-styles";
import ResendStaffSetupButton from "./resend-staff-setup-button";

type Member = {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    role: "ORGANIZER" | "DOOR_STAFF";
};

type TeamResult = {
    message: string;
    members: Member[];
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...options, cache: "no-store" });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Your session expired. Sign in again.");
        }

        throw new Error(
            typeof body?.message === "string"
                ? body.message
                : "Could not reach the staff service. Please try again.",
        );
    }

    return body as T;
}

export default function EventTeam({ slug }: { slug: string }) {
    const panelId = useId();
    const [open, setOpen] = useState(false);
    const [members, setMembers] = useState<Member[] | null>(null);
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const endpoint = `/api/staff/events/${encodeURIComponent(slug)}/team`;

    async function load() {
        setBusy(true);
        setError("");
        setMessage("");
        setConfirmId(null);

        try {
            setMembers(await requestJson<Member[]>(endpoint));
        } catch (cause) {
            setMembers(null);
            setError(cause instanceof Error ? cause.message : "Could not load the team.");
        } finally {
            setBusy(false);
        }
    }

    function toggle() {
        if (open) {
            setOpen(false);
            return;
        }

        setOpen(true);
        void load();
    }

    async function changeAssignment(staffId?: string) {
        if (busy) return;

        setBusy(true);
        setError("");
        setMessage("");

        try {
            const result = staffId
                ? await requestJson<TeamResult>(
                    `${endpoint}/${encodeURIComponent(staffId)}`,
                    { method: "DELETE" },
                )
                : await requestJson<TeamResult>(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: email.trim() }),
                });

            setMembers(result.members);
            setMessage(result.message);
            setConfirmId(null);
            if (!staffId) setEmail("");
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Could not confirm the change. Refresh the team before retrying.",
            );
        } finally {
            setBusy(false);
        }
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void changeAssignment();
    }

    return (
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    Event team
                </h3>

                <button
                    type="button"
                    className={styles.secondary}
                    aria-expanded={open}
                    aria-controls={panelId}
                    disabled={busy}
                    onClick={toggle}
                >
                    {open ? "Hide team" : "Manage team"}
                </button>
            </header>

            <div id={panelId} hidden={!open}>
                <div className="space-y-5 border-t border-slate-200 p-5 sm:p-6">
                    {members !== null && (
                        <>
                            <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
                                <label className={`${styles.label} min-w-0 flex-1 basis-64`}>
                                    Staff email address
                                    <input
                                        className={styles.input}
                                        type="email"
                                        value={email}
                                        maxLength={254}
                                        autoComplete="off"
                                        placeholder="door.staff@example.test"
                                        onChange={(event) => setEmail(event.target.value)}
                                        required
                                        disabled={busy}
                                    />
                                </label>

                                <button type="submit" className={styles.primary} disabled={busy}>
                                    Assign door staff
                                </button>
                            </form>

                            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                                {members.map((member) => (
                                    <li key={member.id} className="p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="break-words font-semibold text-slate-950">
                                                    {member.name}
                                                </p>
                                                <p className="break-all text-sm text-slate-600">
                                                    {member.email}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                    {member.role === "ORGANIZER" ? "Organizer" : "Door staff"}
                                                    {!member.isActive && " · Inactive"}
                                                </span>

                                                {member.role === "DOOR_STAFF" && confirmId !== member.id && (
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        aria-label={`Remove ${member.name} from this event`}
                                                        onClick={() => setConfirmId(member.id)}
                                                        className="min-h-11 rounded-lg px-2 text-sm font-semibold text-red-700 hover:underline"
                                                    >
                                                        Remove
                                                    </button>

                                                )}
                                                {member.role === "DOOR_STAFF" && member.isActive && (
                                                    <ResendStaffSetupButton slug={slug} staffId={member.id} />
                                                )}
                                            </div>
                                        </div>

                                        {confirmId === member.id && (
                                            <div className="mt-3 rounded-xl bg-red-50 p-3">
                                                <p className="text-sm text-red-950">
                                                    Remove {member.name} from this event? They will lose
                                                    check-in access here.
                                                </p>

                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => void changeAssignment(member.id)}
                                                        className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
                                                    >
                                                        Confirm removal
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => setConfirmId(null)}
                                                        className={styles.secondary}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    {busy && <p role="status" className="text-sm">Updating team…</p>}
                    {message && <p role="status" className={`${styles.feedback} ${styles.success}`}>{message}</p>}
                    {error && <p role="alert" className={`${styles.feedback} ${styles.error}`}>{error}</p>}

                    <button
                        type="button"
                        className={styles.textButton}
                        disabled={busy}
                        onClick={() => void load()}
                    >
                        Refresh team
                    </button>
                </div>
            </div>
        </section>
    );
}