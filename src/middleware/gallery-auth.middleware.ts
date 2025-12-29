import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../shared/utils/ApiError';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { galleryUserRepository } from '../shared/repositories/postgres/gallery.repository';
import {
  IGalleryUser,
  GalleryJWTPayload,
  GallerySubscriptionTier,
  FREE_USER_DOWNLOAD_COOLDOWN_MS
} from '../api/gallery/gallery.types';

// Extend Express Request type for Gallery Users
declare global {
  namespace Express {
    interface Request {
      galleryUser?: IGalleryUser;
      galleryJwtPayload?: GalleryJWTPayload;
    }
  }
}

/**
 * Gallery Authentication middleware - verifies JWT token for gallery users
 * @param required - If true, throws error when no token. If false, continues without user.
 */
export const galleryAuthenticate = (required = true) => {
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
      let payload: GalleryJWTPayload;
      try {
        payload = jwt.verify(token, env.JWT_SECRET) as GalleryJWTPayload;
      } catch (error) {
        if (required) {
          return next(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired token'));
        }
        return next();
      }

      // Ensure this is a gallery token
      if (payload.type !== 'gallery') {
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token type'));
      }

      // Get user from database
      const user = await galleryUserRepository.findById(payload.sub);

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

      // Attach to request
      req.galleryUser = user;
      req.galleryJwtPayload = payload;

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional gallery authentication - doesn't fail if no token
 */
export const optionalGalleryAuth = () => galleryAuthenticate(false);

/**
 * Require email verification for gallery users
 */
export const requireGalleryEmailVerified = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.galleryUser) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    if (!req.galleryUser.emailVerified) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'Email verification required'));
    }

    next();
  };
};

/**
 * Require premium subscription for gallery users
 */
export const requireGalleryPremium = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.galleryUser) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    if (req.galleryUser.subscriptionTier !== 'pro') {
      return next(new ApiError(
        httpStatus.FORBIDDEN,
        'This feature requires a Pro subscription'
      ));
    }

    next();
  };
};

/**
 * Require specific subscription tier for gallery users
 */
export const requireGallerySubscription = (tiers: GallerySubscriptionTier | GallerySubscriptionTier[]) => {
  const tierArray = Array.isArray(tiers) ? tiers : [tiers];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.galleryUser) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    if (!tierArray.includes(req.galleryUser.subscriptionTier)) {
      return next(new ApiError(
        httpStatus.FORBIDDEN,
        `This feature requires ${tierArray.join(' or ')} subscription`
      ));
    }

    next();
  };
};

/**
 * Check if user can download (respects cooldown for free users)
 * Does NOT block - just attaches canDownload info to request
 */
export const checkDownloadEligibility = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.galleryUser) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    // Premium users can always download
    if (req.galleryUser.subscriptionTier === 'pro') {
      (req as any).canDownload = true;
      (req as any).downloadBlockReason = null;
      return next();
    }

    // Free users: check cooldown
    if (!req.galleryUser.lastDownloadAt) {
      // Never downloaded before - can download
      (req as any).canDownload = true;
      (req as any).downloadBlockReason = null;
      return next();
    }

    const lastDownload = req.galleryUser.lastDownloadAt.getTime();
    const now = Date.now();
    const cooldownEnd = lastDownload + FREE_USER_DOWNLOAD_COOLDOWN_MS;

    if (now >= cooldownEnd) {
      // Cooldown passed - can download
      (req as any).canDownload = true;
      (req as any).downloadBlockReason = null;
    } else {
      // Still in cooldown
      (req as any).canDownload = false;
      (req as any).downloadBlockReason = 'cooldown';
      (req as any).nextDownloadAt = new Date(cooldownEnd);
      (req as any).remainingCooldown = Math.ceil((cooldownEnd - now) / 1000);
    }

    next();
  };
};

/**
 * Require download eligibility - blocks if user can't download
 */
export const requireDownloadEligibility = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.galleryUser) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    if (!req.galleryUser.emailVerified) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'Email verification required to download'));
    }

    // Premium users can always download
    if (req.galleryUser.subscriptionTier === 'pro') {
      return next();
    }

    // Free users: check cooldown
    if (!req.galleryUser.lastDownloadAt) {
      // Never downloaded before - can download
      return next();
    }

    const lastDownload = req.galleryUser.lastDownloadAt.getTime();
    const now = Date.now();
    const cooldownEnd = lastDownload + FREE_USER_DOWNLOAD_COOLDOWN_MS;

    if (now >= cooldownEnd) {
      // Cooldown passed - can download
      return next();
    }

    // Still in cooldown - calculate remaining time
    const remainingMs = cooldownEnd - now;
    const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    let timeMessage: string;
    if (remainingDays > 1) {
      timeMessage = `${remainingDays} days`;
    } else if (remainingHours > 1) {
      timeMessage = `${remainingHours} hours`;
    } else {
      timeMessage = 'less than an hour';
    }

    return next(new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      `Download limit reached. Free users can download once every 3 days. Try again in ${timeMessage}, or upgrade to Premium for unlimited downloads.`,
      false,
      '',
      {
        reason: 'cooldown',
        nextDownloadAt: new Date(cooldownEnd).toISOString(),
        remainingSeconds: Math.ceil(remainingMs / 1000)
      }
    ));
  };
};

/**
 * Require AI usage eligibility - only for premium users
 */
export const requireAIEligibility = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.galleryUser) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    if (!req.galleryUser.emailVerified) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'Email verification required to use AI features'));
    }

    if (req.galleryUser.subscriptionTier !== 'pro') {
      return next(new ApiError(
        httpStatus.FORBIDDEN,
        'AI features require a Premium subscription. Upgrade now to unlock AI-powered features.'
      ));
    }

    next();
  };
};
