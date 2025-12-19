import Joi from 'joi';

export const rolesValidator = {
  createRole: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    description: Joi.string().max(500).optional(),
    canAccessAdmin: Joi.boolean().required(),
    permissions: Joi.array().items(Joi.string()).default([])
  }),

  updateRole: Joi.object({
    name: Joi.string().min(2).max(50).optional(),
    description: Joi.string().max(500).allow('', null).optional(),
    canAccessAdmin: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
    permissions: Joi.array().items(Joi.string()).optional()
  })
};
