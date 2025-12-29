import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { stripeService } from '../subscription/stripe.service';

export const stripeWebhookController = {
  /**
   * Handle Stripe webhook events
   * POST /api/gallery/webhooks/stripe
   */
  handleWebhook: asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(httpStatus.BAD_REQUEST).json(
        ApiResponse.error('Missing Stripe signature', httpStatus.BAD_REQUEST)
      );
    }

    // Verify and parse the webhook event
    // Note: req.body should be the raw body (Buffer) for signature verification
    const event = stripeService.verifyWebhookSignature(req.body, signature);

    // Handle the event
    await stripeService.handleWebhookEvent(event);

    // Return success to Stripe
    res.json({ received: true });
  })
};
