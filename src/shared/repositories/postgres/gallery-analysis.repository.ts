import { getKnex } from '../../../config/knex';
import { v4 as uuidv4 } from 'uuid';
import {
  IGalleryAnalysis,
  AnalysisStatus,
  AnalysisHistoryItem,
  PaginatedResult
} from '../../../api/gallery/gallery.types';

export class GalleryAnalysisRepository {
  private get db() {
    return getKnex();
  }

  async create(data: Omit<IGalleryAnalysis, 'id' | 'createdAt' | 'completedAt' | 'deletedAt'>): Promise<IGalleryAnalysis> {
    const id = `ga-${uuidv4()}`;
    const [row] = await this.db('gallery_analyses')
      .insert({
        id,
        user_id: data.userId,
        url: data.url,
        prompt: data.prompt,
        tokens_used: data.tokensUsed,
        status: data.status,
        metadata: JSON.stringify(data.metadata || {}),
        page_title: data.pageTitle,
        page_description: data.pageDescription,
        screenshot_url: data.screenshotUrl,
        pipeline_type: data.pipelineType || 'v1',
        prd_id: data.prdId || null
      })
      .returning('*');
    return this.mapRow(row);
  }

  async findById(id: string): Promise<IGalleryAnalysis | null> {
    const row = await this.db('gallery_analyses')
      .where({ id })
      .whereNull('deleted_at')
      .first();
    return row ? this.mapRow(row) : null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<IGalleryAnalysis | null> {
    const row = await this.db('gallery_analyses')
      .where({ id, user_id: userId })
      .whereNull('deleted_at')
      .first();
    return row ? this.mapRow(row) : null;
  }

  async findByUserId(userId: string, page = 1, limit = 20): Promise<PaginatedResult<AnalysisHistoryItem>> {
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      this.db('gallery_analyses')
        .select('id', 'url', 'page_title', 'page_description', 'screenshot_url', 'tokens_used', 'status', 'created_at', 'completed_at')
        .where({ user_id: userId })
        .whereNull('deleted_at')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset),
      this.db('gallery_analyses')
        .where({ user_id: userId })
        .whereNull('deleted_at')
        .count('* as count')
        .first()
    ]);

    const total = parseInt(countResult?.count as string || '0', 10);
    return {
      data: rows.map(this.mapHistoryItem),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async update(id: string, data: Partial<Omit<IGalleryAnalysis, 'id' | 'createdAt' | 'userId'>>): Promise<IGalleryAnalysis | null> {
    const updateData: Record<string, any> = {};

    const fieldMap: Record<string, string> = {
      url: 'url',
      prompt: 'prompt',
      tokensUsed: 'tokens_used',
      status: 'status',
      metadata: 'metadata',
      pageTitle: 'page_title',
      pageDescription: 'page_description',
      screenshotUrl: 'screenshot_url',
      pipelineType: 'pipeline_type',
      prdId: 'prd_id',
      completedAt: 'completed_at',
      deletedAt: 'deleted_at'
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        const value = key === 'metadata' ? JSON.stringify((data as any)[key]) : (data as any)[key];
        updateData[dbField] = value;
      }
    }

    if (Object.keys(updateData).length === 0) return this.findById(id);

    const [row] = await this.db('gallery_analyses')
      .where({ id })
      .update(updateData)
      .returning('*');
    return row ? this.mapRow(row) : null;
  }

  async markCompleted(id: string, prompt: string, tokensUsed: number, metadata?: Record<string, any>): Promise<IGalleryAnalysis | null> {
    const updateData: Record<string, any> = {
      prompt,
      tokens_used: tokensUsed,
      status: 'completed',
      completed_at: this.db.fn.now()
    };

    // Only update metadata if provided, otherwise keep existing
    if (metadata) {
      updateData.metadata = JSON.stringify(metadata);
    }

    const [row] = await this.db('gallery_analyses')
      .where({ id })
      .update(updateData)
      .returning('*');
    return row ? this.mapRow(row) : null;
  }

  async markFailed(id: string, error: string): Promise<IGalleryAnalysis | null> {
    const [row] = await this.db('gallery_analyses')
      .where({ id })
      .update({
        status: 'failed',
        metadata: this.db.raw(`jsonb_set(COALESCE(metadata, '{}'), '{error}', ?::jsonb)`, [JSON.stringify(error)]),
        completed_at: this.db.fn.now()
      })
      .returning('*');
    return row ? this.mapRow(row) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const count = await this.db('gallery_analyses')
      .where({ id })
      .update({ deleted_at: this.db.fn.now() });
    return count > 0;
  }

  async countByUserId(userId: string): Promise<number> {
    const result = await this.db('gallery_analyses')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .count('* as count')
      .first();
    return parseInt(result?.count as string || '0', 10);
  }

  async getRecentByUserId(userId: string, limit = 5): Promise<AnalysisHistoryItem[]> {
    const rows = await this.db('gallery_analyses')
      .select('id', 'url', 'page_title', 'page_description', 'screenshot_url', 'tokens_used', 'status', 'created_at', 'completed_at')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .limit(limit);
    return rows.map(this.mapHistoryItem);
  }

  private mapRow(row: any): IGalleryAnalysis {
    return {
      id: row.id,
      userId: row.user_id,
      url: row.url,
      prompt: row.prompt,
      tokensUsed: row.tokens_used,
      status: row.status as AnalysisStatus,
      metadata: row.metadata || {},
      pageTitle: row.page_title,
      pageDescription: row.page_description,
      screenshotUrl: row.screenshot_url,
      pipelineType: row.pipeline_type,
      prdId: row.prd_id,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined
    };
  }

  private mapHistoryItem(row: any): AnalysisHistoryItem {
    return {
      id: row.id,
      url: row.url,
      pageTitle: row.page_title,
      pageDescription: row.page_description,
      screenshotUrl: row.screenshot_url,
      tokensUsed: row.tokens_used,
      status: row.status as AnalysisStatus,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    };
  }
}

export const galleryAnalysisRepository = new GalleryAnalysisRepository();
