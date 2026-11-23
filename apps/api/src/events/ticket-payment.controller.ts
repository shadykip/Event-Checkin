import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { PaystackService } from './paystack.service';
import { TicketPaymentService } from './ticket-payment.service';

@Controller('payments')
export class TicketPaymentController {
  constructor(
    private readonly payments: TicketPaymentService,
    private readonly provider: PaystackService,
  ) {}

  @Post('orders/:id/start')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  start(@Param('id', ParseUUIDPipe) id: string, @Body('key') key: unknown) {
    return this.payments.start(id, key);
  }

  @Post('orders/:id/status')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('key') key: unknown,
    @Body('verify') verify: unknown,
  ) {
    return this.payments.status(id, key, verify === true);
  }

  @Post('paystack/webhook')
  @HttpCode(200)
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    if (!request.rawBody || !signature || !/^[a-f0-9]{128}$/i.test(signature)) {
      throw new ForbiddenException();
    }

    const expected = createHmac('sha512', this.provider.key())
      .update(request.rawBody)
      .digest();

    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
      throw new ForbiddenException();
    }

    const event = request.body;
    const reference = event?.data?.reference;
    if (event?.event === 'charge.success' && typeof reference === 'string') {
      const match =
        /^ticket-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.exec(
          reference,
        );
      if (match) await this.payments.reconcile(match[1]);
    }

    return { received: true };
  }
}
