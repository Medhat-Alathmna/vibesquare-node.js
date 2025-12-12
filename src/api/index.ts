import { Router } from 'express';
import { projectRouter } from './project';
import { collectionRouter } from './collection';
import { analyzeRouter } from './analyze';
import { authRouter } from './auth';
import { adminRouter } from './admin';

const router = Router();

// Auth routes
router.use('/auth', authRouter);

// Admin routes (protected)
router.use('/admin', adminRouter);

// Public/Protected routes
router.use('/projects', projectRouter);
router.use('/collections', collectionRouter);
router.use('/analyze', analyzeRouter);

export default router;
