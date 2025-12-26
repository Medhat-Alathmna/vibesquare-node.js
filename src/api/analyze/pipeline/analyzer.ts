import {
  RawParsedDOM,
  RawDOMNode,
  StructuralAnalysis,
  LayoutType,
  ContentDensity,
  Difficulty,
} from './ir.types';

/**
 * Visual Characteristics Interface
 * Deterministic visual behavior inferred from CSS properties
 */
export interface VisualCharacteristics {
  isFixed: boolean;
  isSticky: boolean;
  isOverlay: boolean; // z-index > 100
  hasBackdropEffect: boolean; // backdrop-filter present
  hasElevation: boolean; // box-shadow present
  colorRole: 'brand' | 'neutral' | 'accent' | 'unknown';
  layoutRole: 'container' | 'grid' | 'flex-row' | 'flex-column' | 'absolute-positioned';
}

/**
 * Structural Analyzer - 100% Deterministic, NO AI
 * Analyzes parsed DOM tree and returns factual structural information
 * NO semantic role assignment - that's for the LLM
 */
export function analyzeStructure(parsed: RawParsedDOM): StructuralAnalysis {
  const nodeCount = parsed.totalNodes;
  const rootNodeCount = parsed.rootNodes.length;
  const maxDepth = calculateMaxDepth(parsed.rootNodes);
  const layoutType = detectLayoutType(parsed.rootNodes);
  const hasNavigation = parsed.navigation.length > 0;
  const hasFooter = parsed.footer !== null;
  const contentDensity = calculateContentDensity(parsed);
  const { difficulty, difficultyReason } = calculateDifficulty(parsed, layoutType);

  return {
    nodeCount,
    rootNodeCount,
    maxDepth,
    layoutType,
    hasNavigation,
    hasFooter,
    contentDensity,
    difficulty,
    difficultyReason,
  };
}

/**
 * Calculate the maximum depth of the DOM tree
 */
function calculateMaxDepth(nodes: RawDOMNode[]): number {
  let maxDepth = 0;

  function traverse(node: RawDOMNode): void {
    if (node.depth > maxDepth) {
      maxDepth = node.depth;
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return maxDepth;
}

/**
 * Traverse all nodes in the tree and apply a callback
 */
function traverseTree(nodes: RawDOMNode[], callback: (node: RawDOMNode) => void): void {
  function traverse(node: RawDOMNode): void {
    callback(node);
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const node of nodes) {
    traverse(node);
  }
}

/**
 * Detect layout type based on CSS properties in the tree
 * Uses display, grid-template-columns, flex properties
 */
function detectLayoutType(rootNodes: RawDOMNode[]): LayoutType {
  let gridCount = 0;
  let flexCount = 0;
  let totalContainers = 0;

  traverseTree(rootNodes, (node) => {
    if (!node.isContainer) return;
    totalContainers++;

    const display = node.cssProperties['display'];
    const gridCols = node.cssProperties['grid-template-columns'];

    // Check for grid
    if (display === 'grid' || gridCols) {
      gridCount++;
    }

    // Check for flex
    if (display === 'flex') {
      flexCount++;
    }

    // Also check className patterns
    const className = (node.className || '').toLowerCase();
    if (className.includes('grid') || className.includes('cols-')) {
      gridCount++;
    }
  });

  if (totalContainers === 0) return 'single-column';

  const gridRatio = gridCount / totalContainers;
  const flexRatio = flexCount / totalContainers;

  // Determine layout type based on ratios
  if (gridRatio > 0.2) {
    return 'grid';
  }
  if (flexRatio > 0.3 && gridRatio < 0.1) {
    // Check for two-column flex layouts
    let twoColFlex = 0;
    traverseTree(rootNodes, (node) => {
      if (node.cssProperties['display'] === 'flex' && node.children.length === 2) {
        twoColFlex++;
      }
    });
    if (twoColFlex > 0) {
      return 'two-column';
    }
  }
  if (gridRatio > 0.1 || flexRatio > 0.2) {
    return 'mixed';
  }

  return 'single-column';
}

/**
 * Calculate content density based on tree size and content
 */
function calculateContentDensity(parsed: RawParsedDOM): ContentDensity {
  const textLength = parsed.rawTextContent?.length || 0;
  const imageCount = parsed.allImages.length;
  const formCount = parsed.allForms.length;
  const nodeCount = parsed.totalNodes;
  const ctaCount = parsed.ctas.length;

  let score = 0;

  // Text density
  if (textLength > 3000) score += 3;
  else if (textLength > 1500) score += 2;
  else if (textLength > 500) score += 1;

  // Image density
  if (imageCount > 15) score += 2;
  else if (imageCount > 5) score += 1;

  // Form complexity
  if (formCount > 2) score += 2;
  else if (formCount > 0) score += 1;

  // Node count (replaces section count)
  if (nodeCount > 100) score += 2;
  else if (nodeCount > 50) score += 1;

  // CTA count
  if (ctaCount > 5) score += 1;

  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

/**
 * Calculate difficulty based on tree complexity
 */
function calculateDifficulty(
  parsed: RawParsedDOM,
  layoutType: LayoutType
): { difficulty: Difficulty; difficultyReason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Node count impact
  if (parsed.totalNodes > 100) {
    score += 3;
    reasons.push('many nodes');
  } else if (parsed.totalNodes > 50) {
    score += 2;
    reasons.push('moderate nodes');
  } else if (parsed.totalNodes > 20) {
    score += 1;
  }

  // Tree depth impact
  const maxDepth = calculateMaxDepth(parsed.rootNodes);
  if (maxDepth > 15) {
    score += 2;
    reasons.push('deep nesting');
  } else if (maxDepth > 10) {
    score += 1;
  }

  // Layout complexity
  if (layoutType === 'grid' || layoutType === 'mixed') {
    score += 2;
    reasons.push('complex layout');
  } else if (layoutType === 'two-column') {
    score += 1;
  }

  // Forms add complexity
  if (parsed.allForms.length > 0) {
    const totalFields = parsed.allForms.reduce((sum, f) => sum + f.fields.length, 0);
    if (totalFields > 10) {
      score += 3;
      reasons.push('complex forms');
    } else if (totalFields > 5) {
      score += 2;
      reasons.push('forms present');
    } else {
      score += 1;
    }
  }

  // Navigation complexity
  if (parsed.navigation.some(item => item.children.length > 0)) {
    score += 1;
    reasons.push('dropdown menus');
  }

  // Embeds add complexity
  if (parsed.embeds.length > 0) {
    score += 1;
    reasons.push('embedded content');
  }

  // Multiple CTAs
  if (parsed.ctas.length > 5) {
    score += 1;
  }

  // Footer complexity
  if (parsed.footer && parsed.footer.columns.length > 3) {
    score += 1;
    reasons.push('detailed footer');
  }

  // Determine difficulty level
  let difficulty: Difficulty;
  if (score >= 8) {
    difficulty = 'hard';
  } else if (score >= 4) {
    difficulty = 'medium';
  } else {
    difficulty = 'easy';
  }

  const difficultyReason = reasons.length > 0
    ? reasons.slice(0, 3).join(', ')
    : difficulty === 'easy' ? 'simple structure' : 'moderate complexity';

  return { difficulty, difficultyReason };
}

/**
 * Infer visual characteristics from CSS properties
 * 100% deterministic rule-based interpretation
 */
export function inferVisualCharacteristics(
  cssProperties: Record<string, string>
): VisualCharacteristics {
  const result: VisualCharacteristics = {
    isFixed: false,
    isSticky: false,
    isOverlay: false,
    hasBackdropEffect: false,
    hasElevation: false,
    colorRole: 'unknown',
    layoutRole: 'container'
  };

  // Position rules
  if (cssProperties['position'] === 'fixed') {
    result.isFixed = true;
  }
  if (cssProperties['position'] === 'sticky') {
    result.isSticky = true;
  }

  // Overlay detection
  const zIndex = parseInt(cssProperties['z-index'] || '0');
  if (zIndex > 100) {
    result.isOverlay = true;
  }

  // Backdrop effect
  if (cssProperties['backdrop-filter']) {
    result.hasBackdropEffect = true;
  }

  // Elevation
  if (cssProperties['box-shadow']) {
    result.hasElevation = true;
  }

  // Layout role
  const display = cssProperties['display'];
  if (display === 'grid') {
    result.layoutRole = 'grid';
  } else if (display === 'flex') {
    const direction = cssProperties['flex-direction'];
    result.layoutRole = direction === 'column' ? 'flex-column' : 'flex-row';
  } else if (cssProperties['position'] === 'absolute') {
    result.layoutRole = 'absolute-positioned';
  }

  return result;
}

export const analyzer = {
  analyze: analyzeStructure,
  inferVisuals: inferVisualCharacteristics,
};
