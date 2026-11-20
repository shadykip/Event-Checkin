"use client";

import { useEffect, useRef, useState } from "react";
import type QrScanner from "qr-scanner";

type Props = {
  onRead: (token: string) => void;
  onClose: () => void;
};

export default function PassCamera({ onRead, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Allow camera access to scan a guest pass.");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let closed = false;
    let scanner: QrScanner | undefined;

    async function start(element: HTMLVideoElement) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMessage("Camera unavailable. Open the staff page over HTTPS or localhost, or enter the token manually.");
          return;
        }

        const { default: Scanner } = await import("qr-scanner");
        if (closed) return;

        scanner = new Scanner(
          element,
          ({ data }) => {
            if (closed) return;

            if (!/^[A-Za-z0-9_-]{43}$/.test(data)) {
              setMessage("This QR is not a guest pass. Aim at the code on the invitation.");
              return;
            }

            closed = true;
            onRead(data);
          },
          {
            preferredCamera: "environment",
            returnDetailedScanResult: true,
          },
        );

        await scanner.start();
        if (!closed) setMessage("Hold the guest’s QR code inside the camera view.");
      } catch {
        if (!closed) {
          scanner?.destroy();
          scanner = undefined;
          setMessage("Could not open the camera. Check camera permissions or enter the token manually.");
        }
      }
    }

    void start(video);

    return () => {
      closed = true;
      scanner?.destroy();
    };
  }, [onRead]);

  return (
    <div className="mt-3 space-y-2">
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Guest pass camera preview"
        className="aspect-video w-full rounded-lg bg-black object-cover"
      />
      <p role="status" className="text-sm text-stone-700">{message}</p>
      <button type="button" onClick={onClose} className="text-sm underline">
        Close camera
      </button>
    </div>
  );
}
