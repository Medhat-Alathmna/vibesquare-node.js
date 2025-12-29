import { Router } from 'express';
import { galleryAuthRouter } from './auth';
import { galleryUsersRouter } from './users';
import { favoritesRouter } from './favorites';
import { notificationsRouter } from './notifications';
import { quotaRouter } from './quota';
import { galleryAnalyzeRouter } from './analyze';
import { subscriptionRouter } from './subscription';
import { stripeWebhookRouter } from './webhooks';

const router = Router();

// Gallery Auth Routes
router.use('/auth', galleryAuthRouter);

// Gallery Users Routes
router.use('/users', galleryUsersRouter);

// Favorites Routes
router.use('/favorites', favoritesRouter);

// Notifications Routes
router.use('/notifications', notificationsRouter);

// Token Quota Routes
router.use('/quota', quotaRouter);

// Analysis Routes (with quota enforcement)
router.use('/analyze', galleryAnalyzeRouter);

// Subscription Routes (Stripe)
router.use('/subscription', subscriptionRouter);

// Webhook Routes (Stripe)
router.use('/webhooks', stripeWebhookRouter);

export const galleryRouter = router;

// Re-export types
export * from './gallery.types';
