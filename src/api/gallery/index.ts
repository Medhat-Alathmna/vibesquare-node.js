import { Router } from 'express';
import { galleryAuthRouter } from './auth';
import { galleryUsersRouter } from './users';
import { favoritesRouter } from './favorites';
import { notificationsRouter } from './notifications';
import { quotaRouter } from './quota';
import { galleryAnalyzeRouter } from './analyze';
import { subscriptionRouter } from './subscription';
// ...
import { stripeWebhookRouter } from './webhooks';
import { galleryCollectionsRouter } from './collections/gallery-collection.router';

const router = Router();

// ...
router.use('/webhooks', stripeWebhookRouter);

// Collections Routes
router.use('/collections', galleryCollectionsRouter);

export const galleryRouter = router;
// ...

// Re-export types
export * from './gallery.types';
