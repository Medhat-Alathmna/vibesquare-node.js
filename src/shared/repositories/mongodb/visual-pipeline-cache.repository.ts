/**
 * MongoDB Visual Pipeline Cache Repository
 *
 * Repository for managing cached visual pipeline results in MongoDB.
 * Implements URL-based caching with automatic expiration.
 */

import { v4 as uuidv4 } from 'uuid';
import { Schema, model, Model } from 'mongoose';
import {
  IVisualPipelineCacheRepository,
  VisualPipelineCacheData,
  CreateVisualPipelineCacheDTO,
} from '../interfaces';

/**
 * MongoDB Schema for Visual Pipeline Cache
 */
const visualPipelineCacheSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
    },
    normalizedUrl: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    originalUrl: {
      type: String,
      required: true,
    },
    finalPrompt: {
      type: String,
      required: true,
    },
    userQuestions: {
      type: Array,
      default: [],
    },
    metadata: {
      type: Object,
      required: true,
    },
    layoutAnalysis: {
      type: Object,
      default: null,
    },
    componentIdentification: {
      type: Object,
      default: null,
    },
    designSystem: {
      type: Object,
      default: null,
    },
    cachedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    hitCount: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
    collection: 'visual_pipeline_cache',
  }
);

// Create the Mongoose model
const VisualPipelineCacheModel: Model<any> = model(
  'VisualPipelineCache',
  visualPipelineCacheSchema
);

export class MongoDBVisualPipelineCacheRepository implements IVisualPipelineCacheRepository {
  /**
   * Map MongoDB document to VisualPipelineCacheData DTO
   */
  private mapDocToDTO(doc: any): VisualPipelineCacheData {
    return {
      id: doc.id,
      normalizedUrl: doc.normalizedUrl,
      originalUrl: doc.originalUrl,
      finalPrompt: doc.finalPrompt,
      userQuestions: doc.userQuestions || [],
      metadata: doc.metadata,
      layoutAnalysis: doc.layoutAnalysis || null,
      componentIdentification: doc.componentIdentification || null,
      designSystem: doc.designSystem || null,
      cachedAt: doc.cachedAt,
      expiresAt: doc.expiresAt,
      hitCount: doc.hitCount || 1,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
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
      const doc = await VisualPipelineCacheModel.findOne({ normalizedUrl }).lean();

      if (!doc) {
        return null;
      }

      // Check if expired
      const now = new Date();
      const expiresAt = new Date(doc.expiresAt);

      if (now > expiresAt) {
        // Delete expired entry automatically
        await this.delete(doc.id);
        console.log(`[Cache] Expired entry deleted for URL: ${normalizedUrl}`);
        return null;
      }

      return this.mapDocToDTO(doc);
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
      const ttlDays = data.ttlDays || 7;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

      // Use findOneAndUpdate with upsert to handle concurrent requests
      const doc = await VisualPipelineCacheModel.findOneAndUpdate(
        { normalizedUrl: data.normalizedUrl },
        {
          $set: {
            id: uuidv4(),
            normalizedUrl: data.normalizedUrl,
            originalUrl: data.originalUrl,
            finalPrompt: data.finalPrompt,
            userQuestions: data.userQuestions || [],
            metadata: data.metadata,
            layoutAnalysis: data.layoutAnalysis || null,
            componentIdentification: data.componentIdentification || null,
            designSystem: data.designSystem || null,
            cachedAt: now,
            expiresAt,
            hitCount: 1,
          },
        },
        { upsert: true, new: true, lean: true }
      );

      return this.mapDocToDTO(doc);
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
      await VisualPipelineCacheModel.findOneAndUpdate(
        { id },
        {
          $inc: { hitCount: 1 },
          $set: { updatedAt: new Date() },
        }
      );
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
      const result = await VisualPipelineCacheModel.deleteMany({
        expiresAt: { $lt: now },
      });

      const deletedCount = result.deletedCount || 0;
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
      const result = await VisualPipelineCacheModel.deleteOne({ id });
      return result.deletedCount > 0;
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
