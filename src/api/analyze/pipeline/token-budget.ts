import { GPTTokens } from 'gpt-tokens';

// ============ User Tiers ============
export type UserTier = 'free' | 'basic' | 'pro' | 'enterprise';

/**
 * Estimate token count using gpt-tokens
 */
export const TIER_CONFIGS = {
  free: {
    maxTokens: 20000,
    maxCSSClasses: 50,
    maxCSSPropertiesPerNode: 20,
    maxColors: 20,
    maxImages: 20,
    maxRootNodes: 50,
    maxNavItems: 20,
    maxTextCharsPerNode: 500,
    includeCSSDetails: true,
    includeAllMetadata: false,
    enableCSSCompression: true,
    compressionMinOccurrences: 2,
  },
  basic: {
    maxTokens: 50000,
    maxCSSClasses: 100,
    maxCSSPropertiesPerNode: 50,
    maxColors: 50,
    maxImages: 50,
    maxRootNodes: 100,
    maxNavItems: 50,
    maxTextCharsPerNode: 1000,
    includeCSSDetails: true,
    includeAllMetadata: true,
    enableCSSCompression: true,
    compressionMinOccurrences: 2,
  },
  pro: {
    maxTokens: 100000,
    maxCSSClasses: 200,
    maxCSSPropertiesPerNode: -1,
    maxColors: 100,
    maxImages: 100,
    maxRootNodes: 200,
    maxNavItems: 100,
    maxTextCharsPerNode: 2000,
    includeCSSDetails: true,
    includeAllMetadata: true,
    enableCSSCompression: true,
    compressionMinOccurrences: 2,
  },
  enterprise: {
    maxTokens: 200000,
    maxCSSClasses: -1,
    maxCSSPropertiesPerNode: -1,
    maxColors: -1,
    maxImages: -1,
    maxRootNodes: -1,
    maxNavItems: -1,
    maxTextCharsPerNode: -1,
    includeCSSDetails: true,
    includeAllMetadata: true,
    enableCSSCompression: false,  // Full values for enterprise users
    compressionMinOccurrences: 2,
  },
};

export function estimateTokens(data: any): number {
  const content = typeof data === 'string' ? data : JSON.stringify(data);

  // Use gpt-4o as baseline for token counting (cl100k_base encoding)
  const usage = new GPTTokens({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content }],
  });

  return usage.usedTokens;
}
export function applyTokenBudget(
  parsedDOM: RawParsedDOM,
  tier: UserTier = 'free'
): ReducedParsedDOM {
  const config = TIER_CONFIGS[tier];

  // Initial Reduction based on Tier Config
  const reducedData = reduceWithConfig(parsedDOM, config);
  const estimatedTokens = estimateTokens(reducedData);

  // Strict check: Fail if still over budget
  if (estimatedTokens > config.maxTokens) {
    throw new ApiError(
      httpStatus.PAYMENT_REQUIRED,
      `Page content too large (${estimatedTokens} estimated tokens). The ${tier} tier limit is ${config.maxTokens} tokens. Please upgrade to analyze complex pages.`
    );
  }
  }
