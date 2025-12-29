import Joi from 'joi';

export const subscriptionValidator = {
  createCheckout: {
    body: Joi.object({
      successUrl: Joi.string().uri().required().messages({
        'string.uri': 'Success URL must be a valid URL',
        'any.required': 'Success URL is required'
      }),
      cancelUrl: Joi.string().uri().required().messages({
        'string.uri': 'Cancel URL must be a valid URL',
        'any.required': 'Cancel URL is required'
      })
    })
  },

  createPortal: {
    body: Joi.object({
      returnUrl: Joi.string().uri().required().messages({
        'string.uri': 'Return URL must be a valid URL',
        'any.required': 'Return URL is required'
      })
    })
  }
};
