import Joi from 'joi';

export const listCollections = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(12),
    categoryIds: Joi.string() // NEW: Comma-separated category UUIDs (e.g., "uuid1,uuid2,uuid3")
  })
};

export const getCollectionById = {
  params: Joi.object({
    id: Joi.string().required()
  })
};

// ============================================
// Admin Validation Schemas
// ============================================

/**
 * Schema للتحقق من بيانات إنشاء collection جديد
 */
export const createCollection = {
  body: Joi.object({
    title: Joi.string()
      .min(3)
      .max(100)
      .required()
      .messages({
        'string.empty': 'Title is required',
        'string.min': 'Title must be at least 3 characters',
        'string.max': 'Title cannot exceed 100 characters'
      }),

    description: Joi.string()
      .min(10)
      .max(500)
      .required()
      .messages({
        'string.empty': 'Description is required',
        'string.min': 'Description must be at least 10 characters',
        'string.max': 'Description cannot exceed 500 characters'
      }),

    thumbnail: Joi.string()
      .uri()
      .required()
      .messages({
        'string.empty': 'Thumbnail URL is required',
        'string.uri': 'Thumbnail must be a valid URL'
      }),

    projectIds: Joi.array()
      .items(Joi.string())
      .optional()
      .default([])
      .messages({
        'array.base': 'Project IDs must be an array'
      }),

    categoryIds: Joi.array()
      .items(Joi.string().uuid())
      .min(1)
      .optional()
      .messages({
        'array.min': 'At least one category is required',
        'array.base': 'Category IDs must be an array'
      }),

    featured: Joi.boolean()
      .optional()
      .default(false)
  })
};

/**
 * Schema للتحقق من بيانات تحديث collection
 * جميع الحقول optional
 */
export const updateCollection = {
  params: Joi.object({
    id: Joi.string().required()
  }),

  body: Joi.object({
    title: Joi.string()
      .min(3)
      .max(100)
      .optional()
      .messages({
        'string.min': 'Title must be at least 3 characters',
        'string.max': 'Title cannot exceed 100 characters'
      }),

    description: Joi.string()
      .min(10)
      .max(500)
      .optional()
      .messages({
        'string.min': 'Description must be at least 10 characters',
        'string.max': 'Description cannot exceed 500 characters'
      }),

    thumbnail: Joi.string()
      .uri()
      .optional()
      .messages({
        'string.uri': 'Thumbnail must be a valid URL'
      }),

    projectIds: Joi.array()
      .items(Joi.string())
      .optional()
      .messages({
        'array.base': 'Project IDs must be an array'
      }),

    categoryIds: Joi.array()
      .items(Joi.string().uuid())
      .min(1)
      .optional()
      .messages({
        'array.min': 'At least one category is required',
        'array.base': 'Category IDs must be an array'
      }),

    featured: Joi.boolean()
      .optional()
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};

/**
 * Schema للتحقق من معرف collection في params
 */
export const collectionIdParam = {
  params: Joi.object({
    id: Joi.string().required()
  })
};
