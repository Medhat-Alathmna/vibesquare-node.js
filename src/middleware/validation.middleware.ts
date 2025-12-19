import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from '../shared/utils/ApiError';
import httpStatus from 'http-status';

interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

export const validate = (schema: ValidationSchema | Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // If schema is a Joi object directly (for body validation), validate body
    if (Joi.isSchema(schema)) {
      const { value, error } = (schema as Joi.ObjectSchema)
        .prefs({ errors: { label: 'key' }, abortEarly: false })
        .validate(req.body);

      if (error) {
        const errorMessage = error.details
          .map((details) => details.message)
          .join(', ');
        return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
      }

      req.body = value;
      return next();
    }

    // Otherwise, validate body, query, and params separately
    const validationSchema = schema as ValidationSchema;
    const errors: string[] = [];

    if (validationSchema.body) {
      const { value, error } = validationSchema.body
        .prefs({ errors: { label: 'key' }, abortEarly: false })
        .validate(req.body);
      if (error) {
        errors.push(...error.details.map(d => d.message));
      } else {
        req.body = value;
      }
    }

    if (validationSchema.query) {
      const { value, error } = validationSchema.query
        .prefs({ errors: { label: 'key' }, abortEarly: false })
        .validate(req.query);
      if (error) {
        errors.push(...error.details.map(d => d.message));
      } else {
        // Modify query object in place instead of replacing it
        // because req.query is a getter-only property in Express
        Object.keys(req.query).forEach(key => {
          delete (req.query as Record<string, unknown>)[key];
        });
        Object.assign(req.query, value);
      }
    }

    if (validationSchema.params) {
      const { value, error } = validationSchema.params
        .prefs({ errors: { label: 'key' }, abortEarly: false })
        .validate(req.params);
      if (error) {
        errors.push(...error.details.map(d => d.message));
      } else {
        req.params = value;
      }
    }

    if (errors.length > 0) {
      return next(new ApiError(httpStatus.BAD_REQUEST, errors.join(', ')));
    }

    return next();
  };
};
