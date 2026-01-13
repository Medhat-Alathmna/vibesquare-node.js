import Joi from 'joi';

export const createGalleryCollection = {
    body: Joi.object({
        title: Joi.string().min(3).max(100).required(),
        description: Joi.string().min(0).max(1000).allow('').optional(), // Optional for users
        thumbnail: Joi.string().uri().optional(), // Optional, could default
        tags: Joi.array().items(Joi.string().max(50).lowercase()).max(10).default([]),
        visibility: Joi.string().valid('public', 'private').default('public')
    })
};

export const updateGalleryCollection = {
    params: Joi.object({
        id: Joi.string().required()
    }),
    body: Joi.object({
        title: Joi.string().min(3).max(100),
        description: Joi.string().min(0).max(1000).allow(''),
        thumbnail: Joi.string().uri(),
        tags: Joi.array().items(Joi.string().max(50).lowercase()).max(10),
        visibility: Joi.string().valid('public', 'private')
    }).min(1)
};
