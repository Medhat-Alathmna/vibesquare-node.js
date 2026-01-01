import { Router } from 'express';
import * as analyzeController from './analyze.controller';
import { validate } from '../../middleware/validation.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import * as analyzeValidator from './analyze.validator';

const router = Router();

/**
 * POST /api/analyze
 * Analyze a URL and generate a professional prompt for AI Code Generators
 *
 * @requires Authentication
 * @body {string} url - The URL to analyze (required)
 * @body {string} model - Gemini model to use (optional, default: gemini-1.5-flash)
 * @body {boolean} skipCache - Skip cache and force re-analysis (optional, default: false)
 */
router.post('/',
  // authenticate(),
  validate(analyzeValidator.analyzeUrl),
  analyzeController.analyzeUrl
);

export default router;
