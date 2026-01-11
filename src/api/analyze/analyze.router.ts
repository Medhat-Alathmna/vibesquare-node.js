import { Router } from 'express';
import * as analyzeController from './analyze.controller';
import { validate } from '../../middleware/validation.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import * as analyzeValidator from './analyze.validator';

const router = Router();

/**
 * POST /api/analyze
 * V1: Analyze a URL using single LLM
 *
 * @requires Authentication (disabled)
 * @body {string} url - The URL to analyze (required)
 * @body {string} model - LLM model to use (optional, default: gemini-1.5-flash)
 * @body {string} tier - User tier for token budget (optional)
 */
router.post('/',
  // authenticate(),
  validate(analyzeValidator.analyzeUrl),
  analyzeController.analyzeUrl
);

/**
 * POST /api/analyze/v2
 * V2: Analyze a URL using Multi-Agent Orchestration
 *
 * Uses LangGraph with specialized agents:
 * - Layout Analyzer: Identifies visual sections and layout patterns
 * - Component Identifier: Detects UI components (cards, forms, navigation)
 * - Design System Extractor: Extracts colors, fonts, visual identity
 * - Conflict Resolver: Resolves conflicts between agent outputs
 * - Prompt Synthesizer: Generates final production-ready prompt
 *
 * Falls back to single-LLM (V1) on critical failures.
 *
 * @requires Authentication (disabled)
 * @body {string} url - The URL to analyze (required)
 * @body {string} tier - User tier for token budget (optional)
 * @body {boolean} includeDebug - Include debug information (optional, default: false)
 *
 * @returns {object} Response
 * @returns {string} Response.finalPrompt - Production-ready prompt for AI Code Generator
 * @returns {array} Response.userQuestions - Questions for user clarification (if ambiguities exist)
 * @returns {object} Response.metadata - Analysis metadata
 */
router.post('/v2',
  // authenticate(),
  validate(analyzeValidator.analyzeUrlV2),
  analyzeController.analyzeUrlV2
);

export default router;
