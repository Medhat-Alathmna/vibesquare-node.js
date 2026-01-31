/**
 * PostgreSQL Visual Pipeline Cache Repository
 *
 * Repository for managing cached visual pipeline results.
 * Implements URL-based caching with automatic expiration.
 */

import { v4 as uuidv4 } from 'uuid';
import { getKnex } from '../../../config/knex';
import {
  IVisualPipelineCacheRepository,
  VisualPipelineCacheData,
  CreateVisualPipelineCacheDTO,
} from '../interfaces';

export class PostgresVisualPipelineCacheRepository implements IVisualPipelineCacheRepository {
  private get db() {
    return getKnex();
  }

  private tableName = 'visual_pipeline_cache';

  /**
   * Map database row to VisualPipelineCacheData DTO
   */
  private mapRowToDTO(row: any): VisualPipelineCacheData {
    return {
      id: row.id,
      normalizedUrl: row.normalized_url,
      originalUrl: row.original_url,
      finalPrompt: row.final_prompt,
      userQuestions: row.user_questions || [],
      metadata: row.metadata,
      layoutAnalysis: row.layout_analysis || null,
      componentIdentification: row.component_identification || null,
      designSystem: row.design_system || null,
      cachedAt: row.cached_at,
      expiresAt: row.expires_at,
      hitCount: row.hit_count || 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Find a cached entry by normalized URL
   *
   * @param normalizedUrl - The normalized URL to search for
   * @returns Cached data if found and not expired, null otherwise
   */
  async findByUrl(normalizedUrl: string): Promise<VisualPipelineCacheData | null> {
    try {
      const row = await this.db(this.tableName)
        .where({ normalized_url: normalizedUrl })
        .first();

      if (!row) {
        return null;
      }

      // Check if expired
      const now = new Date();
      const expiresAt = new Date(row.expires_at);

      if (now > expiresAt) {
        // Delete expired entry automatically
        await this.delete(row.id);
        console.log(`[Cache] Expired entry deleted for URL: ${normalizedUrl}`);
        return null;
      }

      return this.mapRowToDTO(row);
    } catch (error) {
      console.error('[Cache] Error finding by URL:', error);
      throw error;
    }
  }

  /**
   * Create a new cache entry
   *
   * @param data - The cache data to create
   * @returns The created cache entry
   */
  async create(data: CreateVisualPipelineCacheDTO): Promise<VisualPipelineCacheData> {
    try {
      const id = uuidv4();
      const ttlDays = data.ttlDays || 7;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

      const [row] = await this.db(this.tableName)
        .insert({
          id,
          normalized_url: data.normalizedUrl,
          original_url: data.originalUrl,
          final_prompt: data.finalPrompt,
          user_questions: data.userQuestions ? JSON.stringify(data.userQuestions) : null,
          metadata: JSON.stringify(data.metadata),
          layout_analysis: data.layoutAnalysis ? JSON.stringify(data.layoutAnalysis) : null,
          component_identification: data.componentIdentification
            ? JSON.stringify(data.componentIdentification)
            : null,
          design_system: data.designSystem ? JSON.stringify(data.designSystem) : null,
          cached_at: now,
          expires_at: expiresAt,
          hit_count: 1,
          created_at: this.db.fn.now(),
          updated_at: this.db.fn.now(),
        })
        .returning('*')
        .onConflict('normalized_url')
        .merge(); // Upsert: update if exists

      return this.mapRowToDTO(row);
    } catch (error) {
      console.error('[Cache] Error creating cache entry:', error);
      throw error;
    }
  }

  /**
   * Increment the hit count for a cache entry
   *
   * @param id - The cache entry ID
   */
  async incrementHitCount(id: string): Promise<void> {
    try {
      await this.db(this.tableName)
        .where({ id })
        .increment('hit_count', 1)
        .update({ updated_at: this.db.fn.now() });
    } catch (error) {
      console.error('[Cache] Error incrementing hit count:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Delete all expired cache entries
   *
   * @returns The number of deleted entries
   */
  async deleteExpired(): Promise<number> {
    try {
      const now = new Date();
      const deletedCount = await this.db(this.tableName)
        .where('expires_at', '<', now)
        .delete();

      console.log(`[Cache] Deleted ${deletedCount} expired entries`);
      return deletedCount;
    } catch (error) {
      console.error('[Cache] Error deleting expired entries:', error);
      throw error;
    }
  }

  /**
   * Delete a specific cache entry by ID
   *
   * @param id - The cache entry ID
   * @returns true if deleted, false otherwise
   */
  async delete(id: string): Promise<boolean> {
    try {
      const deletedCount = await this.db(this.tableName).where({ id }).delete();
      return deletedCount > 0;
    } catch (error) {
      console.error('[Cache] Error deleting entry:', error);
      throw error;
    }
  }

  /**
   * Check if a cache entry is expired
   *
   * @param cachedAt - When the entry was cached
   * @param ttlDays - Time to live in days
   * @returns true if expired, false otherwise
   */
  isExpired(cachedAt: Date, ttlDays: number): boolean {
    const now = new Date();
    const expiresAt = new Date(cachedAt.getTime() + ttlDays * 24 * 60 * 60 * 1000);
    return now > expiresAt;
  }
}
