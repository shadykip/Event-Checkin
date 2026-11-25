"use server";

const referencePattern =
  /^(?:ticket-)?[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function requestCheckoutRecovery(
  reference: string,
  email: string,
) {
  const normalizedReference = reference.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!referencePattern.test(normalizedReference)) {
    return {
      error: "Enter the order reference from your checkout or payment receipt.",
    };
  }
  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return { error: "Enter the email address used for this purchase." };
  }

  if (!process.env.API_BASE_URL) {
    return {
      error: "Booking recovery is unavailable right now. Try again later.",
    };
  }

  try {
    const response = await fetch(
      new URL("/payments/orders/recover", process.env.API_BASE_URL),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: normalizedReference,
          email: normalizedEmail,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        error: "Booking recovery is unavailable right now. Try again later.",
      };
    }

    return {
      message:
        "If that order and purchase email match, a checkout link will arrive shortly. Check your inbox and spam folder.",
    };
  } catch {
    return { error: "Could not reach the booking service. Try again." };
  }
}
