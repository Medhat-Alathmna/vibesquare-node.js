import Joi from 'joi';
import { GALLERY_SUBSCRIPTION_TIERS } from '../../gallery/gallery.types';

export const adminGalleryUsersValidator = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      search: Joi.string().allow('').optional()
    })
  },

  userId: {
    params: Joi.object({
      id: Joi.string().required()
    })
  },

  update: {
    params: Joi.object({
      id: Joi.string().required()
    }),
    body: Joi.object({
      username: Joi.string().min(3).max(20).pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/).optional(),
      email: Joi.string().email().optional(),
      avatarUrl: Joi.string().uri().allow('', null).optional(),
      bio: Joi.string().max(500).allow('', null).optional(),
      isActive: Joi.boolean().optional(),
      emailVerified: Joi.boolean().optional(),
      subscriptionTier: Joi.string().valid(...GALLERY_SUBSCRIPTION_TIERS).optional()
    })
  },

  upgradeToPanel: {
    params: Joi.object({
      id: Joi.string().required()
    }),
    body: Joi.object({
      roleId: Joi.string().required()
    })
  },

  activity: {
    params: Joi.object({
      id: Joi.string().required()
    }),
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50)
    })
  },

  sendNotification: {
    params: Joi.object({
      id: Joi.string().required()
    }),
    body: Joi.object({
      title: Joi.string().min(1).max(255).required(),
      message: Joi.string().min(1).max(1000).required()
    })
  },

  sendBulkNotification: {
    body: Joi.object({
      title: Joi.string().min(1).max(255).required(),
      message: Joi.string().min(1).max(1000).required(),
      filter: Joi.object({
        subscriptionTier: Joi.string().valid(...GALLERY_SUBSCRIPTION_TIERS).optional(),
        isActive: Joi.boolean().optional()
      }).optional()
    })
  },

  // ==================== QUOTA MANAGEMENT ====================

  quotaHistory: {
    params: Joi.object({
      id: Joi.string().required()
    }),
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50)
    })
  },

  resetQuota: {
    params: Joi.object({
      id: Joi.string().required()
    }),
    body: Joi.object({
      reason: Joi.string().min(1).max(500).required()
    })
  },

  addBonusTokens: {
    params: Joi.object({
      id: Joi.string().required()
    }),
    body: Joi.object({
      amount: Joi.number().integer().min(1).max(1000000).required(),
      reason: Joi.string().min(1).max(500).required()
    })
  }
};
