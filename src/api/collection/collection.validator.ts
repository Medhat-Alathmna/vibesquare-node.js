import Joi from 'joi';

export const listCollections = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(12)
  })
};

export const getCollectionById = {
  params: Joi.object({
    id: Joi.string().required()
  })
};
