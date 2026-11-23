import { Injectable, ServiceUnavailableException } from '@nestjs/common';

type VerifiedPayment = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  domain: string;
  paid_at: string | null;
};

@Injectable()
export class PaystackService {
  key() {
    const key = process.env.PAYSTACK_SECRET_KEY;

    if (!key?.startsWith('sk_test_')) {
      throw new ServiceUnavailableException(
        'Ticket checkout requires a Paystack test secret key.',
      );
    }

    return key;
  }

  private async request<T>(path: string, body?: object): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`https://api.paystack.co${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${this.key()}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Payment service unavailable. Try again.',
      );
    }

    const result = await response.json().catch(() => null);
    if (!response.ok || result?.status !== true || !result.data) {
      throw new ServiceUnavailableException(
        'Payment status could not be confirmed. Check this order again.',
      );
    }

    return result.data as T;
  }

  async initialize(order: {
    id: string;
    guestEmail: string;
    amountMinor: number;
    currency: string;
  }) {
    const callback = new URL(
      `/checkout/${order.id}`,
      process.env.WEB_PUBLIC_URL ?? 'http://localhost:3002',
    );

    const data = await this.request<{
      reference: string;
      authorization_url: string;
    }>('/transaction/initialize', {
      reference: `ticket-${order.id}`,
      amount: order.amountMinor,
      currency: order.currency,
      email: order.guestEmail,
      callback_url: callback.href,
    });

    const url = new URL(data.authorization_url);
    if (
      data.reference !== `ticket-${order.id}` ||
      url.origin !== 'https://checkout.paystack.com'
    ) {
      throw new ServiceUnavailableException('Unexpected checkout response.');
    }

    return url.href;
  }

  verify(orderId: string) {
    return this.request<VerifiedPayment>(
      `/transaction/verify/ticket-${encodeURIComponent(orderId)}`,
    );
  }
}
