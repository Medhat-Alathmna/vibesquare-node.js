import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from '../shared/utils/ApiError';
import httpStatus from 'http-status';

interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validSchema = Object.keys(schema) as (keyof ValidationSchema)[];
    const object = validSchema.reduce((obj: Record<string, any>, key) => {
      if (Object.prototype.hasOwnProperty.call(req, key)) {
        obj[key] = req[key];
      }
      return obj;
    }, {});

    const compiled = Joi.object(schema);
    const { value, error } = compiled
      .prefs({ errors: { label: 'key' }, abortEarly: false })
      .validate(object);

    if (error) {
      const errorMessage = error.details
        .map((details) => details.message)
        .join(', ');
      return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
    }

    Object.assign(req, value);
    return next();
  };
};
