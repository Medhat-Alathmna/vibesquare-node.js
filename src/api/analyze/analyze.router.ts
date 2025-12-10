import { Router } from 'express';
import * as analyzeController from './analyze.controller';
import { validate } from '../../middleware/validation.middleware';
import * as analyzeValidator from './analyze.validator';

const router = Router();

// POST /api/analyze - Analyze URL with LLM
router.post('/',
  validate(analyzeValidator.analyzeUrl),
  analyzeController.analyzeUrl
);

export default router;
