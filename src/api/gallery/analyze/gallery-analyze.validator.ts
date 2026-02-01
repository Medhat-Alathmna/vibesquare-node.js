import Joi from 'joi';

export const galleryAnalyzeValidator = {
  estimate: {
    body: Joi.object({
      url: Joi.string().uri().required().messages({
        'string.uri': 'Please provide a valid URL',
        'any.required': 'URL is required'
      })
    })
  },

  confirm: {
    body: Joi.object({
      url: Joi.string().uri().required().messages({
        'string.uri': 'Please provide a valid URL',
        'any.required': 'URL is required'
      }),
      model: Joi.string().valid(
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo'
      ).default('gemini-1.5-flash')
    })
  },

  history: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  },

  recent: {
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(20).default(5)
    })
  },

  getById: {
    params: Joi.object({
      id: Joi.string().required()
    })
  },

  estimateV25: {
    body: Joi.object({
      url: Joi.string().uri().required().messages({
        'string.uri': 'Please provide a valid URL',
        'any.required': 'URL is required'
      })
    })
  },

  confirmV25: {
    body: Joi.object({
      url: Joi.string().uri().required().messages({
        'string.uri': 'Please provide a valid URL',
        'any.required': 'URL is required'
      }),
      pipelineType: Joi.string().valid('visual', 'technical', 'both').default('both').messages({
        'any.only': 'Pipeline type must be one of: visual, technical, both'
      }),
      detailLevel: Joi.string().valid('basic', 'detailed', 'comprehensive').default('detailed').messages({
        'any.only': 'Detail level must be one of: basic, detailed, comprehensive'
      }),
      apiStyle: Joi.string().valid('REST', 'GraphQL').default('REST').messages({
        'any.only': 'API style must be one of: REST, GraphQL'
      })
    })
  }
};
