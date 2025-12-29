/**
 * Quota Reset Job
 *
 * This job runs periodically to reset expired user quotas.
 * It checks for users whose quota period has ended and resets their token usage.
 *
 * Can be run:
 * - As a cron job (recommended for production)
 * - Manually via npm script
 * - On application startup with setInterval
 */

import { quotaService } from '../api/gallery/quota/quota.service';

/**
 * Process weekly quota resets
 */
export async function processQuotaResets(): Promise<void> {
  console.log('[QuotaResetJob] Starting quota reset check...');

  try {
    const resetCount = await quotaService.processWeeklyResets();
    console.log(`[QuotaResetJob] Completed. Reset ${resetCount} user quota(s).`);
  } catch (error) {
    console.error('[QuotaResetJob] Failed:', error);
    throw error;
  }
}

/**
 * Start the quota reset job with interval
 * Runs every hour to check for expired quotas
 */
export function startQuotaResetJob(): void {
  const HOUR_IN_MS = 60 * 60 * 1000;

  // Run immediately on startup
  processQuotaResets().catch(console.error);

  // Then run every hour
  setInterval(() => {
    processQuotaResets().catch(console.error);
  }, HOUR_IN_MS);

  console.log('[QuotaResetJob] Job scheduled to run every hour.');
}

// If run directly (npm run job:quota-reset)
if (require.main === module) {
  // Import database config to initialize connection
  import('../config/database').then(() => {
    processQuotaResets()
      .then(() => {
        console.log('[QuotaResetJob] Manual run completed.');
        process.exit(0);
      })
      .catch((error) => {
        console.error('[QuotaResetJob] Manual run failed:', error);
        process.exit(1);
      });
  });
}
