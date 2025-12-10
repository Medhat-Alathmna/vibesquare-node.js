import Joi from 'joi';
import { LLM_TYPES } from '../../shared/types';

export const analyzeUrl = {
  body: Joi.object({
    url: Joi.string().uri().required(),
    llmType: Joi.string().valid(...LLM_TYPES).required()
  })
};
