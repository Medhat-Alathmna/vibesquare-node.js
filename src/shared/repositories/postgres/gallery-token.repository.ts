import { pgPool } from '../../../config/database';
import { v4 as uuidv4 } from 'uuid';
import {
  IGalleryTokenUsage,
  IGalleryTokenTransaction,
  TokenTransactionType,
  PaginatedResult
} from '../../../api/gallery/gallery.types';

// ============================================
// Gallery Token Usage Repository
// ============================================
export class GalleryTokenUsageRepository {
  async create(data: Omit<IGalleryTokenUsage, 'id' | 'createdAt' | 'updatedAt'>): Promise<IGalleryTokenUsage> {
    const id = `gtu-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_token_usage (
        id, user_id, tokens_used, quota_period_start, quota_period_end,
        total_tokens_used, analysis_count, total_analysis_count,
        last_analysis_at, last_analysis_url, last_analysis_tokens
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        id, data.userId, data.tokensUsed, data.quotaPeriodStart, data.quotaPeriodEnd,
        data.totalTokensUsed, data.analysisCount, data.totalAnalysisCount,
        data.lastAnalysisAt, data.lastAnalysisUrl, data.lastAnalysisTokens
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId: string): Promise<IGalleryTokenUsage | null> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_token_usage WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async update(userId: string, data: Partial<Omit<IGalleryTokenUsage, 'id' | 'createdAt' | 'userId'>>): Promise<IGalleryTokenUsage | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      tokensUsed: 'tokens_used',
      quotaPeriodStart: 'quota_period_start',
      quotaPeriodEnd: 'quota_period_end',
      totalTokensUsed: 'total_tokens_used',
      analysisCount: 'analysis_count',
      totalAnalysisCount: 'total_analysis_count',
      lastAnalysisAt: 'last_analysis_at',
      lastAnalysisUrl: 'last_analysis_url',
      lastAnalysisTokens: 'last_analysis_tokens'
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${dbField} = $${paramIndex++}`);
        values.push((data as any)[key]);
      }
    }

    if (fields.length === 0) return this.findByUserId(userId);

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(userId);

    const result = await pgPool.query(
      `UPDATE gallery_token_usage SET ${fields.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async incrementTokensUsed(userId: string, tokens: number, analysisUrl?: string): Promise<IGalleryTokenUsage | null> {
    const result = await pgPool.query(
      `UPDATE gallery_token_usage SET
        tokens_used = tokens_used + $1,
        total_tokens_used = total_tokens_used + $1,
        analysis_count = analysis_count + 1,
        total_analysis_count = total_analysis_count + 1,
        last_analysis_at = NOW(),
        last_analysis_url = COALESCE($2, last_analysis_url),
        last_analysis_tokens = $1,
        updated_at = NOW()
      WHERE user_id = $3
      RETURNING *`,
      [tokens, analysisUrl, userId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async resetQuota(userId: string, newPeriodStart: Date, newPeriodEnd: Date): Promise<IGalleryTokenUsage | null> {
    const result = await pgPool.query(
      `UPDATE gallery_token_usage SET
        tokens_used = 0,
        analysis_count = 0,
        quota_period_start = $1,
        quota_period_end = $2,
        updated_at = NOW()
      WHERE user_id = $3
      RETURNING *`,
      [newPeriodStart, newPeriodEnd, userId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findExpiredQuotas(): Promise<IGalleryTokenUsage[]> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_token_usage WHERE quota_period_end < NOW()'
    );
    return result.rows.map(this.mapRow);
  }

  async findAll(): Promise<IGalleryTokenUsage[]> {
    const result = await pgPool.query('SELECT * FROM gallery_token_usage');
    return result.rows.map(this.mapRow);
  }

  async initializeForUser(userId: string): Promise<IGalleryTokenUsage> {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return this.create({
      userId,
      tokensUsed: 0,
      quotaPeriodStart: now,
      quotaPeriodEnd: weekLater,
      totalTokensUsed: 0,
      analysisCount: 0,
      totalAnalysisCount: 0
    });
  }

  private mapRow(row: any): IGalleryTokenUsage {
    return {
      id: row.id,
      userId: row.user_id,
      tokensUsed: parseInt(row.tokens_used, 10),
      quotaPeriodStart: new Date(row.quota_period_start),
      quotaPeriodEnd: new Date(row.quota_period_end),
      totalTokensUsed: parseInt(row.total_tokens_used, 10),
      analysisCount: row.analysis_count,
      totalAnalysisCount: row.total_analysis_count,
      lastAnalysisAt: row.last_analysis_at ? new Date(row.last_analysis_at) : undefined,
      lastAnalysisUrl: row.last_analysis_url,
      lastAnalysisTokens: row.last_analysis_tokens,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// ============================================
// Gallery Token Transaction Repository
// ============================================
export class GalleryTokenTransactionRepository {
  async create(data: Omit<IGalleryTokenTransaction, 'id' | 'createdAt'>): Promise<IGalleryTokenTransaction> {
    const id = `gtt-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_token_transactions (
        id, user_id, type, tokens_amount, tokens_before, tokens_after,
        analysis_url, analysis_id, description, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        id, data.userId, data.type, data.tokensAmount, data.tokensBefore, data.tokensAfter,
        data.analysisUrl, data.analysisId, data.description, JSON.stringify(data.metadata || {})
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId: string, page = 1, limit = 20): Promise<PaginatedResult<IGalleryTokenTransaction>> {
    const offset = (page - 1) * limit;
    const [txResult, countResult] = await Promise.all([
      pgPool.query(
        'SELECT * FROM gallery_token_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      ),
      pgPool.query('SELECT COUNT(*) FROM gallery_token_transactions WHERE user_id = $1', [userId])
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return {
      data: txResult.rows.map(this.mapRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findByAnalysisId(analysisId: string): Promise<IGalleryTokenTransaction | null> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_token_transactions WHERE analysis_id = $1',
      [analysisId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByType(userId: string, type: TokenTransactionType, limit = 20): Promise<IGalleryTokenTransaction[]> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_token_transactions WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT $3',
      [userId, type, limit]
    );
    return result.rows.map(this.mapRow);
  }

  async sumTokensByType(userId: string, type: TokenTransactionType, since?: Date): Promise<number> {
    let query = 'SELECT COALESCE(SUM(tokens_amount), 0) as total FROM gallery_token_transactions WHERE user_id = $1 AND type = $2';
    const params: any[] = [userId, type];

    if (since) {
      query += ' AND created_at > $3';
      params.push(since);
    }

    const result = await pgPool.query(query, params);
    return parseInt(result.rows[0].total, 10);
  }

  private mapRow(row: any): IGalleryTokenTransaction {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type as TokenTransactionType,
      tokensAmount: row.tokens_amount,
      tokensBefore: parseInt(row.tokens_before, 10),
      tokensAfter: parseInt(row.tokens_after, 10),
      analysisUrl: row.analysis_url,
      analysisId: row.analysis_id,
      description: row.description,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at)
    };
  }
}

// ============================================
// Repository Instances
// ============================================
export const galleryTokenUsageRepository = new GalleryTokenUsageRepository();
export const galleryTokenTransactionRepository = new GalleryTokenTransactionRepository();
