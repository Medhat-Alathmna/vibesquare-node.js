import { Router, raw } from 'express';
import { stripeWebhookController } from './stripe-webhook.controller';

const router = Router();

/**
 * @route POST /api/gallery/webhooks/stripe
 * @desc Handle Stripe webhook events
 * @access Public (verified via Stripe signature)
 *
 * Note: This endpoint must receive the raw body for signature verification
 * The raw body parser is applied specifically to this route
 */
router.post(
  '/stripe',
  raw({ type: 'application/json' }),
  stripeWebhookController.handleWebhook
);

export const stripeWebhookRouter = router;
