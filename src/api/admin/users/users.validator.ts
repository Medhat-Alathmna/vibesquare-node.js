import Joi from 'joi';

export const usersValidator = {
  createUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(12).required(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
    roleId: Joi.string().required(), // Required - every user must have a role
    subscriptionTier: Joi.string().valid('free', 'premium', 'enterprise').optional(),
    isActive: Joi.boolean().optional(),
    emailVerified: Joi.boolean().optional()
  }),

  updateUser: Joi.object({
    email: Joi.string().email().optional(),
    firstName: Joi.string().min(1).max(50).optional(),
    lastName: Joi.string().min(1).max(50).optional(),
    avatarUrl: Joi.string().uri().allow('', null).optional(),
    roleId: Joi.string().optional(), // Cannot be null - role is always required
    subscriptionTier: Joi.string().valid('free', 'premium', 'enterprise').optional(),
    isActive: Joi.boolean().optional(),
    emailVerified: Joi.boolean().optional()
  }),

  resetPassword: Joi.object({
    newPassword: Joi.string().min(12).required()
  }),

  assignRole: Joi.object({
    roleId: Joi.string().required() // Cannot be null - role is always required
  }),

  queryParams: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    search: Joi.string().optional(),
    roleId: Joi.string().optional(),
    subscriptionTier: Joi.string().valid('free', 'premium', 'enterprise').optional(),
    isActive: Joi.boolean().optional()
  })
};
