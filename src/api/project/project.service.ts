import { getProjectRepository, ProjectData, ProjectListResult } from '../../shared/repositories';
import { ApiError } from '../../shared/utils/ApiError';
import { ProjectQueryOptions, SearchOptions } from '../../shared/types';
import httpStatus from 'http-status';

export class ProjectService {
  private get repository() {
    return getProjectRepository();
  }

  async getProjects(options: ProjectQueryOptions): Promise<ProjectListResult> {
    return this.repository.findAll(options);
  }

  async searchProjects(options: SearchOptions): Promise<ProjectListResult> {
    return this.repository.search(options);
  }

  async getProjectById(id: string): Promise<ProjectData> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }
    return project;
  }

  async incrementStat(id: string, field: 'views' | 'likes' | 'downloads'): Promise<ProjectData> {
    const project = await this.repository.incrementStat(id, field);
    if (!project) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }
    return project;
  }
}

export const projectService = new ProjectService();
