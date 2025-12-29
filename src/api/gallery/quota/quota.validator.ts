import Joi from 'joi';

export const quotaValidator = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  },

  checkQuota: {
    body: Joi.object({
      estimatedTokens: Joi.number().integer().min(1).required()
    })
  }
};
