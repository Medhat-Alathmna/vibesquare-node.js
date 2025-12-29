import { pgPool } from '../../../config/database';
import { v4 as uuidv4 } from 'uuid';
import {
  IGalleryAnalysis,
  AnalysisStatus,
  AnalysisHistoryItem,
  PaginatedResult
} from '../../../api/gallery/gallery.types';

export class GalleryAnalysisRepository {
  async create(data: Omit<IGalleryAnalysis, 'id' | 'createdAt' | 'completedAt' | 'deletedAt'>): Promise<IGalleryAnalysis> {
    const id = `ga-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_analyses (
        id, user_id, url, prompt, tokens_used, status, metadata,
        page_title, page_description, screenshot_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        id,
        data.userId,
        data.url,
        data.prompt,
        data.tokensUsed,
        data.status,
        JSON.stringify(data.metadata || {}),
        data.pageTitle,
        data.pageDescription,
        data.screenshotUrl
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<IGalleryAnalysis | null> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_analyses WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<IGalleryAnalysis | null> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_analyses WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByUserId(userId: string, page = 1, limit = 20): Promise<PaginatedResult<AnalysisHistoryItem>> {
    const offset = (page - 1) * limit;
    const [dataResult, countResult] = await Promise.all([
      pgPool.query(
        `SELECT id, url, page_title, page_description, screenshot_url, tokens_used, status, created_at, completed_at
         FROM gallery_analyses
         WHERE user_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pgPool.query(
        'SELECT COUNT(*) FROM gallery_analyses WHERE user_id = $1 AND deleted_at IS NULL',
        [userId]
      )
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return {
      data: dataResult.rows.map(this.mapHistoryItem),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async update(id: string, data: Partial<Omit<IGalleryAnalysis, 'id' | 'createdAt' | 'userId'>>): Promise<IGalleryAnalysis | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      url: 'url',
      prompt: 'prompt',
      tokensUsed: 'tokens_used',
      status: 'status',
      metadata: 'metadata',
      pageTitle: 'page_title',
      pageDescription: 'page_description',
      screenshotUrl: 'screenshot_url',
      completedAt: 'completed_at',
      deletedAt: 'deleted_at'
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${dbField} = $${paramIndex++}`);
        const value = key === 'metadata' ? JSON.stringify((data as any)[key]) : (data as any)[key];
        values.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);

    const result = await pgPool.query(
      `UPDATE gallery_analyses SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markCompleted(id: string, prompt: string, tokensUsed: number, metadata?: Record<string, any>): Promise<IGalleryAnalysis | null> {
    const result = await pgPool.query(
      `UPDATE gallery_analyses SET
        prompt = $1,
        tokens_used = $2,
        status = 'completed',
        metadata = COALESCE($3, metadata),
        completed_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [prompt, tokensUsed, metadata ? JSON.stringify(metadata) : null, id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markFailed(id: string, error: string): Promise<IGalleryAnalysis | null> {
    const result = await pgPool.query(
      `UPDATE gallery_analyses SET
        status = 'failed',
        metadata = jsonb_set(COALESCE(metadata, '{}'), '{error}', $1::jsonb),
        completed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(error), id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await pgPool.query(
      'UPDATE gallery_analyses SET deleted_at = NOW() WHERE id = $1',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async countByUserId(userId: string): Promise<number> {
    const result = await pgPool.query(
      'SELECT COUNT(*) FROM gallery_analyses WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getRecentByUserId(userId: string, limit = 5): Promise<AnalysisHistoryItem[]> {
    const result = await pgPool.query(
      `SELECT id, url, page_title, page_description, screenshot_url, tokens_used, status, created_at, completed_at
       FROM gallery_analyses
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(this.mapHistoryItem);
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
