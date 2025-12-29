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
  }
};
