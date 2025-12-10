import { Router } from 'express';
import { projectRouter } from './project';
import { collectionRouter } from './collection';
import { analyzeRouter } from './analyze';

const router = Router();

router.use('/projects', projectRouter);
router.use('/collections', collectionRouter);
router.use('/analyze', analyzeRouter);

export default router;
