import { Router } from 'express';
import { subscriptionController } from './subscription.controller';
import { subscriptionValidator } from './subscription.validator';
import { validate } from '../../../middleware/validation.middleware';
import { galleryAuthenticate } from '../../../middleware/gallery-auth.middleware';

const router = Router();

/**
 * @route GET /api/gallery/subscription
 * @desc Get current subscription details
 * @access Private
 */
router.get(
  '/',
  galleryAuthenticate(),
  subscriptionController.getSubscription
);

/**
 * @route POST /api/gallery/subscription/checkout
 * @desc Create Stripe Checkout session for Pro upgrade
 * @access Private
 */
router.post(
  '/checkout',
  galleryAuthenticate(),
  validate(subscriptionValidator.createCheckout),
  subscriptionController.createCheckout
);

/**
 * @route POST /api/gallery/subscription/portal
 * @desc Create Stripe Customer Portal session
 * @access Private
 */
router.post(
  '/portal',
  galleryAuthenticate(),
  validate(subscriptionValidator.createPortal),
  subscriptionController.createPortal
);

/**
 * @route POST /api/gallery/subscription/cancel
 * @desc Cancel subscription (at period end)
 * @access Private
 */
router.post(
  '/cancel',
  galleryAuthenticate(),
  subscriptionController.cancelSubscription
);

/**
 * @route POST /api/gallery/subscription/reactivate
 * @desc Reactivate cancelled subscription
 * @access Private
 */
router.post(
  '/reactivate',
  galleryAuthenticate(),
  subscriptionController.reactivateSubscription
);

export const subscriptionRouter = router;
