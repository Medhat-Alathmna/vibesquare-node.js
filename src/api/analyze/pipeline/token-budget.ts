/**
 * Token Budget Manager
 * Handles data reduction based on user tier and token limits
 */

import { RawParsedDOM, RawDOMNode, CSSClassInfo, ColorInfo, ImageInfo } from './ir.types';

// ============ User Tiers ============
export type UserTier = 'free' | 'basic' | 'pro' | 'enterprise';

export interface TokenBudgetConfig {
  maxTokens: number;
  maxCSSClasses: number;
  maxCSSPropertiesPerNode: number;  // Limit CSS properties per node
  maxColors: number;
  maxImages: number;
  maxRootNodes: number;  // Changed from maxSections
  maxNavItems: number;
  maxTextCharsPerNode: number;  // Configurable text limit per node
  includeCSSDetails: boolean;
  includeAllMetadata: boolean;
}

// ============ Tier Configurations ============
export const TIER_CONFIGS: Record<UserTier, TokenBudgetConfig> = {
  free: {
    maxTokens: 2000,
    maxCSSClasses: 10,
    maxCSSPropertiesPerNode: 10,
    maxColors: 5,
    maxImages: 5,
    maxRootNodes: 5,
    maxNavItems: 5,
    maxTextCharsPerNode: 100,
    includeCSSDetails: true,
    includeAllMetadata: false,
  },
  basic: {
    maxTokens: 5000,
    maxCSSClasses: 30,
    maxCSSPropertiesPerNode: 20,
    maxColors: 15,
    maxImages: 15,
    maxRootNodes: 15,
    maxNavItems: 10,
    maxTextCharsPerNode: 150,
    includeCSSDetails: true,
    includeAllMetadata: false,
  },
  pro: {
    maxTokens: 15000,
    maxCSSClasses: 100,
    maxCSSPropertiesPerNode: -1,  // Unlimited
    maxColors: 30,
    maxImages: 30,
    maxRootNodes: 30,
    maxNavItems: 20,
    maxTextCharsPerNode: 200,
    includeCSSDetails: true,
    includeAllMetadata: true,
  },
  enterprise: {
    maxTokens: 50000,
    maxCSSClasses: -1, // unlimited
    maxCSSPropertiesPerNode: -1,  // Unlimited
    maxColors: -1,
    maxImages: -1,
    maxRootNodes: -1,
    maxNavItems: -1,
    maxTextCharsPerNode: -1,  // Unlimited
    includeCSSDetails: true,
    includeAllMetadata: true,
  },
};

// ============ Data Priority Levels ============
// Higher priority = more important to keep
interface DataPriority {
  rootNodes: number;
  navigation: number;
  forms: number;
  ctas: number;
  colors: number;
  fonts: number;
  cssClasses: number;
  images: number;
  footer: number;
  socialLinks: number;
  embeds: number;
}

const DATA_PRIORITIES: DataPriority = {
  rootNodes: 10,      // Critical
  navigation: 9,
  forms: 8,
  ctas: 8,
  colors: 6,
  fonts: 7,
  cssClasses: 5,
  images: 4,
  footer: 3,
  socialLinks: 2,
  embeds: 2,
};

// ============ Truncation Utilities ============

/**
 * Truncate CSS classes based on priority
 */
export function truncateCSSClasses(
  classes: CSSClassInfo[],
  maxClasses: number
): CSSClassInfo[] {
  if (maxClasses === -1) return classes;

  // Prioritize classes by number of properties (more properties = more important)
  const sorted = [...classes].sort((a, b) => {
    const aProps = Object.keys(a.properties).length;
    const bProps = Object.keys(b.properties).length;
    return bProps - aProps;
  });

  return sorted.slice(0, maxClasses);
}

/**
 * Truncate colors by frequency
 */
export function truncateColors(
  colors: ColorInfo[],
  maxColors: number
): ColorInfo[] {
  if (maxColors === -1) return colors;

  // Already sorted by frequency in parser
  return colors.slice(0, maxColors);
}

/**
 * Truncate images
 */
export function truncateImages(
  images: ImageInfo[],
  maxImages: number
): ImageInfo[] {
  if (maxImages === -1) return images;

  // Prioritize images with alt text (more semantic)
  const sorted = [...images].sort((a, b) => {
    if (a.alt && !b.alt) return -1;
    if (!a.alt && b.alt) return 1;
    return 0;
  });

  return sorted.slice(0, maxImages);
}

/**
 * Simplify CSS class properties for token reduction
 */
export function simplifyCSSClass(
  cssClass: CSSClassInfo,
  includeFull: boolean
): CSSClassInfo {
  if (includeFull) return cssClass;

  // Keep only essential properties
  const essentialProps = [
    'display', 'position', 'width', 'height', 'max-width', 'max-height',
    'padding', 'margin', 'background', 'background-color', 'color',
    'font-size', 'font-family', 'font-weight',
    'flex', 'grid', 'grid-template-columns',
    'border', 'border-radius',
  ];

  const simplified: Record<string, string> = {};
  for (const prop of essentialProps) {
    if (cssClass.properties[prop]) {
      simplified[prop] = cssClass.properties[prop];
    }
  }

  return {
    ...cssClass,
    properties: simplified,
  };
}

/**
 * Estimate token count (rough approximation)
 * 1 token ≈ 4 characters for English text
 */
export function estimateTokens(data: any): number {
  const jsonString = JSON.stringify(data);
  return Math.ceil(jsonString.length / 4);
}

/**
 * Truncate root nodes (limit tree depth and breadth)
 */
function truncateRootNodes(
  rootNodes: RawDOMNode[],
  maxRootNodes: number,
  maxTextChars: number
): RawDOMNode[] {
  if (maxRootNodes === -1) return rootNodes;

  const truncatedNodes = rootNodes.slice(0, maxRootNodes);

  // Also truncate text content in each node
  return truncatedNodes.map(node => truncateNode(node, maxTextChars));
}

/**
 * Truncate a single node's content recursively
 */
function truncateNode(node: RawDOMNode, maxTextChars: number): RawDOMNode {
  return {
    ...node,
    textContent: maxTextChars === -1
      ? node.textContent
      : node.textContent.slice(0, maxTextChars),
    children: node.children.map(child => truncateNode(child, maxTextChars)),
  };
}

// ============ Main Budget Reducer ============

export interface ReducedParsedDOM extends Omit<RawParsedDOM, 'rawTextContent'> {
  rawTextContent?: string; // Optional now
  _metadata?: {
    tier: UserTier;
    estimatedTokens: number;
    wasReduced: boolean;
  };
}

/**
 * Reduce RawParsedDOM data based on user tier
 */
export function applyTokenBudget(
  parsedDOM: RawParsedDOM,
  tier: UserTier = 'free'
): ReducedParsedDOM {
  const config = TIER_CONFIGS[tier];

  // Apply truncations
  const reducedData: ReducedParsedDOM = {
    rootNodes: truncateRootNodes(
      parsedDOM.rootNodes,
      config.maxRootNodes,
      config.maxTextCharsPerNode
    ),
    totalNodes: parsedDOM.totalNodes,
    navigation: parsedDOM.navigation.slice(0, config.maxNavItems === -1 ? undefined : config.maxNavItems),
    allForms: parsedDOM.allForms,
    allImages: truncateImages(parsedDOM.allImages, config.maxImages),
    colors: truncateColors(parsedDOM.colors, config.maxColors),
    fonts: parsedDOM.fonts,
    ctas: parsedDOM.ctas,
    footer: parsedDOM.footer,
    socialLinks: parsedDOM.socialLinks,
    embeds: parsedDOM.embeds,
    metadata: config.includeAllMetadata ? parsedDOM.metadata : {
      title: parsedDOM.metadata.title,
      description: parsedDOM.metadata.description,
      ogTags: {},
    },
    language: parsedDOM.language,
    cssInfo: {
      gridColumns: parsedDOM.cssInfo.gridColumns,
      flexColumns: parsedDOM.cssInfo.flexColumns,
      breakpoints: parsedDOM.cssInfo.breakpoints,
      hasResponsiveGrid: parsedDOM.cssInfo.hasResponsiveGrid,
      classes: config.includeCSSDetails
        ? truncateCSSClasses(parsedDOM.cssInfo.classes, config.maxCSSClasses)
        : truncateCSSClasses(parsedDOM.cssInfo.classes, config.maxCSSClasses).map(
            cls => simplifyCSSClass(cls, false)
          ),
    },
  };

  // Optionally include raw text (truncated)
  if (config.includeAllMetadata && parsedDOM.rawTextContent) {
    reducedData.rawTextContent = parsedDOM.rawTextContent.slice(0, 1000);
  }

  // Add metadata
  const estimatedTokens = estimateTokens(reducedData);
  reducedData._metadata = {
    tier,
    estimatedTokens,
    wasReduced: estimatedTokens < estimateTokens(parsedDOM),
  };

  return reducedData;
}

// ============ Custom Budget ============

/**
 * Apply custom token budget configuration
 */
export function applyCustomBudget(
  parsedDOM: RawParsedDOM,
  customConfig: Partial<TokenBudgetConfig>
): ReducedParsedDOM {
  const config: TokenBudgetConfig = {
    ...TIER_CONFIGS.free,
    ...customConfig,
  };

  // Same logic as applyTokenBudget but with custom config
  const reducedData: ReducedParsedDOM = {
    rootNodes: truncateRootNodes(
      parsedDOM.rootNodes,
      config.maxRootNodes,
      config.maxTextCharsPerNode
    ),
    totalNodes: parsedDOM.totalNodes,
    navigation: parsedDOM.navigation.slice(0, config.maxNavItems === -1 ? undefined : config.maxNavItems),
    allForms: parsedDOM.allForms,
    allImages: truncateImages(parsedDOM.allImages, config.maxImages),
    colors: truncateColors(parsedDOM.colors, config.maxColors),
    fonts: parsedDOM.fonts,
    ctas: parsedDOM.ctas,
    footer: parsedDOM.footer,
    socialLinks: parsedDOM.socialLinks,
    embeds: parsedDOM.embeds,
    metadata: config.includeAllMetadata ? parsedDOM.metadata : {
      title: parsedDOM.metadata.title,
      description: parsedDOM.metadata.description,
      ogTags: {},
    },
    language: parsedDOM.language,
    cssInfo: {
      gridColumns: parsedDOM.cssInfo.gridColumns,
      flexColumns: parsedDOM.cssInfo.flexColumns,
      breakpoints: parsedDOM.cssInfo.breakpoints,
      hasResponsiveGrid: parsedDOM.cssInfo.hasResponsiveGrid,
      classes: config.includeCSSDetails
        ? truncateCSSClasses(parsedDOM.cssInfo.classes, config.maxCSSClasses)
        : truncateCSSClasses(parsedDOM.cssInfo.classes, config.maxCSSClasses).map(
            cls => simplifyCSSClass(cls, false)
          ),
    },
  };

  if (config.includeAllMetadata && parsedDOM.rawTextContent) {
    reducedData.rawTextContent = parsedDOM.rawTextContent.slice(0, 1000);
  }

  const estimatedTokens = estimateTokens(reducedData);
  reducedData._metadata = {
    tier: 'basic', // custom tier
    estimatedTokens,
    wasReduced: estimatedTokens < estimateTokens(parsedDOM),
  };

  return reducedData;
}

/**
 * Prioritize CSS properties based on importance
 * Returns top N properties based on tier-based priority
 */
export function prioritizeCSSProperties(
  cssProperties: Record<string, string>,
  maxProperties: number
): Record<string, string> {
  if (maxProperties === -1) return cssProperties;

  // Tier 1: Layout positioning (critical for visual hierarchy)
  const tier1 = ['position', 'top', 'left', 'right', 'bottom', 'z-index'];

  // Tier 2: Colors (critical for brand/theme)
  const tier2 = ['background-color', 'background', 'color', 'border-color'];

  // Tier 3: Layout system (grid/flex)
  const tier3 = ['display', 'flex-direction', 'grid-template-columns', 'align-items', 'justify-content'];

  // Tier 4: Spacing
  const tier4 = ['padding', 'margin', 'gap', 'width', 'height', 'max-width'];

  // Tier 5: Decorative
  const tier5 = ['border', 'border-radius', 'box-shadow', 'opacity', 'transform', 'backdrop-filter'];

  const result: Record<string, string> = {};
  let count = 0;

  for (const tier of [tier1, tier2, tier3, tier4, tier5]) {
    for (const prop of tier) {
      if (count >= maxProperties) return result;
      if (cssProperties[prop]) {
        result[prop] = cssProperties[prop];
        count++;
      }
    }
  }

  return result;
}
