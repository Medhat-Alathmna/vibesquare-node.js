import { Router } from 'express';
import { projectRouter } from './project';
import { collectionRouter } from './collection';
import { analyzeRouter } from './analyze';
import { authRouter } from './auth';
import { adminRouter } from './admin';
import { galleryRouter } from './gallery';

const router = Router();

// Auth routes (Panel Users)
router.use('/auth', authRouter);

// Admin routes (protected)
router.use('/admin', adminRouter);

// Gallery routes (Gallery Users)
router.use('/gallery', galleryRouter);

// Public/Protected routes
router.use('/projects', projectRouter);
router.use('/collections', collectionRouter);
router.use('/analyze', analyzeRouter);

export default router;
