/**
 * Token Budget Usage Examples
 *
 * This file demonstrates how to use the token budget system
 * to control data size sent to LLM based on user tier
 */

import { executePipeline, TIER_CONFIGS, estimateTokens } from './index';

// ============ Example 1: Free User ============
async function exampleFreeUser() {
  const result = await executePipeline({
    url: 'https://example.com',
    tier: 'free', // Free tier limits
  });

  console.log('Free User Result:');
  console.log('- Max CSS Classes:', TIER_CONFIGS.free.maxCSSClasses); // 10
  console.log('- Max Colors:', TIER_CONFIGS.free.maxColors); // 5
  console.log('- Max Tokens:', TIER_CONFIGS.free.maxTokens); // 2000
  if ('_metadata' in result.debug.parsedDOM) {
    console.log('- Estimated Tokens:', result.debug.parsedDOM._metadata?.estimatedTokens);
  }
}

// ============ Example 2: Pro User ============
async function exampleProUser() {
  const result = await executePipeline({
    url: 'https://example.com',
    tier: 'pro', // Pro tier - more data
  });

  console.log('Pro User Result:');
  console.log('- Max CSS Classes:', TIER_CONFIGS.pro.maxCSSClasses); // 100
  console.log('- Max Colors:', TIER_CONFIGS.pro.maxColors); // 30
  console.log('- Max Tokens:', TIER_CONFIGS.pro.maxTokens); // 15000
  if ('_metadata' in result.debug.parsedDOM) {
    console.log('- Estimated Tokens:', result.debug.parsedDOM._metadata?.estimatedTokens);
  }
}

// ============ Example 3: Custom Budget ============
async function exampleCustomBudget() {
  const result = await executePipeline({
    url: 'https://example.com',
    customBudget: {
      maxTokens: 8000,
      maxCSSClasses: 50,
      maxColors: 20,
      maxImages: 20,
      includeCSSDetails: true,
      includeAllMetadata: true,
    },
  });

  console.log('Custom Budget Result:');
  console.log('- Custom Max CSS Classes: 50');
  console.log('- Custom Max Colors: 20');
  if ('_metadata' in result.debug.parsedDOM) {
    console.log('- Estimated Tokens:', result.debug.parsedDOM._metadata?.estimatedTokens);
  }
}

// ============ Example 4: No Budget (Enterprise/Full Data) ============
async function exampleNoBudget() {
  const result = await executePipeline({
    url: 'https://example.com',
    // No tier or customBudget = full data
  });

  console.log('Full Data (No Budget):');
  console.log('- All CSS classes included');
  console.log('- All colors included');
  console.log('- All data included');
  console.log('- Estimated Tokens:', estimateTokens(result.debug.parsedDOM));
}

// ============ Example 5: Check Token Estimate Before Sending ============
async function exampleEstimateTokens() {
  const result = await executePipeline({
    url: 'https://example.com',
  });

  const fullDataTokens = estimateTokens(result.debug.parsedDOM);
  console.log('Full Data Tokens:', fullDataTokens);

  // Apply budget if too large
  if (fullDataTokens > 5000) {
    const reducedResult = await executePipeline({
      url: 'https://example.com',
      tier: 'basic', // Apply basic tier
    });

    if ('_metadata' in reducedResult.debug.parsedDOM) {
      const reducedTokens = reducedResult.debug.parsedDOM._metadata?.estimatedTokens;
      console.log('Reduced Data Tokens:', reducedTokens);
    }
  }
}

// ============ Example 6: Dynamic Tier Based on User Subscription ============
interface User {
  id: string;
  subscription: 'free' | 'basic' | 'pro' | 'enterprise';
}

async function exampleDynamicTier(user: User, url: string) {
  const result = await executePipeline({
    url,
    tier: user.subscription, // Use user's subscription tier
  });

  return result;
}

// ============ Tier Comparison ============
console.log('Token Budget Configurations:');
console.log('===========================');
console.log('Free:', TIER_CONFIGS.free);
console.log('Basic:', TIER_CONFIGS.basic);
console.log('Pro:', TIER_CONFIGS.pro);
console.log('Enterprise:', TIER_CONFIGS.enterprise);

/*
Expected Output:

Token Budget Configurations:
===========================
Free: {
  maxTokens: 2000,
  maxCSSClasses: 10,
  maxColors: 5,
  maxImages: 5,
  maxSections: 5,
  maxNavItems: 5,
  includeCSSDetails: false,
  includeAllMetadata: false
}
Basic: {
  maxTokens: 5000,
  maxCSSClasses: 30,
  maxColors: 15,
  maxImages: 15,
  maxSections: 15,
  maxNavItems: 10,
  includeCSSDetails: true,
  includeAllMetadata: false
}
Pro: {
  maxTokens: 15000,
  maxCSSClasses: 100,
  maxColors: 30,
  maxImages: 30,
  maxSections: 30,
  maxNavItems: 20,
  includeCSSDetails: true,
  includeAllMetadata: true
}
Enterprise: {
  maxTokens: 50000,
  maxCSSClasses: -1, // unlimited
  maxColors: -1,
  maxImages: -1,
  maxSections: -1,
  maxNavItems: -1,
  includeCSSDetails: true,
  includeAllMetadata: true
}
*/
