import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../shared/utils/ApiError';
import httpStatus from 'http-status';
import { getCollectionRepository } from '../shared/repositories';

// Helper to get repo
const getRepo = () => getCollectionRepository();

export const canViewCollection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const repo = getRepo();
        const collection = await repo.findById(id);

        if (!collection) {
            return next(new ApiError(httpStatus.NOT_FOUND, 'Collection not found'));
        }

        // Public collections are visible to everyone
        if (collection.visibility === 'public') {
            return next();
        }

        // Private collections require authentication
        if (!req.user) {
            return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required to view private collection'));
        }

        // Check ownership
        const isOwner = collection.ownerType === 'gallery_user' && collection.ownerId === req.user.id;
        const isAdmin = req.role && req.role.canAccessAdmin;

        if (isOwner || isAdmin) {
            return next();
        }

        return next(new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to view this collection'));
    } catch (error) {
        next(error);
    }
};

export const canModifyCollection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const repo = getRepo();
        const collection = await repo.findById(id);

        if (!collection) {
            return next(new ApiError(httpStatus.NOT_FOUND, 'Collection not found'));
        }

        if (!req.user) {
            return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
        }

        // System collections can only be modified by admins
        if (collection.ownerType === 'system') {
            if (req.role && req.role.canAccessAdmin) {
                return next();
            }
            return next(new ApiError(httpStatus.FORBIDDEN, 'Only admins can modify system collections'));
        }

        // User collections can be modified by owner or admin
        const isOwner = collection.ownerType === 'gallery_user' && collection.ownerId === req.user.id;
        const isAdmin = req.role && req.role.canAccessAdmin;

        if (isOwner || isAdmin) {
            return next();
        }

        return next(new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to modify this collection'));
    } catch (error) {
        next(error);
    }
};
