import type { Metadata } from "next";
import { eventDate, eventTime } from "../../public-events";
import { getPublicEvent } from "./event-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);

  if (!event) {
    return {
      title: "Event temporarily unavailable | Event check-in",
      description: "Please try loading this event again shortly.",
      robots: { index: false, follow: false },
    };
  }

  const origin = new URL(process.env.SITE_URL ?? "http://localhost:3002")
    .origin;
  const path = encodeURIComponent(event.slug);
  const url = new URL(`/events/${path}`, origin).href;
  const title = `${event.name} | Event check-in`;
  const startsAt = new Date(event.startsAt);

  const fallback = `${event.name} at ${event.venue}. ${eventDate.format(startsAt)} at ${eventTime.format(startsAt)} EAT.`;

  const text = (event.description?.trim() || fallback)
    .replace(/\s+/g, " ")
    .trim();

  const characters = Array.from(text);
  const description =
    characters.length > 160
      ? `${characters.slice(0, 157).join("").trimEnd()}…`
      : text;

  const images = event.hasBanner
    ? [
        {
          url: new URL(`/api/events/${path}/banner`, origin).href,
          alt: `${event.name} event banner`,
        },
      ]
    : [];

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_KE",
      siteName: "Event check-in",
      title,
      description,
      url,
      images,
    },
    twitter: {
      card: event.hasBanner ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  };
}
