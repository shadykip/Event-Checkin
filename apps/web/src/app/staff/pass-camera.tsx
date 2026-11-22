"use client";

import { useEffect, useRef, useState } from "react";
import type QrScanner from "qr-scanner";
import styles from "./staff-styles";

type Props = {
  onRead: (token: string) => void;
  onManual: () => void;
  onClose: () => void;
};

const passPattern = /^[A-Za-z0-9_-]{43}$/;

export default function PassCamera({ onRead, onManual, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState("Opening the camera…");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let closed = false;
    let scanner: QrScanner | undefined;

    async function start(element: HTMLVideoElement) {
      try {
        if (!window.isSecureContext) {
          throw new Error("secure-context");
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("camera-unavailable");
        }

        const { default: Scanner } = await import("qr-scanner");
        if (closed) return;

        scanner = new Scanner(
          element,
          ({ data }) => {
            if (closed) return;

            if (!passPattern.test(data)) {
              setMessage("Aim at the QR code shown on the guest’s invitation.");
              return;
            }

            // Ignore repeated frames while React switches to confirmation.
            closed = true;
            onRead(data);
          },
          {
            preferredCamera: "environment",
            returnDetailedScanResult: true,
          },
        );

        await scanner.start();

        if (!closed) {
          setMessage("Point the camera at the guest’s QR code.");
        }
      } catch (cause) {
        if (closed) return;

        scanner?.destroy();
        scanner = undefined;
        setFailed(true);

        if (cause instanceof Error && cause.message === "secure-context") {
          setMessage(
            "Camera access requires HTTPS on this device. You can enter the pass manually.",
          );
        } else if (
          cause instanceof Error &&
          cause.message === "camera-unavailable"
        ) {
          setMessage(
            "This browser has no available camera. Enter the pass manually.",
          );
        } else {
          setMessage(
            "Couldn’t open the camera. Allow camera access in your browser and retry, or enter the pass manually.",
          );
        }
      }
    }

    void start(video);

    return () => {
      closed = true;
      scanner?.destroy();
    };
  }, [attempt, onRead]);

  function retry() {
    setFailed(false);
    setMessage("Opening the camera…");
    setAttempt((current) => current + 1);
  }

  return (
    <div className="mt-4 grid min-w-0 gap-3">
      <p role="status" aria-atomic="true" className="text-sm leading-6 text-slate-700">
        {message}
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={styles.secondary} onClick={onManual}>
          Enter pass manually
        </button>

        {failed && (
          <button type="button" className={styles.secondary} onClick={retry}>
            Retry camera
          </button>
        )}

        <button type="button" className={styles.textButton} onClick={onClose}>
          Close camera
        </button>
      </div>

      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Guest QR camera preview"
        className={
          failed
            ? "hidden"
            : "aspect-video max-h-[42dvh] w-full rounded-xl bg-slate-950 object-contain"
        }
      />
    </div>
  );
}