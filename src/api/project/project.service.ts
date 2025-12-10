import { Project, IProject } from './project.model';
import { ApiError } from '../../shared/utils/ApiError';
import { ProjectQueryOptions, SearchOptions, PaginationResult, SortOption } from '../../shared/types';
import httpStatus from 'http-status';

interface ProjectsResult {
  projects: IProject[];
  pagination: PaginationResult;
}

export class ProjectService {
  async getProjects(options: ProjectQueryOptions): Promise<ProjectsResult> {
    const { page = 1, limit = 12, framework, category, tags, sortBy = 'recent' } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (framework) filter.framework = framework;
    if (category) filter.category = category;
    if (tags && tags.length > 0) filter.tags = { $in: tags };

    const sort = this.getSortOption(sortBy);

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .select('-codeFiles')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments(filter)
    ]);

    return {
      projects: projects as IProject[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async searchProjects(options: SearchOptions): Promise<ProjectsResult> {
    const { query, frameworks, categories, tags, sortBy = 'recent', page = 1, limit = 12 } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query) {
      filter.$text = { $search: query };
    }
    if (frameworks && frameworks.length > 0) {
      filter.framework = { $in: frameworks };
    }
    if (categories && categories.length > 0) {
      filter.category = { $in: categories };
    }
    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    const sort = this.getSortOption(sortBy);

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .select('-codeFiles')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments(filter)
    ]);

    return {
      projects: projects as IProject[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async getProjectById(id: string): Promise<IProject> {
    const project = await Project.findOne({ id }).lean();
    if (!project) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }
    return project as IProject;
  }

  async incrementStat(id: string, field: 'views' | 'likes' | 'downloads'): Promise<IProject> {
    const project = await Project.findOneAndUpdate(
      { id },
      { $inc: { [field]: 1 } },
      { new: true }
    );
    if (!project) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }
    return project;
  }

  private getSortOption(sortBy: SortOption): Record<string, 1 | -1> {
    switch (sortBy) {
      case 'popular':
        return { views: -1 };
      case 'mostLiked':
        return { likes: -1 };
      case 'mostDownloaded':
        return { downloads: -1 };
      case 'recent':
      default:
        return { createdAt: -1 };
    }
  }
}

export const projectService = new ProjectService();
