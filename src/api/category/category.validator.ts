import Joi from 'joi';

export const listCategories = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        isActive: Joi.boolean(),
        includeDeleted: Joi.boolean().default(false)
    })
};

export const createCategory = {
    body: Joi.object({
        name: Joi.string().min(2).max(100).required(),
        description: Joi.string().max(500).optional().allow(''),
        isActive: Joi.boolean().optional().default(true)
    })
};

export const updateCategory = {
    params: Joi.object({
        id: Joi.string().uuid().required()
    }),
    body: Joi.object({
        name: Joi.string().min(2).max(100).optional(),
        description: Joi.string().max(500).optional().allow(''),
        isActive: Joi.boolean().optional()
    }).min(1)
};

export const categoryIdParam = {
    params: Joi.object({
        id: Joi.string().uuid().required()
    })
};
