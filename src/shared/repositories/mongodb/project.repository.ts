import { v4 as uuidv4 } from 'uuid';
import { Project } from '../../../api/project/project.model';
import { IProjectRepository, ProjectData, ProjectListResult, ProjectSummary } from '../interfaces';
import { ProjectQueryOptions, SearchOptions, SortOption, CreateProjectDTO, UpdateProjectDTO } from '../../types';

// Fields to select for list view (summary)
const SUMMARY_FIELDS = {
  id: 1,
  title: 1,
  shortDescription: 1,
  thumbnail: 1,
  framework: 1,
  category: 1,
  tags: 1,
  likes: 1,
  views: 1,
  downloads: 1,
  createdAt: 1,
  'builder.name': 1,
  'builder.avatarUrl': 1
};

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

  private mapToSummary(doc: any): ProjectSummary {
    return {
      id: doc.id,
      title: doc.title,
      shortDescription: doc.shortDescription,
      thumbnail: doc.thumbnail,
      framework: doc.framework,
      category: doc.category,
      tags: doc.tags || [],
      likes: doc.likes || 0,
      views: doc.views || 0,
      downloads: doc.downloads || 0,
      createdAt: doc.createdAt,
      builder: doc.builder ? {
        name: doc.builder.name,
        avatarUrl: doc.builder.avatarUrl
      } : undefined
    };
  }

  async findAll(options: ProjectQueryOptions): Promise<ProjectListResult> {
    const { page = 1, limit = 12, framework, category, tags, sortBy = 'recent' } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (framework) filter.framework = framework;
    if (category) filter.category = category;
    if (tags && tags.length > 0) filter.tags = { $in: tags };

    const sort = this.getSortOption(sortBy);

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .select(SUMMARY_FIELDS)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments(filter)
    ]);

    return {
      projects: projects.map(p => this.mapToSummary(p)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async search(options: SearchOptions): Promise<ProjectListResult> {
    const { query, frameworks, categories, tags, sortBy = 'recent', page = 1, limit = 12 } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (query) {
      filter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { shortDescription: { $regex: query, $options: 'i' } }
      ];
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
        .select(SUMMARY_FIELDS)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments(filter)
    ]);

    return {
      projects: projects.map(p => this.mapToSummary(p)),
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

  async findByIds(ids: string[]): Promise<ProjectSummary[]> {
    if (ids.length === 0) return [];

    const projects = await Project.find({ id: { $in: ids } })
      .select(SUMMARY_FIELDS)
      .lean();

    return projects.map(p => this.mapToSummary(p));
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
