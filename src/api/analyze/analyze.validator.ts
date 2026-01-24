import Joi from 'joi';

// Gemini models
const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
] as const;

// OpenAI models
const OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'o1',
  'o1-mini',
  'o1-preview',
] as const;

// All available models
const ALL_MODELS = [...GEMINI_MODELS, ...OPENAI_MODELS];

// User tiers
const USER_TIERS = ['free', 'basic', 'pro', 'enterprise'] as const;

/**
 * V1 Analyze URL Validator
 */
export const analyzeUrl = {
  body: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).required()
      .messages({
        'string.uri': 'URL must be a valid HTTP or HTTPS URL',
        'any.required': 'URL is required',
      }),
    model: Joi.string().valid(...ALL_MODELS).default('gemini-1.5-flash')
      .messages({
        'any.only': `Model must be one of: ${ALL_MODELS.join(', ')}`,
      }),
    tier: Joi.string().valid(...USER_TIERS).optional()
      .messages({
        'any.only': `Tier must be one of: ${USER_TIERS.join(', ')}`,
      }),
  }),
};

/**
 * V2 Analyze URL Validator (Multi-Agent)
 */
export const analyzeUrlV2 = {
  body: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).required()
      .messages({
        'string.uri': 'URL must be a valid HTTP or HTTPS URL',
        'any.required': 'URL is required',
      }),
    tier: Joi.string().valid(...USER_TIERS).optional()
      .messages({
        'any.only': `Tier must be one of: ${USER_TIERS.join(', ')}`,
      }),
    includeDebug: Joi.boolean().default(false)
      .messages({
        'boolean.base': 'includeDebug must be a boolean',
      }),
  }),
};

// Pipeline types
const PIPELINE_TYPES = ['visual', 'technical', 'both'] as const;
const DETAIL_LEVELS = ['basic', 'detailed', 'comprehensive'] as const;

/**
 * V2.5 Analyze URL Validator (Visual + Technical Architecture Pipeline)
 *
 * Generates a comprehensive PRD including:
 * - Visual Design (from V2 pipeline)
 * - Database Schema (XML)
 * - Backend Architecture (XML)
 * - Security Recommendations (XML)
 * - Testing Strategy (XML)
 * - DevOps Configuration (XML)
 */
export const analyzeUrlV25 = {
  body: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).required()
      .messages({
        'string.uri': 'URL must be a valid HTTP or HTTPS URL',
        'any.required': 'URL is required',
      }),
    pipelineType: Joi.string().valid(...PIPELINE_TYPES).default('both')
      .messages({
        'any.only': `Pipeline type must be one of: ${PIPELINE_TYPES.join(', ')}`,
      }),
    detailLevel: Joi.string().valid(...DETAIL_LEVELS).default('detailed')
      .messages({
        'any.only': `Detail level must be one of: ${DETAIL_LEVELS.join(', ')}`,
      }),
    tier: Joi.string().valid(...USER_TIERS).optional()
      .messages({
        'any.only': `Tier must be one of: ${USER_TIERS.join(', ')}`,
      }),
    includeDebug: Joi.boolean().default(false)
      .messages({
        'boolean.base': 'includeDebug must be a boolean',
      }),
  }),
};
