import Joi from 'joi';

export const notificationsValidator = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  },

  notificationId: {
    params: Joi.object({
      id: Joi.string().required()
    })
  }
};
