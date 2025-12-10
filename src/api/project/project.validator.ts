import Joi from 'joi';
import { FRAMEWORKS, CATEGORIES, SORT_OPTIONS } from '../../shared/types';

export const listProjects = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(12),
    framework: Joi.string().valid(...FRAMEWORKS),
    category: Joi.string().valid(...CATEGORIES),
    tags: Joi.string(),
    sortBy: Joi.string().valid(...SORT_OPTIONS).default('recent')
  })
};

export const searchProjects = {
  query: Joi.object({
    q: Joi.string().min(2).max(100),
    frameworks: Joi.string(),
    categories: Joi.string(),
    tags: Joi.string(),
    sortBy: Joi.string().valid(...SORT_OPTIONS).default('recent'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(12)
  })
};

export const getProjectById = {
  params: Joi.object({
    id: Joi.string().required()
  })
};
