"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type Props = {
    token: string;
    guestName: string;
    event: {
        name: string;
        venue: string;
        startsAt: string;
    };
};

type Action = "download" | "share" | "copy";

const buttonClass =
    "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60";

function makePassImage(
    qr: HTMLCanvasElement,
    { guestName, event }: Props,
) {
    const canvas = document.createElement("canvas");
    canvas.width = 960;

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Image creation unavailable.");
    }

    const lines: {
        text: string;
        font: string;
        color: string;
        y: number;
    }[] = [];

    let y = 144;

    function text(
        value: string,
        font: string,
        color: string,
        height: number,
    ) {
        context!.font = font;
        let line = "";

        function append() {
            lines.push({ text: line, font, color, y });
            y += height;
            line = "";
        }

        for (const word of value.trim().split(/\s+/u)) {
            const next = line ? `${line} ${word}` : word;

            if (context!.measureText(next).width <= 832) {
                line = next;
                continue;
            }

            if (line) append();

            for (const character of word) {
                if (context!.measureText(line + character).width > 832) {
                    append();
                }

                line += character;
            }
        }

        if (line) append();

        y += 16;
    }

    text(event.name, "bold 40px sans-serif", "#0f172a", 50);
    text("ISSUED TO", "22px sans-serif", "#475569", 28);
    text(guestName, "bold 32px sans-serif", "#0f172a", 42);

    text(
        new Intl.DateTimeFormat("en-KE", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Africa/Nairobi",
        }).format(new Date(event.startsAt)) + " (Nairobi time)",
        "28px sans-serif",
        "#334155",
        38,
    );

    text(event.venue, "28px sans-serif", "#334155", 38);

    const qrTop = y;

    canvas.height = qrTop + 760;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, 100);

    context.textBaseline = "top";
    context.fillStyle = "#99f6e4";
    context.font = "bold 26px sans-serif";
    context.fillText("EVENT CHECK-IN · GUEST PASS", 64, 36);

    for (const line of lines) {
        context.font = line.font;
        context.fillStyle = line.color;
        context.fillText(line.text, 64, line.y);
    }

    context.imageSmoothingEnabled = false;
    context.drawImage(qr, 160, qrTop, 640, 640);

    context.textAlign = "center";
    context.fillStyle = "#0f172a";
    context.font = "26px sans-serif";
    context.fillText(
        "Show this QR code at the entrance.",
        480,
        qrTop + 660,
    );

    context.fillStyle = "#475569";
    context.font = "22px sans-serif";
    context.fillText("Keep this pass private.", 480, qrTop + 704);

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) =>
                blob
                    ? resolve(blob)
                    : reject(new Error("Image creation failed.")),
            "image/png",
        );
    });
}

export default function PassActions(props: Props) {
    const qr = useRef<HTMLCanvasElement>(null);
    const inFlight = useRef(false);

    const [busy, setBusy] = useState<Action | null>(null);
    const [message, setMessage] = useState("");
    const [manualLink, setManualLink] = useState("");

    async function run(action: Action) {
        if (inFlight.current) return;

        inFlight.current = true;
        setBusy(action);
        setMessage("");
        setManualLink("");

        try {
            const link = new URL("/pass", window.location.origin);
            link.hash = props.token;

            if (action === "download") {
                if (!qr.current) {
                    throw new Error("Pass not ready.");
                }

                const blob = await makePassImage(qr.current, props);
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");

                anchor.href = url;

                const name = `${props.event.name}-${props.guestName}`
                    .normalize("NFKD")
                    .replace(/[^a-z0-9]+/gi, "-")
                    .replace(/^-|-$/g, "")
                    .slice(0, 100);

                anchor.download = `${name || "event"}-pass.png`;

                document.body.appendChild(anchor);

                try {
                    anchor.click();
                } finally {
                    anchor.remove();
                    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
                }

                setMessage("Download started. Keep the image for entry.");
            } else if (
                action === "share" &&
                typeof navigator.share === "function"
            ) {
                await navigator.share({
                    title: `${props.event.name} — ${props.guestName}`,
                    text: "Private event pass",
                    url: link.href,
                });

                setMessage("Sharing completed.");
            } else {
                try {
                    await navigator.clipboard.writeText(link.href);
                    setMessage("Private pass link copied.");
                } catch {
                    setManualLink(link.href);
                    setMessage("Select and copy your private pass link below.");
                }
            }
        } catch (error) {
            if (
                !(error instanceof DOMException && error.name === "AbortError")
            ) {
                setMessage(
                    action === "download"
                        ? "Could not download the pass. Try again or use Print pass."
                        : "Could not open sharing. Use Copy link instead.",
                );
            }
        } finally {
            inFlight.current = false;
            setBusy(null);
        }
    }

    return (
        <section
            aria-label="Save or share your pass"
            className="mt-5 print:hidden"
        >
            <div hidden aria-hidden="true">
                <QRCodeCanvas
                    ref={qr}
                    value={props.token}
                    size={640}
                    level="M"
                    marginSize={4}
                    bgColor="#ffffff"
                    fgColor="#000000"
                />
            </div>

            <div className="flex flex-wrap gap-3">
                {(
                    [
                        ["download", "Download QR pass", "Preparing image…"],
                        ["share", "Share pass", "Opening…"],
                        ["copy", "Copy link", "Copying…"],
                    ] as const
                ).map(([action, label, pending]) => (
                    <button
                        key={action}
                        type="button"
                        className={buttonClass}
                        disabled={busy !== null}
                        onClick={() => void run(action)}
                    >
                        {busy === action ? pending : label}
                    </button>
                ))}
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
                Save the image before travelling so you can show it without
                internet. Only share this pass with its intended attendee.
            </p>

            <p role="status" className="mt-2 text-sm text-slate-700">
                {message}
            </p>

            {manualLink && (
                <label className="mt-3 block text-sm font-medium text-slate-700">
                    Private pass link
                    <input
                        readOnly
                        value={manualLink}
                        onFocus={(event) => event.currentTarget.select()}
                        onClick={(event) => event.currentTarget.select()}
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:outline-2 focus:outline-teal-700"
                    />
                </label>
            )}
        </section>
    );
}