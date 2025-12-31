import Joi from 'joi';
import { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH } from '../gallery.types';

export const galleryUsersValidator = {
  updateProfile: {
    body: Joi.object({
      username: Joi.string()
        .min(USERNAME_MIN_LENGTH)
        .max(USERNAME_MAX_LENGTH)
        .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
        .optional()
        .messages({
          'string.min': `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
          'string.max': `Username must not exceed ${USERNAME_MAX_LENGTH} characters`,
          'string.pattern.base': 'Username must start with a letter and contain only letters, numbers, and underscores'
        }),
      avatarUrl: Joi.string().uri().allow('', null).optional(),
      bio: Joi.string().max(500).allow('', null).optional(),
      socialLinks: Joi.object({
        twitter: Joi.string().uri().allow('', null).optional(),
        linkedin: Joi.string().uri().allow('', null).optional(),
        portfolio: Joi.string().uri().allow('', null).optional(),
        github: Joi.string().uri().allow('', null).optional()
      }).optional()
    })
  },

  getPublicProfile: {
    params: Joi.object({
      username: Joi.string().required()
    })
  },

  getUserFavorites: {
    params: Joi.object({
      username: Joi.string().required()
    }),
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(50).default(20)
    })
  },

  pagination: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    })
  },

  recordDownload: {
    params: Joi.object({
      projectId: Joi.string().required()
    })
  }
};
