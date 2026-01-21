import { Request, Response } from 'express';
import { collectionService } from './collection.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';

export const getCollections = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 12, categoryIds } = req.query;

  const result = await collectionService.getCollections(
    Number(page),
    Number(limit),
    categoryIds ? (categoryIds as string).split(',') : undefined
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

// ============================================
// Admin Controllers
// ============================================

/**
 * إنشاء collection جديد
 * POST /api/collections
 * @requires Admin access + collections.create permission
 */
export const createCollection = asyncHandler(async (req: Request, res: Response) => {
  const collection = await collectionService.createCollection(req.body);
  res.status(201).json(new ApiResponse(201, collection, 'Collection created successfully'));
});

/**
 * تحديث collection موجود
 * PATCH /api/collections/:id
 * @requires Admin access + collections.update permission
 */
export const updateCollection = asyncHandler(async (req: Request, res: Response) => {
  const collection = await collectionService.updateCollection(req.params.id, req.body);
  res.json(new ApiResponse(200, collection, 'Collection updated successfully'));
});

/**
 * حذف collection
 * DELETE /api/collections/:id
 * @requires Admin access + collections.delete permission
 */
export const deleteCollection = asyncHandler(async (req: Request, res: Response) => {
  await collectionService.deleteCollection(req.params.id);
  res.json(new ApiResponse(200, null, 'Collection deleted successfully'));
});
