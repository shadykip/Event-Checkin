"use client";

import Image from "next/image";
import { useState } from "react";

export default function PublicEventBanner({
  slug,
  hasBanner,
  wide = false,
  priority = false,
  hero = false,
}: {
  slug: string;
  hasBanner: boolean;
  wide?: boolean;
  priority?: boolean;
  hero?: boolean;
}) {
  const source = `/api/events/${encodeURIComponent(slug)}/banner`;
  const [failedSource, setFailedSource] = useState("");

  if (wide && !hero) {
    return (
      <div
        aria-hidden="true"
        className="flex min-h-40 w-full min-w-0 items-center justify-center overflow-hidden border-b border-slate-800 bg-slate-950 p-3 sm:p-5"
      >
        {hasBanner && failedSource !== source && (
          <Image
            src={source}
            alt=""
            width={1440}
            height={720}
            unoptimized
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            sizes="(min-width: 1600px) 1480px, 100vw"
            className="mx-auto block h-auto max-h-[34rem] w-auto max-w-full rounded-lg object-contain object-center"
            onError={() => setFailedSource(source)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={
        hero
          ? "absolute inset-0 overflow-hidden bg-linear-to-br from-slate-950 to-teal-950"
          : "relative aspect-[1.9] overflow-hidden bg-linear-to-br from-teal-800 via-slate-800 to-slate-950"
      }
      aria-hidden="true"
    >
      {hasBanner && failedSource !== source && (
        <Image
          src={source}
          alt=""
          fill
          unoptimized
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          sizes={
            hero
              ? "(min-width: 1600px) 1520px, 100vw"
              : "(min-width: 1536px) 350px, (min-width: 1024px) 32vw, (min-width: 640px) 50vw, 100vw"
          }
          className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.025]"
          onError={() => setFailedSource(source)}
        />
      )}
    </div>
  );
}
