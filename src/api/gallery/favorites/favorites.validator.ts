import Joi from 'joi';

export const favoritesValidator = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  },

  projectId: {
    params: Joi.object({
      projectId: Joi.string().required()
    })
  },

  checkMultiple: {
    body: Joi.object({
      projectIds: Joi.array().items(Joi.string()).min(1).max(100).required()
    })
  }
};
