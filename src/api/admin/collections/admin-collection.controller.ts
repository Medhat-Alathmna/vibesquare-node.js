import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { collectionService } from '../../collection/collection.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';

export const listCollections = asyncHandler(async (req: Request, res: Response) => {
    const result = await collectionService.getCollections(
        req.query.page as any,
        req.query.limit as any,
        {
            search: req.query.search as string,
            sort: req.query.sort as any,
            visibility: req.query.visibility as any
        } // TODO: Pass Admin filters (ownerType, isDeleted) when service supports it
    );
    res.status(httpStatus.OK).json(result);
});

export const getCollection = asyncHandler(async (req: Request, res: Response) => {
    const collection = await collectionService.getCollectionById(req.params.id);
    res.status(httpStatus.OK).json(collection);
});

export const createCollection = asyncHandler(async (req: Request, res: Response) => {
    const collection = await collectionService.createSystemCollection(req.body);
    res.status(httpStatus.CREATED).json(collection);
});

export const updateCollection = asyncHandler(async (req: Request, res: Response) => {
    const collection = await collectionService.updateCollection(req.params.id, req.body);
    res.status(httpStatus.OK).json(collection);
});

export const deleteCollection = asyncHandler(async (req: Request, res: Response) => {
    await collectionService.softDeleteCollection(req.params.id);
    res.status(httpStatus.NO_CONTENT).send();
});

export const restoreCollection = asyncHandler(async (req: Request, res: Response) => {
    await collectionService.restoreCollection(req.params.id);
    res.status(httpStatus.OK).json({ message: 'Collection restored' });
});

export const addProject = asyncHandler(async (req: Request, res: Response) => {
    await collectionService.addProject(req.params.id, req.body);
    res.status(httpStatus.OK).json({ message: 'Project added to collection' });
});

export const removeProject = asyncHandler(async (req: Request, res: Response) => {
    await collectionService.removeProject(req.params.id, req.params.projectId);
    res.status(httpStatus.OK).json({ message: 'Project removed from collection' });
});

export const reorderProjects = asyncHandler(async (req: Request, res: Response) => {
    await collectionService.reorderProjects(req.params.id, req.body.projectIds);
    res.status(httpStatus.OK).json({ message: 'Projects reordered' });
});
