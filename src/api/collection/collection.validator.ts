import Joi from 'joi';
import { Visibility } from './collection.types';

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const listCollections = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(12),
    search: Joi.string().allow('').optional(),
    sort: Joi.string().valid('newest', 'oldest', 'popular', 'featured').default('newest'),
    visibility: Joi.string().valid('public', 'private').optional()
  })
};

export const getCollectionById = {
  params: Joi.object({
    id: Joi.string().required()
  })
};

export const createCollection = {
  body: Joi.object({
    title: Joi.string().min(3).max(100).required(),
    description: Joi.string().min(10).max(1000).required(),
    thumbnail: Joi.string().uri().required(),
    tags: Joi.array().items(Joi.string().max(50).lowercase()).max(10).default([]),
    visibility: Joi.string().valid('public', 'private').default('public')
  })
};

export const updateCollection = {
  params: Joi.object({
    id: Joi.string().required()
  }),
  body: Joi.object({
    title: Joi.string().min(3).max(100),
    description: Joi.string().min(10).max(1000),
    thumbnail: Joi.string().uri(),
    tags: Joi.array().items(Joi.string().max(50).lowercase()).max(10),
    visibility: Joi.string().valid('public', 'private'),
    featured: Joi.boolean()
  }).min(1)
};

export const addProject = {
  params: Joi.object({
    id: Joi.string().required()
  }),
  body: Joi.object({
    projectId: Joi.string().required(),
    position: Joi.number().default(1000),
    notes: Joi.string().max(500).allow('').optional()
  })
};

export const reorderProjects = {
  params: Joi.object({
    id: Joi.string().required()
  }),
  body: Joi.object({
    projectIds: Joi.array().items(Joi.string().required()).min(1).required()
  })
};

export const removeProject = {
  params: Joi.object({
    id: Joi.string().required(),
    projectId: Joi.string().required()
  })
};
