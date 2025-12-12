import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../shared/utils/ApiError';
import httpStatus from 'http-status';
import { tokenService } from '../api/auth/services/token.service';
import { userRepository, roleRepository } from '../shared/repositories/postgres/auth.repository';
import { JWTPayload, IUser, IRole } from '../api/auth/auth.types';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      role?: IRole;
      jwtPayload?: JWTPayload;
    }
  }
}

/**
 * Authentication middleware - verifies JWT token
 * @param required - If true, throws error when no token. If false, continues without user.
 */
export const authenticate = (required = true) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        if (required) {
          return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
        }
        return next();
      }

      // Verify token
      const payload = tokenService.verifyAccessToken(token);

      if (!payload) {
        if (required) {
          return next(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired token'));
        }
        return next();
      }

      // Get user from database
      const user = await userRepository.findById(payload.sub);

      if (!user) {
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'User not found'));
      }

      if (!user.isActive) {
        return next(new ApiError(httpStatus.FORBIDDEN, 'Account is deactivated'));
      }

      // Check if password was changed after token was issued
      if (user.passwordChangedAt) {
        const passwordChangedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
        if (payload.iat < passwordChangedTimestamp) {
          return next(new ApiError(httpStatus.UNAUTHORIZED, 'Password was changed. Please login again.'));
        }
      }

      // Get role if user has one
      let role: IRole | null = null;
      if (user.roleId) {
        role = await roleRepository.findById(user.roleId);
      }

      // Attach to request
      req.user = user;
      req.role = role || undefined;
      req.jwtPayload = payload;

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = () => authenticate(false);

/**
 * Require email verification
 */
export const requireEmailVerified = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    if (!req.user.emailVerified) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'Email verification required'));
    }

    next();
  };
};

/**
 * Require admin panel access
 */
export const requireAdminAccess = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    if (!req.role || !req.role.canAccessAdmin) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'Admin access required'));
    }

    next();
  };
};

/**
 * Require specific permission(s)
 * @param permissions - Permission name(s) to check
 * @param requireAll - If true, user must have ALL permissions. If false, ANY permission is enough.
 */
export const requirePermission = (permissions: string | string[], requireAll = false) => {
  const permissionArray = Array.isArray(permissions) ? permissions : [permissions];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    if (!req.role) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'No role assigned'));
    }

    const userPermissions = req.role.permissions || [];

    let hasPermission: boolean;
    if (requireAll) {
      hasPermission = permissionArray.every(p => userPermissions.includes(p));
    } else {
      hasPermission = permissionArray.some(p => userPermissions.includes(p));
    }

    if (!hasPermission) {
      return next(new ApiError(
        httpStatus.FORBIDDEN,
        `Missing required permission(s): ${permissionArray.join(', ')}`
      ));
    }

    next();
  };
};

/**
 * Require specific role
 */
export const requireRole = (roleName: string | string[]) => {
  const roleNames = Array.isArray(roleName) ? roleName : [roleName];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    if (!req.role) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'No role assigned'));
    }

    if (!roleNames.includes(req.role.name)) {
      return next(new ApiError(
        httpStatus.FORBIDDEN,
        `Required role: ${roleNames.join(' or ')}`
      ));
    }

    next();
  };
};

/**
 * Require active subscription tier
 */
export const requireSubscription = (tiers: string | string[]) => {
  const tierArray = Array.isArray(tiers) ? tiers : [tiers];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    if (!tierArray.includes(req.user.subscriptionTier)) {
      return next(new ApiError(
        httpStatus.FORBIDDEN,
        `This feature requires ${tierArray.join(' or ')} subscription`
      ));
    }

    next();
  };
};

// Legacy export for backward compatibility
export const auth = authenticate;
