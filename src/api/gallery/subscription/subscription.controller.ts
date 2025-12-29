import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { stripeService } from './stripe.service';
import { gallerySubscriptionRepository } from '../../../shared/repositories/postgres/gallery.repository';
import { QUOTA_LIMITS } from '../gallery.types';

export const subscriptionController = {
  /**
   * Get current subscription details
   * GET /api/gallery/subscription
   */
  getSubscription: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const subscription = await gallerySubscriptionRepository.findByUserId(req.galleryUser.id);

    res.json(ApiResponse.success({
      tier: req.galleryUser.subscriptionTier,
      quota: {
        limit: QUOTA_LIMITS[req.galleryUser.subscriptionTier] || QUOTA_LIMITS.free
      },
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelledAt: subscription.cancelledAt
      } : null,
      stripeConfigured: stripeService.isConfigured()
    }));
  }),

  /**
   * Create Stripe Checkout session for Pro upgrade
   * POST /api/gallery/subscription/checkout
   */
  createCheckout: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    if (!stripeService.isConfigured()) {
      return res.status(httpStatus.SERVICE_UNAVAILABLE).json(
        ApiResponse.error('Payment processing is not available', httpStatus.SERVICE_UNAVAILABLE)
      );
    }

    const { successUrl, cancelUrl } = req.body;

    const checkoutUrl = await stripeService.createCheckoutSession(
      req.galleryUser.id,
      successUrl,
      cancelUrl
    );

    res.json(ApiResponse.success({ url: checkoutUrl }));
  }),

  /**
   * Create Stripe Customer Portal session
   * POST /api/gallery/subscription/portal
   */
  createPortal: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    if (!stripeService.isConfigured()) {
      return res.status(httpStatus.SERVICE_UNAVAILABLE).json(
        ApiResponse.error('Payment processing is not available', httpStatus.SERVICE_UNAVAILABLE)
      );
    }

    const { returnUrl } = req.body;

    const portalUrl = await stripeService.createPortalSession(
      req.galleryUser.id,
      returnUrl
    );

    res.json(ApiResponse.success({ url: portalUrl }));
  }),

  /**
   * Cancel subscription
   * POST /api/gallery/subscription/cancel
   */
  cancelSubscription: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    if (!stripeService.isConfigured()) {
      return res.status(httpStatus.SERVICE_UNAVAILABLE).json(
        ApiResponse.error('Payment processing is not available', httpStatus.SERVICE_UNAVAILABLE)
      );
    }

    await stripeService.cancelSubscription(req.galleryUser.id);

    res.json(ApiResponse.success(null, 'Subscription will be cancelled at the end of the billing period'));
  }),

  /**
   * Reactivate cancelled subscription
   * POST /api/gallery/subscription/reactivate
   */
  reactivateSubscription: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    if (!stripeService.isConfigured()) {
      return res.status(httpStatus.SERVICE_UNAVAILABLE).json(
        ApiResponse.error('Payment processing is not available', httpStatus.SERVICE_UNAVAILABLE)
      );
    }

    await stripeService.reactivateSubscription(req.galleryUser.id);

    res.json(ApiResponse.success(null, 'Subscription reactivated successfully'));
  })
};
