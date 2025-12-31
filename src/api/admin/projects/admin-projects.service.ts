import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import { getProjectRepository, ProjectData, ProjectListResult } from '../../../shared/repositories';
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
    const project = await this.repository.create(data);
    return project;
  }

  async updateProject(id: string, data: UpdateProjectDTO): Promise<ProjectData> {
    const existingProject = await this.repository.findById(id);

    if (!existingProject) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    const updatedProject = await this.repository.update(id, data);

    if (!updatedProject) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update project');
    }

    return updatedProject;
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
