import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { categoryService } from './category.service';
import { CategoryQueryOptions } from '../../shared/types';

export class CategoryController {

    /**
     * Create a new category (Admin)
     */
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const category = await categoryService.createCategory(req.body);
            res.status(httpStatus.CREATED).json(category);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all categories (Public)
     * Supports pagination, filtering
     */
    async list(req: Request, res: Response, next: NextFunction) {
        try {
            // Validator already converted types and applied defaults
            const options: CategoryQueryOptions = {
                page: req.query.page as unknown as number,
                limit: req.query.limit as unknown as number,
                isActive: req.query.isActive as unknown as boolean | undefined,
                includeDeleted: req.query.includeDeleted as unknown as boolean
            };

            const result = await categoryService.getCategories(options);
            res.status(httpStatus.OK).json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get category by ID (Public)
     */
    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const category = await categoryService.getCategoryById(req.params.id);
            res.status(httpStatus.OK).json(category);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get category by Slug (Public)
     */
    async getBySlug(req: Request, res: Response, next: NextFunction) {
        try {
            const category = await categoryService.getCategoryBySlug(req.params.slug);
            res.status(httpStatus.OK).json(category);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update category (Admin)
     */
    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const category = await categoryService.updateCategory(req.params.id, req.body);
            res.status(httpStatus.OK).json(category);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete category (Admin)
     */
    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            await categoryService.deleteCategory(req.params.id);
            res.status(httpStatus.NO_CONTENT).send();
        } catch (error) {
            next(error);
        }
    }

    /**
     * Restore category (Admin)
     */
    async restore(req: Request, res: Response, next: NextFunction) {
        try {
            const category = await categoryService.restoreCategory(req.params.id);
            res.status(httpStatus.OK).json(category);
        } catch (error) {
            next(error);
        }
    }
}

export const categoryController = new CategoryController();
