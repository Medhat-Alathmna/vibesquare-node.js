import { Request, Response } from 'express';
import { collectionService } from './collection.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';

export const getCollections = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 12, search, sort, visibility } = req.query;

  const result = await collectionService.getCollections(
    Number(page),
    Number(limit),
    {
      search: search as string,
      sort: sort as string, // Validator ensures valid values
      visibility: visibility as string
    }
  );

  res.json(new ApiResponse(200, result, 'Collections retrieved successfully'));
});

export const getCollectionById = asyncHandler(async (req: Request, res: Response) => {
  const collection = await collectionService.getCollectionById(req.params.id);
  res.json(new ApiResponse(200, collection, 'Collection retrieved successfully'));
});

export const getFeaturedCollections = asyncHandler(async (req: Request, res: Response) => {
  const collections = await collectionService.getFeaturedCollections();
  res.json(new ApiResponse(200, collections, 'Featured collections retrieved successfully'));
});

export const trackProjectClick = asyncHandler(async (req: Request, res: Response) => {
  const { id, projectId } = req.params;
  await collectionService.trackProjectClick(id, projectId);
  res.json(new ApiResponse(200, null, 'Project click tracked'));
});
export const getCollectionShareMetadata = asyncHandler(async (req: Request, res: Response) => {
  const metadata = await collectionService.getShareMetadata(req.params.id);
  res.json(new ApiResponse(200, metadata, 'Collection share metadata retrieved successfully'));
});
