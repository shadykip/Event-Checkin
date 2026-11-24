export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const base = process.env.API_BASE_URL;
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!base) return new Response(null, { status: 503, headers });

  try {
    const upstream = await fetch(
      new URL(`/events/${encodeURIComponent(slug)}/banner`, base),
      {
        cache: "no-store",
      },
    );
    if (upstream.status === 404)
      return new Response(null, { status: 404, headers });
    if (
      !upstream.ok ||
      upstream.headers.get("content-type")?.split(";")[0] !== "image/webp"
    ) {
      return new Response(null, { status: 502, headers });
    }
    return new Response(await upstream.arrayBuffer(), {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    return new Response(null, { status: 502, headers });
  }
}
