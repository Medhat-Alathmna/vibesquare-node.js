import { v4 as uuidv4 } from 'uuid';
import { Project } from '../../../api/project/project.model';
import { IProjectRepository, ProjectData, ProjectsResult } from '../interfaces';
import { ProjectQueryOptions, SearchOptions, SortOption, CreateProjectDTO, UpdateProjectDTO } from '../../types';

export class MongoProjectRepository implements IProjectRepository {
  private getSortOption(sortBy: SortOption): Record<string, 1 | -1> {
    switch (sortBy) {
      case 'popular': return { views: -1 };
      case 'mostLiked': return { likes: -1 };
      case 'mostDownloaded': return { downloads: -1 };
      case 'recent':
      default: return { createdAt: -1 };
    }
  }

  async findAll(options: ProjectQueryOptions): Promise<ProjectsResult> {
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
      projects: projects as unknown as ProjectData[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async search(options: SearchOptions): Promise<ProjectsResult> {
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
      projects: projects as unknown as ProjectData[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async findById(id: string): Promise<ProjectData | null> {
    const project = await Project.findOne({ id }).lean();
    return project as unknown as ProjectData | null;
  }

  async incrementStat(id: string, field: 'views' | 'likes' | 'downloads'): Promise<ProjectData | null> {
    const project = await Project.findOneAndUpdate(
      { id },
      { $inc: { [field]: 1 } },
      { new: true }
    ).lean();
    return project as unknown as ProjectData | null;
  }

  async create(data: CreateProjectDTO): Promise<ProjectData> {
    const projectData = {
      id: uuidv4(),
      ...data,
      screenshots: data.screenshots || [],
      tags: data.tags || [],
      styles: data.styles || [],
      codeFiles: data.codeFiles || [],
      collectionIds: [],
      likes: 0,
      views: 0,
      downloads: 0
    };

    const project = await Project.create(projectData);
    return project.toObject() as unknown as ProjectData;
  }

  async update(id: string, data: UpdateProjectDTO): Promise<ProjectData | null> {
    const project = await Project.findOneAndUpdate(
      { id },
      { $set: data },
      { new: true }
    ).lean();
    return project as unknown as ProjectData | null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await Project.deleteOne({ id });
    return result.deletedCount > 0;
  }
}
