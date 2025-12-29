import Stripe from 'stripe';
import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import { env } from '../../../config/env';
import { GallerySubscriptionTier, QUOTA_LIMITS } from '../gallery.types';
import {
  galleryUserRepository,
  gallerySubscriptionRepository,
  galleryNotificationRepository
} from '../../../shared/repositories/postgres/gallery.repository';
import { quotaService } from '../quota/quota.service';

// Initialize Stripe (only if key is provided)
const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : null;

export class StripeService {
  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return !!stripe && !!env.STRIPE_SECRET_KEY;
  }

  /**
   * Get or create a Stripe customer for a user
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    if (!stripe) {
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Stripe is not configured');
    }

    // Check if user already has a Stripe customer ID
    const subscription = await gallerySubscriptionRepository.findByUserId(userId);
    if (subscription?.stripeCustomerId) {
      return subscription.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: {
        userId
      }
    });

    // Update subscription record with customer ID
    if (subscription) {
      await gallerySubscriptionRepository.update(subscription.id, {
        stripeCustomerId: customer.id
      });
    }

    return customer.id;
  }

  /**
   * Create a Stripe Checkout session for Pro subscription
   */
  async createCheckoutSession(
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    if (!stripe) {
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Stripe is not configured');
    }

    if (!env.STRIPE_PRO_PRICE_ID) {
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Pro subscription price not configured');
    }

    const user = await galleryUserRepository.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Get or create customer
    const customerId = await this.getOrCreateCustomer(userId, user.email);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: env.STRIPE_PRO_PRICE_ID,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId
      },
      subscription_data: {
        metadata: {
          userId
        }
      }
    });

    return session.url || '';
  }

  /**
   * Create a Stripe Customer Portal session
   */
  async createPortalSession(userId: string, returnUrl: string): Promise<string> {
    if (!stripe) {
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Stripe is not configured');
    }

    const subscription = await gallerySubscriptionRepository.findByUserId(userId);
    if (!subscription?.stripeCustomerId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No subscription found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl
    });

    return session.url;
  }

  /**
   * Cancel subscription (at period end)
   */
  async cancelSubscription(userId: string): Promise<void> {
    if (!stripe) {
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Stripe is not configured');
    }

    const subscription = await gallerySubscriptionRepository.findByUserId(userId);
    if (!subscription?.stripeSubscriptionId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No active subscription found');
    }

    // Cancel at period end (user keeps access until end of billing period)
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    await gallerySubscriptionRepository.update(subscription.id, {
      cancelledAt: new Date()
    });

    await galleryNotificationRepository.create({
      userId,
      type: 'system',
      title: 'Subscription Cancelled',
      message: 'Your Pro subscription will end at the end of the current billing period. You can reactivate anytime before then.',
      data: { periodEnd: subscription.currentPeriodEnd }
    });
  }

  /**
   * Reactivate a cancelled subscription
   */
  async reactivateSubscription(userId: string): Promise<void> {
    if (!stripe) {
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Stripe is not configured');
    }

    const subscription = await gallerySubscriptionRepository.findByUserId(userId);
    if (!subscription?.stripeSubscriptionId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No subscription found');
    }

    // Reactivate by removing cancel_at_period_end
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    await gallerySubscriptionRepository.update(subscription.id, {
      cancelledAt: undefined,
      status: 'active'
    });

    await galleryNotificationRepository.create({
      userId,
      type: 'system',
      title: 'Subscription Reactivated',
      message: 'Your Pro subscription has been reactivated. Thank you for staying with us!',
      data: {}
    });
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  /**
   * Handle subscription created/updated
   */
  private async handleSubscriptionUpdate(stripeSubscription: Stripe.Subscription): Promise<void> {
    const userId = stripeSubscription.metadata.userId;
    if (!userId) {
      console.error('Subscription webhook missing userId in metadata');
      return;
    }

    const subscription = await gallerySubscriptionRepository.findByUserId(userId);
    if (!subscription) {
      console.error(`No subscription record found for user ${userId}`);
      return;
    }

    // Determine tier from subscription status
    const isActive = stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing';
    const newTier: GallerySubscriptionTier = isActive ? 'pro' : 'free';

    // Update subscription record
    const subData = stripeSubscription as any; // Type assertion for period fields
    await gallerySubscriptionRepository.update(subscription.id, {
      tier: newTier,
      status: stripeSubscription.status === 'active' ? 'active' :
        stripeSubscription.status === 'canceled' ? 'cancelled' :
          stripeSubscription.status === 'past_due' ? 'past_due' : 'active',
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: stripeSubscription.items.data[0]?.price.id,
      currentPeriodStart: subData.current_period_start ? new Date(subData.current_period_start * 1000) : undefined,
      currentPeriodEnd: subData.current_period_end ? new Date(subData.current_period_end * 1000) : undefined
    });

    // Update user's subscription tier
    await galleryUserRepository.update(userId, {
      subscriptionTier: newTier
    });

    // Handle tier upgrade
    if (newTier === 'pro' && subscription.tier === 'free') {
      await quotaService.handleTierUpgrade(userId, 'pro');
    }
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const userId = stripeSubscription.metadata.userId;
    if (!userId) return;

    const subscription = await gallerySubscriptionRepository.findByUserId(userId);
    if (!subscription) return;

    // Downgrade to free
    await gallerySubscriptionRepository.update(subscription.id, {
      tier: 'free',
      status: 'cancelled',
      stripeSubscriptionId: undefined,
      stripePriceId: undefined,
      cancelledAt: new Date()
    });

    await galleryUserRepository.update(userId, {
      subscriptionTier: 'free'
    });

    await galleryNotificationRepository.create({
      userId,
      type: 'system',
      title: 'Subscription Ended',
      message: `Your Pro subscription has ended. You now have ${QUOTA_LIMITS.free.toLocaleString()} tokens per week on the free plan.`,
      data: { tier: 'free', limit: QUOTA_LIMITS.free }
    });
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const subscription = await gallerySubscriptionRepository.findByStripeCustomerId(customerId);

    if (subscription) {
      await galleryNotificationRepository.create({
        userId: subscription.userId,
        type: 'system',
        title: 'Payment Successful',
        message: 'Your Pro subscription payment was successful. Thank you!',
        data: { amount: invoice.amount_paid / 100, currency: invoice.currency }
      });
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const subscription = await gallerySubscriptionRepository.findByStripeCustomerId(customerId);

    if (subscription) {
      await gallerySubscriptionRepository.update(subscription.id, {
        status: 'past_due'
      });

      await galleryNotificationRepository.create({
        userId: subscription.userId,
        type: 'system',
        title: 'Payment Failed',
        message: 'Your payment could not be processed. Please update your payment method to continue using Pro features.',
        data: { amount: invoice.amount_due / 100, currency: invoice.currency }
      });
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    if (!stripe) {
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Stripe is not configured');
    }

    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Webhook secret not configured');
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid webhook signature');
    }
  }
}

export const stripeService = new StripeService();
