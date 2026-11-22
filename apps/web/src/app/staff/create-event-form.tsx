"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { StaffEvent } from "./staff-dashboard";
import styles from "./staff-styles";

import EventDescriptionEditor from "./event-description-editor";

function nairobiInputValue(iso: string) {
    const date = new Date(iso);
    return new Date(date.getTime() + 3 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16);
}

const maxBannerBytes = 5 * 1024 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

export default function CreateEventForm({
    initialEvent,
    onCreated,
    onCancel,
}: {
    initialEvent?: StaffEvent;
    onCreated: (event: StaffEvent) => void;
    onCancel?: () => void;
}) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [fileError, setFileError] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [saving, setSaving] = useState(false);
    const editing = Boolean(initialEvent);
    const [editedHtml, setEditedHtml] = useState<string | undefined>(undefined);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    function chooseBanner(file?: File) {
        setFileError("");
        setPreviewUrl("");

        if (!file) return;

        if (!acceptedTypes.includes(file.type) || file.size > maxBannerBytes) {
            if (fileInput.current) fileInput.current.value = "";
            setFileError("Choose a JPEG, PNG, or WebP image up to 5 MiB.");
            return;
        }

        setPreviewUrl(URL.createObjectURL(file));
    }

    function removeBanner() {
        if (fileInput.current) fileInput.current.value = "";
        chooseBanner();
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;

        const data = new FormData(event.currentTarget);
        if (editedHtml !== undefined) {
            data.set("descriptionHtml", editedHtml);
        } else if (initialEvent?.descriptionHtml) {
            data.set("descriptionHtml", initialEvent.descriptionHtml);
        } else if (initialEvent?.description) {
            data.set("description", initialEvent.description);
        }

        if (!fileInput.current?.files?.length) {
            data.delete("banner");
        }

        setSaving(true);
        setSubmitError("");

        try {
            const endpoint = initialEvent
                ? `/api/staff/events/${encodeURIComponent(initialEvent.slug)}`
                : "/api/staff/events";

            const response = await fetch(endpoint, {
                method: initialEvent ? "PUT" : "POST",
                body: data,
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null);

                if (response.status === 413) {
                    setSubmitError("The banner is too large. Choose an image up to 5 MiB.");
                } else if (response.status === 401) {
                    setSubmitError("Your session expired. Sign in again.");
                } else {
                    setSubmitError(
                        typeof body?.message === "string"
                            ? body.message
                            : "Could not create the event. Please try again.",
                    );
                }
                return;
            }

            const created: StaffEvent = await response.json();
            onCreated(created);
        } catch {
            setSubmitError("Connection interrupted. Check My events before retrying.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} className="max-w-4xl w-auto space-y-5">
            <fieldset
                disabled={saving}
                className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
            >
                <legend className="sr-only">Event details</legend>
                <h2 className="text-lg font-semibold text-slate-950">Event details</h2>

                <label className={styles.label}>
                    Event name
                    <input
                        // On the event name input:
                        defaultValue={initialEvent?.name ?? ""}

                        className={styles.input}
                        name="name"
                        maxLength={160}
                        placeholder="AWS Student Community Day Nairobi"
                        required
                    />
                </label>

                <div className="grid gap-5 sm:grid-cols-2">
                    <label className={styles.label}>
                        Venue
                        <input
                            className={styles.input}
                            name="venue"

                            // On the venue input:
                            defaultValue={initialEvent?.venue ?? ""}
                            maxLength={200}
                            placeholder="Strathmore University"
                            required
                        />
                    </label>

                    <label className={styles.label}>
                        Start date and time · Nairobi
                        <input
                            className={styles.input}
                            name="startsAt"
                            // On the datetime-local input:
                            defaultValue={initialEvent ? nairobiInputValue(initialEvent.startsAt) : ""}
                            type="datetime-local"
                            required
                        />
                    </label>
                </div>

                <div className="grid gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                        About the event (optional)
                    </span>

                    <EventDescriptionEditor
                        initialHtml={initialEvent?.descriptionHtml}
                        initialText={initialEvent?.description}
                        onChange={setEditedHtml}
                        disabled={saving}
                    />
                </div>
            </fieldset>

            <fieldset
                disabled={saving}
                className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
            >
                <legend className="sr-only">Event banner</legend>
                <div>
                    <h2 className="text-lg font-semibold text-slate-950">Event banner</h2>
                    <p id="banner-help" className="mt-1 text-sm text-slate-600">
                        Optional. Choose a wide JPEG, PNG, or WebP up to 5 MiB.
                        The center of the image appears on your event card.
                    </p>
                </div>

                {previewUrl && (
                    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-xl bg-slate-100">
                        <Image
                            src={previewUrl}
                            alt="Preview of your event banner"
                            fill
                            unoptimized
                            className="object-cover"
                        />
                    </div>
                )}

                <label className={styles.label}>
                    Banner image
                    <input
                        ref={fileInput}
                        name="banner"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-describedby="banner-help"
                        onChange={(event) => chooseBanner(event.currentTarget.files?.[0])}
                        className="block w-full rounded-xl border border-slate-300 p-2 text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-semibold file:text-teal-800"
                    />
                </label>

                {fileError && <p role="alert" className="text-sm text-red-700">{fileError}</p>}

                {previewUrl && (
                    <button type="button" className={styles.textButton} onClick={removeBanner}>
                        Remove banner
                    </button>
                )}
            </fieldset>

            {submitError && (
                <p role="alert" className={`${styles.feedback} ${styles.error}`}>
                    {submitError}
                </p>
            )}

            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={saving} className={styles.primary}>
                    {saving ? "Saving…" : editing ? "Save changes" : "Create event"}
                </button>

                {onCancel && (
                    <button
                        type="button"
                        disabled={saving}
                        onClick={onCancel}
                        className={styles.secondary}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
}