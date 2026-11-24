import { cache } from "react";
import { notFound } from "next/navigation";
import type { PublicEvent } from "../../public-events";

type EventDetails = PublicEvent & {
  description: string | null;
  descriptionHtml: string | null;
};

// Share one result between metadata and page rendering for this request.
export const getPublicEvent = cache(
  async (slug: string): Promise<EventDetails | null> => {
    let response: Response;

    try {
      response = await fetch(
        new URL(
          `/events/${encodeURIComponent(slug)}`,
          process.env.API_BASE_URL,
        ),
        { cache: "no-store" },
      );
    } catch {
      return null;
    }

    if (response.status === 404) notFound();
    if (!response.ok) return null;

    return response.json().catch(() => null);
  },
);
