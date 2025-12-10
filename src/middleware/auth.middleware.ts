import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../shared/utils/ApiError';
import httpStatus from 'http-status';

// Stub for future authentication middleware
export const auth = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // TODO: Implement JWT authentication
    // const token = req.headers.authorization?.replace('Bearer ', '');
    // if (!token) {
    //   return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    // }
    // Verify token and attach user to request
    next();
  };
};
