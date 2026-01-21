import { ICategoryRepository } from '../../shared/repositories/interfaces';
import { getCategoryRepository } from '../../shared/repositories';
import {
    CategoryData,
    CreateCategoryDTO,
    UpdateCategoryDTO,
    CategoryQueryOptions,
    CategoriesResult
} from '../../shared/types';
import { generateSlug } from '../../shared/utils/slug';
import { ApiError } from '../../shared/utils/ApiError';
import httpStatus from 'http-status';

export class CategoryService {
    private categoryRepository: ICategoryRepository;

    constructor() {
        this.categoryRepository = getCategoryRepository();
    }

    /**
     * Create a new category
     * Checks for name uniqueness and generates slug
     */
    async createCategory(data: CreateCategoryDTO): Promise<CategoryData> {
        // Check if name exists
        const exists = await this.categoryRepository.existsByName(data.name);
        if (exists) {
            throw new ApiError(
                httpStatus.CONFLICT,
                `Category with name "${data.name}" already exists`
            );
        }

        return this.categoryRepository.create(data);
    }

    /**
     * Get all categories with pagination and filters
     */
    async getCategories(options: CategoryQueryOptions): Promise<CategoriesResult> {
        return this.categoryRepository.findAll(options);
    }

    /**
     * Get category by ID
     */
    async getCategoryById(id: string): Promise<CategoryData> {
        const category = await this.categoryRepository.findById(id);
        if (!category) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
        }
        return category;
    }

    /**
     * Get category by Slug
     */
    async getCategoryBySlug(slug: string): Promise<CategoryData> {
        const category = await this.categoryRepository.findBySlug(slug);
        if (!category) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
        }
        return category;
    }

    /**
     * Update category
     * Checks for name uniqueness if name is changed
     */
    async updateCategory(id: string, data: UpdateCategoryDTO): Promise<CategoryData> {
        const category = await this.categoryRepository.findById(id);
        if (!category) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
        }

        // Check name uniqueness if updating name
        if (data.name && data.name.toLowerCase() !== category.name.toLowerCase()) {
            const exists = await this.categoryRepository.existsByName(data.name, id);
            if (exists) {
                throw new ApiError(
                    httpStatus.CONFLICT,
                    `Category with name "${data.name}" already exists`
                );
            }
        }

        const updated = await this.categoryRepository.update(id, data);
        if (!updated) {
            throw new ApiError(
                httpStatus.INTERNAL_SERVER_ERROR,
                'Failed to update category'
            );
        }
        return updated;
    }

    /**
     * Soft delete category
     * Checks if category is in use by any project or collection
     */
    async deleteCategory(id: string): Promise<boolean> {
        const category = await this.categoryRepository.findById(id);
        if (!category) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
        }

        // Check usage
        const inUse = await this.categoryRepository.isCategoryInUse(id);
        if (inUse) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                'Cannot delete category because it is used in projects or collections'
            );
        }

        return this.categoryRepository.softDelete(id);
    }

    /**
     * Restore soft-deleted category
     */
    async restoreCategory(id: string): Promise<CategoryData> {
        const category = await this.categoryRepository.restore(id);
        if (!category) {
            throw new ApiError(
                httpStatus.NOT_FOUND,
                'Category not found or not deleted'
            );
        }
        return category;
    }
}

export const categoryService = new CategoryService();
