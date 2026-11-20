export async function POST(request: Request) {
  const baseUrl = process.env.API_BASE_URL;
  const headers = { "Cache-Control": "no-store" };

  if (!baseUrl) {
    return Response.json({ message: "API configuration missing" }, { status: 500, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid request" }, { status: 400, headers });
  }

  try {
    const upstream = await fetch(new URL("/invitations/lookup", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (upstream.status === 404) {
      return Response.json({ message: "Invitation unavailable" }, { status: 404, headers });
    }
    if (!upstream.ok) {
      return Response.json({ message: "Lookup failed" }, { status: 502, headers });
    }

    return Response.json(await upstream.json(), { headers });
  } catch {
    return Response.json({ message: "API unavailable" }, { status: 502, headers });
  }
}
