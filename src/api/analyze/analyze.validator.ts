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
    customBudget: Joi.object({
      maxTokens: Joi.number().min(100).max(100000).optional(),
      maxCSSClasses: Joi.number().min(-1).optional(),
      maxColors: Joi.number().min(-1).optional(),
      maxImages: Joi.number().min(-1).optional(),
      maxSections: Joi.number().min(-1).optional(),
      maxNavItems: Joi.number().min(-1).optional(),
      includeCSSDetails: Joi.boolean().optional(),
      includeAllMetadata: Joi.boolean().optional(),
    }).optional(),
  }),
};
