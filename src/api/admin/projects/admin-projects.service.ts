import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import { getProjectRepository, getCategoryRepository, ProjectData, ProjectListResult } from '../../../shared/repositories';
import { CreateProjectDTO, UpdateProjectDTO, Framework, Category } from '../../../shared/types';

interface ListProjectsOptions {
  page: number;
  limit: number;
  search?: string;
  framework?: Framework;
  category?: Category;
}

export class AdminProjectsService {
  private get repository() {
    return getProjectRepository();
  }

  async listProjects(options: ListProjectsOptions): Promise<ProjectListResult> {
    const { page, limit, search, framework, category } = options;

    if (search) {
      return this.repository.search({
        query: search,
        frameworks: framework ? [framework] : undefined,
        categories: category ? [category] : undefined,
        page,
        limit,
        sortBy: 'recent'
      });
    }

    return this.repository.findAll({
      page,
      limit,
      framework,
      category,
      sortBy: 'recent'
    });
  }

  async getProjectById(id: string): Promise<ProjectData> {
    const project = await this.repository.findById(id);

    if (!project) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    return project;
  }

  async createProject(data: CreateProjectDTO): Promise<ProjectData> {
    // If categoryIds provided, validate they exist
    if (data.categoryIds && data.categoryIds.length > 0) {
      const categoryRepo = getCategoryRepository();
      const categories = await categoryRepo.findByIds(data.categoryIds);

      if (categories.length !== data.categoryIds.length) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'One or more category IDs are invalid'
        );
      }
    }

    // Create project
    const project = await this.repository.create(data);

    // Link categories if provided
    if (data.categoryIds && data.categoryIds.length > 0) {
      const categoryRepo = getCategoryRepository();
      await categoryRepo.addToProject(project.id, data.categoryIds);
    }

    // Return project with categories
    return this.repository.findById(project.id) as Promise<ProjectData>;
  }

  async updateProject(id: string, data: UpdateProjectDTO): Promise<ProjectData> {
    const existingProject = await this.repository.findById(id);

    if (!existingProject) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    // If categoryIds provided, validate and update them
    if (data.categoryIds) {
      if (data.categoryIds.length === 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'At least one category is required'
        );
      }

      const categoryRepo = getCategoryRepository();
      const categories = await categoryRepo.findByIds(data.categoryIds);

      if (categories.length !== data.categoryIds.length) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'One or more category IDs are invalid'
        );
      }

      // Get existing categories
      const existingCategories = await categoryRepo.getProjectCategories(id);
      const existingCategoryIds = existingCategories.map(c => c.id);

      // Remove old categories
      if (existingCategoryIds.length > 0) {
        await categoryRepo.removeFromProject(id, existingCategoryIds);
      }

      // Add new categories
      await categoryRepo.addToProject(id, data.categoryIds);
    }

    // Update project
    const updatedProject = await this.repository.update(id, data);

    if (!updatedProject) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update project');
    }

    // Return project with updated categories
    return this.repository.findById(id) as Promise<ProjectData>;
  }

  async deleteProject(id: string): Promise<void> {
    const existingProject = await this.repository.findById(id);

    if (!existingProject) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    const deleted = await this.repository.delete(id);

    if (!deleted) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete project');
    }
  }
}

export const adminProjectsService = new AdminProjectsService();
