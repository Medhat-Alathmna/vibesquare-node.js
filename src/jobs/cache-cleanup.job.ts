/**
 * Cache Cleanup Background Job
 *
 * Scheduled job to delete expired visual pipeline cache entries.
 * Runs daily at 2 AM to maintain database cleanliness and performance.
 *
 * This job:
 * 1. Queries for all cache entries where expires_at < now()
 * 2. Deletes expired entries from visual_pipeline_cache table
 * 3. Logs the number of deleted entries for monitoring
 *
 * Scheduled via node-cron in server.ts
 */

import { getVisualPipelineCacheRepository } from '../shared/repositories';

/**
 * Execute cache cleanup job
 *
 * Deletes all expired cache entries from the visual_pipeline_cache table.
 * Safe to run multiple times - idempotent operation.
 *
 * @returns Promise<void>
 */
export async function cleanupExpiredCache(): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('[CacheCleanup] ===================================');
    console.log('[CacheCleanup] Starting cleanup of expired cache entries...');
    console.log(`[CacheCleanup] Timestamp: ${new Date().toISOString()}`);

    const repo = getVisualPipelineCacheRepository();

    // Delete all expired entries
    const deletedCount = await repo.deleteExpired();

    const duration = Date.now() - startTime;

    console.log(`[CacheCleanup] ✅ Cleanup completed successfully`);
    console.log(`[CacheCleanup] Deleted entries: ${deletedCount}`);
    console.log(`[CacheCleanup] Duration: ${duration}ms`);
    console.log('[CacheCleanup] ===================================');

    // Optional: Log to monitoring service if deletedCount is unusually high
    if (deletedCount > 1000) {
      console.warn(`[CacheCleanup] ⚠️  High deletion count detected: ${deletedCount} entries`);
    }
  } catch (error) {
    console.error('[CacheCleanup] ❌ Failed to cleanup expired cache');
    console.error('[CacheCleanup] Error:', error);

    // Optional: Send alert to monitoring service (e.g., Sentry, Datadog)
    // await alertMonitoring('cache_cleanup_failed', error);

    // Don't throw - job failure shouldn't crash the server
  }
}

/**
 * Start the cache cleanup job with interval
 * Runs daily at 2 AM (using setInterval as a simple scheduler)
 *
 * Note: For production, consider using node-cron or external scheduler (e.g., Kubernetes CronJob)
 */
export function startCacheCleanupJob(): void {
  const DAY_IN_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Calculate time until next 2 AM
  const now = new Date();
  const next2AM = new Date();
  next2AM.setHours(2, 0, 0, 0);

  // If 2 AM has passed today, schedule for tomorrow
  if (next2AM <= now) {
    next2AM.setDate(next2AM.getDate() + 1);
  }

  const msUntilNext2AM = next2AM.getTime() - now.getTime();

  console.log('[CacheCleanup] Job scheduled to run daily at 2 AM');
  console.log(`[CacheCleanup] Next run at: ${next2AM.toISOString()}`);

  // Schedule first run at 2 AM
  setTimeout(() => {
    // Run cleanup
    cleanupExpiredCache().catch(console.error);

    // Then run every 24 hours
    setInterval(() => {
      cleanupExpiredCache().catch(console.error);
    }, DAY_IN_MS);
  }, msUntilNext2AM);
}

/**
 * Get cache statistics for monitoring
 *
 * Useful for health checks and debugging.
 * Can be called via API endpoint for admin monitoring.
 *
 * @returns Promise<{ totalEntries: number, queueSize: number }>
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  queueSize: number;
}> {
  try {
    // Note: This would require adding a count() method to repository interface
    // For now, return placeholder
    return {
      totalEntries: 0, // TODO: Implement repo.count()
      queueSize: 0, // TODO: Get from pipelineQueueService.getQueueSize()
    };
  } catch (error) {
    console.error('[CacheCleanup] Failed to get cache stats:', error);
    throw error;
  }
}

// If run directly (npm run job:cache-cleanup)
if (require.main === module) {
  // Import database config to initialize connection
  import('../config/database').then(() => {
    cleanupExpiredCache()
      .then(() => {
        console.log('[CacheCleanup] Manual run completed.');
        process.exit(0);
      })
      .catch((error) => {
        console.error('[CacheCleanup] Manual run failed:', error);
        process.exit(1);
      });
  });
}
