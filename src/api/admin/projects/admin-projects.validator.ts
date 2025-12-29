import Joi from 'joi';
import { FRAMEWORKS, CATEGORIES } from '../../../shared/types';

const builderSchema = Joi.object({
  userId: Joi.string().optional(),
  name: Joi.string().min(1).max(100).required(),
  avatarUrl: Joi.string().uri().allow('', null).optional()
});

const builderSocialLinksSchema = Joi.object({
  github: Joi.string().uri().allow('', null).optional(),
  twitter: Joi.string().uri().allow('', null).optional(),
  linkedin: Joi.string().uri().allow('', null).optional(),
  portfolio: Joi.string().uri().allow('', null).optional()
});

const promptSchema = Joi.object({
  text: Joi.string().min(1).required(),
  model: Joi.string().min(1).required(),
  version: Joi.string().optional(),
  parameters: Joi.object().optional()
});

const codeFileSchema = Joi.object({
  filename: Joi.string().min(1).required(),
  language: Joi.string().min(1).required(),
  content: Joi.string().required(),
  path: Joi.string().optional()
});

export const adminProjectsValidator = {
  list: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      search: Joi.string().allow('').optional(),
      framework: Joi.string().valid(...FRAMEWORKS).optional(),
      category: Joi.string().valid(...CATEGORIES).optional()
    })
  },

  projectId: {
    params: Joi.object({
      id: Joi.string().required()
    })
  },

  create: {
    body: Joi.object({
      title: Joi.string().min(1).max(200).required(),
      description: Joi.string().min(1).required(),
      shortDescription: Joi.string().min(1).max(500).required(),
      thumbnail: Joi.string().uri().required(),
      screenshots: Joi.array().items(Joi.string().uri()).optional(),
      demoUrl: Joi.string().uri().allow('', null).optional(),
      downloadUrl: Joi.string().uri().allow('', null).optional(),
      prompt: promptSchema.required(),
      framework: Joi.string().valid(...FRAMEWORKS).required(),
      tags: Joi.array().items(Joi.string()).optional(),
      styles: Joi.array().items(Joi.string()).optional(),
      category: Joi.string().valid(...CATEGORIES).required(),
      codeFiles: Joi.array().items(codeFileSchema).optional(),
      builder: builderSchema.optional(),
      builderSocialLinks: builderSocialLinksSchema.optional()
    })
  },

  update: {
    params: Joi.object({
      id: Joi.string().required()
    }),
    body: Joi.object({
      title: Joi.string().min(1).max(200).optional(),
      description: Joi.string().min(1).optional(),
      shortDescription: Joi.string().min(1).max(500).optional(),
      thumbnail: Joi.string().uri().optional(),
      screenshots: Joi.array().items(Joi.string().uri()).optional(),
      demoUrl: Joi.string().uri().allow('', null).optional(),
      downloadUrl: Joi.string().uri().allow('', null).optional(),
      prompt: promptSchema.optional(),
      framework: Joi.string().valid(...FRAMEWORKS).optional(),
      tags: Joi.array().items(Joi.string()).optional(),
      styles: Joi.array().items(Joi.string()).optional(),
      category: Joi.string().valid(...CATEGORIES).optional(),
      codeFiles: Joi.array().items(codeFileSchema).optional(),
      builder: builderSchema.optional(),
      builderSocialLinks: builderSocialLinksSchema.optional()
    })
  }
};
