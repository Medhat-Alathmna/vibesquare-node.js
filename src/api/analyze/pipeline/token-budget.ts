import { GPTTokens } from 'gpt-tokens';

// ============ User Tiers ============
export type UserTier = 'free' | 'basic' | 'pro' | 'enterprise';

/**
 * Token budget limits for each user tier
 * These can be used for validation or reporting purposes
 */
export const TIER_CONFIGS = {
  free: {
    maxTokens: 20000,
  },
  basic: {
    maxTokens: 50000,
  },
  pro: {
    maxTokens: 100000,
  },
  enterprise: {
    maxTokens: 200000,
  },
};

/**
 * Estimate token count using gpt-tokens library
 * @param data - The data to estimate tokens for (string or object)
 * @returns Estimated token count
 */
export function estimateTokens(data: any): number {
  const content = typeof data === 'string' ? data : JSON.stringify(data);

  // Use gpt-4o-mini as baseline for token counting (cl100k_base encoding)
  const usage = new GPTTokens({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content }],
  });

  return usage.usedTokens;
}
