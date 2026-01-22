import { v4 as uuidv4 } from 'uuid';
import { getKnex } from '../../../config/knex';
import { IProjectRepository, ProjectData, ProjectListResult, ProjectSummary } from '../interfaces';
import { ProjectQueryOptions, SearchOptions, SortOption, CreateProjectDTO, UpdateProjectDTO } from '../../types';
import { getCategoryRepository } from '../index';

export class PostgresProjectRepository implements IProjectRepository {
  private get db() {
    return getKnex();
  }

  // Map row to summary (for list views)
  private mapRowToSummary(row: any): ProjectSummary {
    return {
      id: row.id,
      title: row.title,
      shortDescription: row.short_description,
      thumbnail: row.thumbnail,
      framework: row.framework,
      category: row.category,
      likes: row.likes || 0,
      views: row.views || 0,
      downloads: row.downloads || 0,
      createdAt: row.created_at,
      builder: row.builder ? {
        name: row.builder.name,
        avatarUrl: row.builder.avatarUrl
      } : undefined
    };
  }

  // Map row to full project (for detail view)
  private mapRowToProject(row: any): ProjectData {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      shortDescription: row.short_description,
      thumbnail: row.thumbnail,
      screenshots: row.screenshots || [],
      demoUrl: row.demo_url,
      downloadUrl: row.download_url,
      sourceCodeFile: row.source_code_file,
      prompt: row.prompt || {},
      framework: row.framework,
      styles: row.styles || [],
      category: row.category,
      likes: row.likes || 0,
      views: row.views || 0,
      downloads: row.downloads || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      collectionIds: row.collection_ids || [],
      builder: row.builder,
      builderSocialLinks: row.builder_social_links
    };
  }

  private getSortColumn(sortBy: SortOption): string {
    switch (sortBy) {
      case 'popular': return 'views DESC';
      case 'mostLiked': return 'likes DESC';
      case 'mostDownloaded': return 'downloads DESC';
      case 'recent':
      default: return 'created_at DESC';
    }
  }

  async findAll(options: ProjectQueryOptions): Promise<ProjectListResult> {
    const { page = 1, limit = 12, framework, category, categoryIds, sortBy = 'recent' } = options;
    const offset = (page - 1) * limit;

    // بناء الاستعلام بشكل ديناميكي
    let query = this.db('projects');
    let countQuery = this.db('projects');

    // NEW: Filter by categoryIds (many-to-many relationship)
    if (categoryIds && categoryIds.length > 0) {
      query = query
        .join('project_categories', 'projects.id', 'project_categories.project_id')
        .whereIn('project_categories.category_id', categoryIds)
        .groupBy('projects.id');

      countQuery = countQuery
        .join('project_categories', 'projects.id', 'project_categories.project_id')
        .whereIn('project_categories.category_id', categoryIds)
        .groupBy('projects.id');
    }

    if (framework) {
      query = query.where({ 'projects.framework': framework });
      countQuery = countQuery.where({ 'projects.framework': framework });
    }
    if (category) {
      query = query.where({ 'projects.category': category });
      countQuery = countQuery.where({ 'projects.category': category });
    }

    const sortColumn = this.getSortColumn(sortBy);

    // تنفيذ الاستعلامات
    const [countResult, projects] = await Promise.all([
      countQuery.count('projects.id as count').first(),
      query
        .select(
          'projects.id', 'projects.title', 'projects.short_description', 'projects.thumbnail',
          'projects.framework', 'projects.category', 'projects.likes',
          'projects.views', 'projects.downloads', 'projects.created_at', 'projects.builder'
        )
        .orderByRaw(sortColumn)
        .limit(limit)
        .offset(offset)
    ]);

    const total = parseInt(String(countResult?.count || 0), 10);

    return {
      projects: projects.map((row: any) => this.mapRowToSummary(row)),
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
    const { query, frameworks, categories, categoryIds, sortBy = 'recent', page = 1, limit = 12 } = options;
    const offset = (page - 1) * limit;

    // بناء الاستعلام بشكل ديناميكي
    let dbQuery = this.db('projects');
    let countQuery = this.db('projects');

    // NEW: Filter by categoryIds (many-to-many relationship)
    if (categoryIds && categoryIds.length > 0) {
      dbQuery = dbQuery
        .join('project_categories', 'projects.id', 'project_categories.project_id')
        .whereIn('project_categories.category_id', categoryIds)
        .groupBy('projects.id');

      countQuery = countQuery
        .join('project_categories', 'projects.id', 'project_categories.project_id')
        .whereIn('project_categories.category_id', categoryIds)
        .groupBy('projects.id');
    }

    if (query) {
      dbQuery = dbQuery.where(function () {
        this.where('projects.title', 'ilike', `%${query}%`)
          .orWhere('projects.short_description', 'ilike', `%${query}%`);
      });
      countQuery = countQuery.where(function () {
        this.where('projects.title', 'ilike', `%${query}%`)
          .orWhere('projects.short_description', 'ilike', `%${query}%`);
      });
    }
    if (frameworks && frameworks.length > 0) {
      dbQuery = dbQuery.whereIn('projects.framework', frameworks);
      countQuery = countQuery.whereIn('projects.framework', frameworks);
    }
    if (categories && categories.length > 0) {
      dbQuery = dbQuery.whereIn('projects.category', categories);
      countQuery = countQuery.whereIn('projects.category', categories);
    }

    const sortColumn = this.getSortColumn(sortBy);

    // تنفيذ الاستعلامات
    const [countResult, projects] = await Promise.all([
      countQuery.count('projects.id as count').first(),
      dbQuery
        .select(
          'projects.id', 'projects.title', 'projects.short_description', 'projects.thumbnail',
          'projects.framework', 'projects.category', 'projects.likes',
          'projects.views', 'projects.downloads', 'projects.created_at', 'projects.builder'
        )
        .orderByRaw(sortColumn)
        .limit(limit)
        .offset(offset)
    ]);

    const total = parseInt(String(countResult?.count || 0), 10);

    return {
      projects: projects.map((row: any) => this.mapRowToSummary(row)),
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
    const project = await this.db('projects')
      .where({ id })
      .first();

    if (!project) {
      return null;
    }

    // NEW: Fetch and include categories
    const categoryRepo = getCategoryRepository();
    const categories = await categoryRepo.getProjectCategories(id);

    return {
      ...this.mapRowToProject(project),
      categories
    };
  }

  async findByIds(ids: string[]): Promise<ProjectSummary[]> {
    if (ids.length === 0) return [];

    const projects = await this.db('projects')
      .select(
        'id', 'title', 'short_description', 'thumbnail', 'framework', 'category',
        'likes', 'views', 'downloads', 'created_at', 'builder'
      )
      .whereIn('id', ids);

    return projects.map((row: any) => this.mapRowToSummary(row));
  }

  async incrementStat(id: string, field: 'views' | 'likes' | 'downloads'): Promise<ProjectData | null> {
    const [project] = await this.db('projects')
      .where({ id })
      .update({
        [field]: this.db.raw('?? + 1', [field]),
        updated_at: this.db.fn.now()
      })
      .returning('*');

    if (!project) {
      return null;
    }

    return this.mapRowToProject(project);
  }

  async decrementStat(id: string, field: 'views' | 'likes' | 'downloads'): Promise<ProjectData | null> {
    const [project] = await this.db('projects')
      .where({ id })
      .update({
        [field]: this.db.raw('GREATEST(?? - 1, 0)', [field]),
        updated_at: this.db.fn.now()
      })
      .returning('*');

    if (!project) {
      return null;
    }

    return this.mapRowToProject(project);
  }

  async create(data: CreateProjectDTO): Promise<ProjectData> {
    const id = uuidv4();

    const [project] = await this.db('projects')
      .insert({
        id,
        title: data.title,
        description: data.description,
        short_description: data.shortDescription,
        thumbnail: data.thumbnail,
        screenshots: JSON.stringify(data.screenshots || []),
        demo_url: data.demoUrl || null,
        download_url: data.downloadUrl || null,
        source_code_file: data.sourceCodeFile || null,
        prompt: JSON.stringify(data.prompt),
        framework: data.framework,
        styles: JSON.stringify(data.styles || []),
        category: data.category,
        builder: data.builder ? JSON.stringify(data.builder) : null,
        builder_social_links: data.builderSocialLinks ? JSON.stringify(data.builderSocialLinks) : null,
        likes: 0,
        views: 0,
        downloads: 0,
        collection_ids: '{}',
        created_at: this.db.fn.now(),
        updated_at: this.db.fn.now()
      })
      .returning('*');

    return this.mapRowToProject(project);
  }

  async update(id: string, data: UpdateProjectDTO): Promise<ProjectData | null> {
    const updateData: any = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.shortDescription !== undefined) {
      updateData.short_description = data.shortDescription;
    }
    if (data.thumbnail !== undefined) {
      updateData.thumbnail = data.thumbnail;
    }
    if (data.screenshots !== undefined) {
      updateData.screenshots = JSON.stringify(data.screenshots);
    }
    if (data.demoUrl !== undefined) {
      updateData.demo_url = data.demoUrl;
    }
    if (data.downloadUrl !== undefined) {
      updateData.download_url = data.downloadUrl;
    }
    if (data.prompt !== undefined) {
      updateData.prompt = JSON.stringify(data.prompt);
    }
    if (data.framework !== undefined) {
      updateData.framework = data.framework;
    }
    if (data.styles !== undefined) {
      updateData.styles = JSON.stringify(data.styles);
    }
    if (data.category !== undefined) {
      updateData.category = data.category;
    }
    if (data.sourceCodeFile !== undefined) {
      updateData.source_code_file = data.sourceCodeFile;
    }
    if (data.builder !== undefined) {
      updateData.builder = JSON.stringify(data.builder);
    }
    if (data.builderSocialLinks !== undefined) {
      updateData.builder_social_links = JSON.stringify(data.builderSocialLinks);
    }

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    updateData.updated_at = this.db.fn.now();

    const [project] = await this.db('projects')
      .where({ id })
      .update(updateData)
      .returning('*');

    if (!project) {
      return null;
    }

    return this.mapRowToProject(project);
  }

  async delete(id: string): Promise<boolean> {
    const deletedCount = await this.db('projects')
      .where({ id })
      .delete();

    return deletedCount > 0;
  }
}
