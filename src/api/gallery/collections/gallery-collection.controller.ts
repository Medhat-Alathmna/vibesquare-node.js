import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { collectionService } from '../../collection/collection.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';

export const createCollection = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id; // Authenticated user
    const collection = await collectionService.createUserCollection(userId, req.body);
    res.status(httpStatus.CREATED).json(new ApiResponse(httpStatus.CREATED, collection, 'Collection created successfully'));
});

export const getMyCollections = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const collections = await collectionService.getCollectionsByOwner(userId, 'gallery_user');
    res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, collections, 'My collections retrieved successfully'));
});

export const updateCollection = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id; // Used for ownership check in service if needed, though middleware might handle
    const collection = await collectionService.updateUserCollection(req.params.id, userId, req.body);
    res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, collection, 'Collection updated successfully'));
});

export const deleteCollection = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    await collectionService.deleteUserCollection(req.params.id, userId);
    res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, null, 'Collection deleted successfully'));
});

export const addProject = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id; // Pass to service to verify ownership of collection
    await collectionService.addUserCollectionProject(req.params.id, userId, req.body);
    res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, null, 'Project added to collection'));
});

export const removeProject = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    await collectionService.removeUserCollectionProject(req.params.id, userId, req.params.projectId);
    res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, null, 'Project removed from collection'));
});

export const reorderProjects = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    await collectionService.reorderUserCollectionProjects(req.params.id, userId, req.body.projectIds);
    res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, null, 'Projects reordered'));
});
