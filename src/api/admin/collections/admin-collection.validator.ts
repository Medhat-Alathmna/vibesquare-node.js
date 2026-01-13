import Joi from 'joi';

export const listAdminCollections = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(50).default(12),
        search: Joi.string().allow('').optional(),
        sort: Joi.string().valid('newest', 'oldest', 'popular', 'featured').default('newest'),
        visibility: Joi.string().valid('public', 'private').optional(),
        ownerType: Joi.string().valid('system', 'gallery_user').optional(),
        isDeleted: Joi.boolean().optional()
    })
};

export const createSystemCollection = {
    body: Joi.object({
        title: Joi.string().min(3).max(100).required(),
        description: Joi.string().min(10).max(1000).required(),
        thumbnail: Joi.string().uri().required(),
        tags: Joi.array().items(Joi.string().max(50).lowercase()).max(10).default([]),
        visibility: Joi.string().valid('public', 'private').default('public'),
        featured: Joi.boolean().default(false)
    })
};

export const updateAdminCollection = {
    params: Joi.object({
        id: Joi.string().required()
    }),
    body: Joi.object({
        title: Joi.string().min(3).max(100),
        description: Joi.string().min(10).max(1000),
        thumbnail: Joi.string().uri(),
        tags: Joi.array().items(Joi.string().max(50).lowercase()).max(10),
        visibility: Joi.string().valid('public', 'private'),
        featured: Joi.boolean(),
        isDeleted: Joi.boolean()
    }).min(1)
};
