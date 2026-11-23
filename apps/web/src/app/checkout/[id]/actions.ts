"use server";

type OrderStatus = {
  state: "reserved" | "expired" | "review" | "paid" | "pass_changed";
  tierName: string;
  amountMinor: number;
  currency: string;
  expiresAt: string;
  passPath?: string;
};

async function request<T>(
  id: string,
  action: "start" | "status",
  key: string,
  verify = false,
): Promise<{ data: T } | { error: string }> {
  if (!/^[a-f0-9-]{36}$/i.test(id) || !/^[a-f0-9-]{36}$/i.test(key)) {
    return { error: "Invalid checkout details." };
  }

  try {
    const response = await fetch(
      new URL(`/payments/orders/${id}/${action}`, process.env.API_BASE_URL),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, verify }),
        cache: "no-store",
      },
    );
    const body = await response.json();
    if (!response.ok) {
      return {
        error:
          typeof body.message === "string"
            ? body.message
            : "Checkout unavailable.",
      };
    }
    return { data: body as T };
  } catch {
    return { error: "Could not reach checkout. Try again." };
  }
}

export async function startPayment(id: string, key: string) {
  return request<{ url: string }>(id, "start", key);
}

export async function readPayment(id: string, key: string, verify: boolean) {
  return request<OrderStatus>(id, "status", key, verify);
}
