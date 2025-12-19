import Joi from 'joi';
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  GALLERY_PASSWORD_MIN_LENGTH,
  GALLERY_PASSWORD_MAX_LENGTH
} from '../gallery.types';

export const galleryAuthValidator = {
  register: {
    body: Joi.object({
      username: Joi.string()
        .min(USERNAME_MIN_LENGTH)
        .max(USERNAME_MAX_LENGTH)
        .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
        .required()
        .messages({
          'string.min': `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
          'string.max': `Username must not exceed ${USERNAME_MAX_LENGTH} characters`,
          'string.pattern.base': 'Username must start with a letter and contain only letters, numbers, and underscores'
        }),
      email: Joi.string().email().required(),
      password: Joi.string()
        .min(GALLERY_PASSWORD_MIN_LENGTH)
        .max(GALLERY_PASSWORD_MAX_LENGTH)
        .required()
        .messages({
          'string.min': `Password must be at least ${GALLERY_PASSWORD_MIN_LENGTH} characters`,
          'string.max': `Password must not exceed ${GALLERY_PASSWORD_MAX_LENGTH} characters`
        })
    })
  },

  login: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    })
  },

  verifyEmail: {
    body: Joi.object({
      token: Joi.string().required()
    })
  },

  forgotPassword: {
    body: Joi.object({
      email: Joi.string().email().required()
    })
  },

  resetPassword: {
    body: Joi.object({
      token: Joi.string().required(),
      newPassword: Joi.string()
        .min(GALLERY_PASSWORD_MIN_LENGTH)
        .max(GALLERY_PASSWORD_MAX_LENGTH)
        .required()
        .messages({
          'string.min': `Password must be at least ${GALLERY_PASSWORD_MIN_LENGTH} characters`,
          'string.max': `Password must not exceed ${GALLERY_PASSWORD_MAX_LENGTH} characters`
        })
    })
  },

  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string()
        .min(GALLERY_PASSWORD_MIN_LENGTH)
        .max(GALLERY_PASSWORD_MAX_LENGTH)
        .required()
        .messages({
          'string.min': `Password must be at least ${GALLERY_PASSWORD_MIN_LENGTH} characters`,
          'string.max': `Password must not exceed ${GALLERY_PASSWORD_MAX_LENGTH} characters`
        })
    })
  }
};
