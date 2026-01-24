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

/**
 * POST /api/analyze/v2.5
 * V2.5: Analyze a URL using Visual + Technical Architecture Pipeline
 *
 * Generates comprehensive PRD (Product Requirements Document) including:
 * - Visual Design (from V2 pipeline - Layout, Components, Design System)
 * - Database Schema (XML format)
 * - Backend Architecture (REST/GraphQL endpoints, Auth)
 * - Security Recommendations (OWASP, Auth, Data Protection)
 * - Testing Strategy (Unit/API tests, Coverage)
 * - DevOps Configuration (Docker, CI/CD, Hosting)
 *
 * Uses LangGraph orchestration with layered agents:
 * - Layer 1: Database Agent (schema inference)
 * - Layer 2: Backend, Security, Testing, DevOps Agents (parallel)
 * - Layer 3: PRD Validator, QA Agent (sequential with iteration)
 *
 * @requires Authentication (disabled)
 * @body {string} url - The URL to analyze (required)
 * @body {string} pipelineType - Pipeline type: "visual" | "technical" | "both" (default: "both")
 * @body {string} detailLevel - Detail level: "basic" | "detailed" | "comprehensive" (default: "detailed")
 * @body {string} tier - User tier for token budget (optional)
 * @body {boolean} includeDebug - Include debug information (optional, default: false)
 *
 * @returns {object} Response
 * @returns {string} Response.prdId - Saved PRD ID for future reference
 * @returns {string} Response.prdMarkdown - Complete PRD in markdown format
 * @returns {object} Response.metadata - Processing metadata (timing, validation score, QA status)
 */
router.post('/v2.5',
  // authenticate(),
  validate(analyzeValidator.analyzeUrlV25),
  analyzeController.analyzeUrlV25
);

export default router;
