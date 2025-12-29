/**
 * Token Budget Manager
 * Handles data reduction based on user tier and token limits
 */

import { RawParsedDOM, RawDOMNode, CSSClassInfo, ColorInfo, ImageInfo, CSSValueDictionary } from './ir.types';
import { ApiError } from '../../../shared/utils/ApiError';
import httpStatus from 'http-status';

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
  // CSS Value Compression
  enableCSSCompression: boolean;      // Enable dictionary encoding for CSS values
  compressionMinOccurrences: number;  // Min occurrences to add value to dictionary
}

// ============ Tier Configurations ============
export const TIER_CONFIGS: Record<UserTier, TokenBudgetConfig> = {
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

import { GPTTokens } from 'gpt-tokens';

/**
 * Estimate token count using gpt-tokens
 */
export function estimateTokens(data: any): number {
  const content = typeof data === 'string' ? data : JSON.stringify(data);

  // Use gpt-4o as baseline for token counting (cl100k_base encoding)
  const usage = new GPTTokens({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content }],
  });

  return usage.usedTokens;
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

// ============ CSS Value Compression ============

/**
 * Get category prefix for a CSS property
 * c=colors, d=display, p=position, s=spacing, v=other
 */
function getCSSPropertyPrefix(property: string): string {
  const colorProps = ['background-color', 'background', 'color', 'border-color'];
  const displayProps = ['display'];
  const positionProps = ['position'];
  const spacingProps = ['padding', 'margin', 'gap', 'width', 'height', 'max-width', 'min-width', 'max-height', 'min-height'];

  if (colorProps.includes(property)) return 'c';
  if (displayProps.includes(property)) return 'd';
  if (positionProps.includes(property)) return 'p';
  if (spacingProps.includes(property)) return 's';
  return 'v';
}

/**
 * Traverse all nodes in the tree and call callback for each
 */
function traverseNodes(nodes: RawDOMNode[], callback: (node: RawDOMNode) => void): void {
  for (const node of nodes) {
    callback(node);
    if (node.children.length > 0) {
      traverseNodes(node.children, callback);
    }
  }
}

/**
 * Build a dictionary of repeated CSS values for compression
 * Only includes values that appear at least minOccurrences times
 */
function buildCSSValueDictionary(
  rootNodes: RawDOMNode[],
  minOccurrences: number
): { dictionary: CSSValueDictionary; valueToId: Map<string, string> } {
  // Step 1: Count frequency of each property:value pair
  const frequency = new Map<string, number>();

  traverseNodes(rootNodes, (node) => {
    if (node.cssProperties) {
      for (const [prop, value] of Object.entries(node.cssProperties)) {
        const key = `${prop}:${value}`;
        frequency.set(key, (frequency.get(key) || 0) + 1);
      }
    }
  });

  // Step 2: Build dictionary for high-frequency values
  const dictionary: CSSValueDictionary = { values: {} };
  const valueToId = new Map<string, string>();
  const counters: Record<string, number> = { c: 0, d: 0, p: 0, s: 0, v: 0 };

  // Sort by frequency (highest first) for consistent IDs
  const sortedEntries = Array.from(frequency.entries())
    .filter(([, count]) => count >= minOccurrences)
    .sort((a, b) => b[1] - a[1]);

  for (const [key] of sortedEntries) {
    const colonIndex = key.indexOf(':');
    const prop = key.substring(0, colonIndex);
    const value = key.substring(colonIndex + 1);

    const prefix = getCSSPropertyPrefix(prop);
    counters[prefix]++;
    const id = `${prefix}${counters[prefix]}`;

    dictionary.values[id] = value;
    valueToId.set(key, id);
  }

  return { dictionary, valueToId };
}

/**
 * Compress CSS properties in a node using the dictionary
 */
function compressNodeCSS(
  node: RawDOMNode,
  valueToId: Map<string, string>
): RawDOMNode {
  const compressedProperties: Record<string, string> = {};

  if (node.cssProperties) {
    for (const [prop, value] of Object.entries(node.cssProperties)) {
      const key = `${prop}:${value}`;
      const id = valueToId.get(key);
      compressedProperties[prop] = id || value; // Use ID if available, else original value
    }
  }

  return {
    ...node,
    cssProperties: compressedProperties,
    children: node.children.map(child => compressNodeCSS(child, valueToId)),
  };
}

// ============ Main Budget Reducer ============

export interface ReducedParsedDOM extends Omit<RawParsedDOM, 'rawTextContent'> {
  rawTextContent?: string; // Optional now
  cssValueDictionary?: CSSValueDictionary; // Dictionary for compressed CSS values
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

  // Add metadata
  reducedData._metadata = {
    tier,
    estimatedTokens,
    wasReduced: estimatedTokens < estimateTokens(parsedDOM),
  };

  return reducedData;
}

function reduceWithConfig(parsedDOM: RawParsedDOM, config: TokenBudgetConfig): ReducedParsedDOM {
  // Step 1: Truncate root nodes
  let rootNodes = truncateRootNodes(
    parsedDOM.rootNodes,
    config.maxRootNodes,
    config.maxTextCharsPerNode
  );

  // Step 2: Apply CSS value compression if enabled
  let cssValueDictionary: CSSValueDictionary | undefined;
  if (config.enableCSSCompression) {
    const { dictionary, valueToId } = buildCSSValueDictionary(
      rootNodes,
      config.compressionMinOccurrences
    );
    // Only use dictionary if it has entries (saves overhead for small pages)
    if (Object.keys(dictionary.values).length > 0) {
      cssValueDictionary = dictionary;
      rootNodes = rootNodes.map(node => compressNodeCSS(node, valueToId));
    }
  }

  return {
    rootNodes,
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
    cssValueDictionary,
    rawTextContent: (config.includeAllMetadata && parsedDOM.rawTextContent)
      ? parsedDOM.rawTextContent.slice(0, 1000)
      : undefined
  };
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

  // Use shared reduceWithConfig to avoid code duplication
  const reducedData = reduceWithConfig(parsedDOM, config);

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
