import { Router } from 'express';
import { galleryAuthRouter } from './auth';
import { galleryUsersRouter } from './users';
import { favoritesRouter } from './favorites';
import { notificationsRouter } from './notifications';

const router = Router();

// Gallery Auth Routes
router.use('/auth', galleryAuthRouter);

// Gallery Users Routes
router.use('/users', galleryUsersRouter);

// Favorites Routes
router.use('/favorites', favoritesRouter);

// Notifications Routes
router.use('/notifications', notificationsRouter);

export const galleryRouter = router;

// Re-export types
export * from './gallery.types';
