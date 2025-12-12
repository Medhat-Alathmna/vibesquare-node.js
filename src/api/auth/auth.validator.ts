import Joi from 'joi';

export const authValidator = {
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(12).max(128).required().messages({
      'string.min': 'Password must be at least 12 characters',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'Password is required'
    }),
    firstName: Joi.string().min(1).max(50).required().trim().messages({
      'string.min': 'First name is required',
      'string.max': 'First name must not exceed 50 characters',
      'any.required': 'First name is required'
    }),
    lastName: Joi.string().min(1).max(50).required().trim().messages({
      'string.min': 'Last name is required',
      'string.max': 'Last name must not exceed 50 characters',
      'any.required': 'Last name is required'
    })
  }),

  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    })
  }),

  refreshToken: Joi.object({
    // Refresh token comes from cookie, no body validation needed
  }),

  verifyEmail: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Verification token is required'
    })
  }),

  resendVerification: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
  }),

  resetPassword: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Reset token is required'
    }),
    newPassword: Joi.string().min(12).max(128).required().messages({
      'string.min': 'Password must be at least 12 characters',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'New password is required'
    })
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required'
    }),
    newPassword: Joi.string().min(12).max(128).required().messages({
      'string.min': 'Password must be at least 12 characters',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'New password is required'
    })
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().min(1).max(50).trim().messages({
      'string.min': 'First name is required',
      'string.max': 'First name must not exceed 50 characters'
    }),
    lastName: Joi.string().min(1).max(50).trim().messages({
      'string.min': 'Last name is required',
      'string.max': 'Last name must not exceed 50 characters'
    }),
    avatarUrl: Joi.string().uri().allow('', null).messages({
      'string.uri': 'Avatar URL must be a valid URL'
    })
  })
};
