import {
  ParsedDOM,
  StructuralAnalysis,
  LayoutType,
  ContentDensity,
  Difficulty,
} from './ir.types';

/**
 * Structural Analyzer - 100% Deterministic, NO AI
 * Analyzes parsed DOM and returns factual structural information
 */
export function analyzeStructure(parsed: ParsedDOM): StructuralAnalysis {
  const sectionCount = parsed.sections.length;
  const layoutType = detectLayoutType(parsed);
  const hasHero = detectHero(parsed);
  const hasNavigation = parsed.navigation.length > 0;
  const hasFooter = parsed.footer !== null;
  const cardSections = countCardSections(parsed);
  const contentDensity = calculateContentDensity(parsed);
  const { difficulty, difficultyReason } = calculateDifficulty(parsed, layoutType, cardSections);

  return {
    sectionCount,
    layoutType,
    hasHero,
    hasNavigation,
    hasFooter,
    cardSections,
    contentDensity,
    difficulty,
    difficultyReason,
  };
}

function detectLayoutType(parsed: ParsedDOM): LayoutType {
  // Analyze class names for grid/flex patterns
  let gridCount = 0;
  let twoColumnCount = 0;
  let singleColumnCount = 0;

  parsed.sections.forEach(section => {
    const className = (section.className || '').toLowerCase();
    const id = (section.id || '').toLowerCase();
    const combined = className + ' ' + id;

    // Check for grid patterns
    if (
      combined.includes('grid') ||
      combined.includes('cards') ||
      combined.includes('gallery') ||
      combined.includes('features') ||
      section.childCount >= 3
    ) {
      gridCount++;
    }

    // Check for two-column patterns
    if (
      combined.includes('two-col') ||
      combined.includes('split') ||
      combined.includes('sidebar') ||
      combined.includes('aside') ||
      section.childCount === 2
    ) {
      twoColumnCount++;
    }

    // Check for single column patterns
    if (
      combined.includes('hero') ||
      combined.includes('banner') ||
      combined.includes('cta') ||
      combined.includes('full-width') ||
      section.childCount <= 1
    ) {
      singleColumnCount++;
    }
  });

  const total = parsed.sections.length || 1;

  // Determine layout type based on ratios
  if (gridCount / total > 0.4) {
    return 'grid';
  }
  if (twoColumnCount / total > 0.4) {
    return 'two-column';
  }
  if (singleColumnCount / total > 0.6) {
    return 'single-column';
  }
  return 'mixed';
}

function detectHero(parsed: ParsedDOM): boolean {
  // Check first section for hero indicators
  const firstSection = parsed.sections[0];
  if (!firstSection) return false;

  const className = (firstSection.className || '').toLowerCase();
  const id = (firstSection.id || '').toLowerCase();
  const tag = firstSection.tag.toLowerCase();
  const combined = className + ' ' + id;

  // Check for common hero patterns
  if (
    combined.includes('hero') ||
    combined.includes('banner') ||
    combined.includes('jumbotron') ||
    combined.includes('splash') ||
    combined.includes('landing') ||
    combined.includes('intro')
  ) {
    return true;
  }

  // Check if it's a header followed by a large content section
  if (tag === 'header' || tag === 'section') {
    // Check for CTA in first section
    const hasHeroCTA = parsed.ctas.some(cta => cta.location === 'hero' || cta.location === 'header');
    if (hasHeroCTA) return true;
  }

  return false;
}

function countCardSections(parsed: ParsedDOM): number {
  let cardCount = 0;

  parsed.sections.forEach(section => {
    const className = (section.className || '').toLowerCase();
    const id = (section.id || '').toLowerCase();
    const combined = className + ' ' + id;

    if (
      combined.includes('card') ||
      combined.includes('feature') ||
      combined.includes('service') ||
      combined.includes('team') ||
      combined.includes('testimonial') ||
      combined.includes('pricing') ||
      combined.includes('product') ||
      combined.includes('portfolio') ||
      combined.includes('blog') ||
      combined.includes('post')
    ) {
      cardCount++;
    }

    // Also count sections with multiple similar children (likely cards)
    if (section.childCount >= 3 && section.childCount <= 12) {
      // Likely a card grid
      cardCount++;
    }
  });

  return cardCount;
}

function calculateContentDensity(parsed: ParsedDOM): ContentDensity {
  // Calculate based on multiple factors
  const textLength = parsed.rawTextContent?.length;
  const imageCount = parsed.images.length;
  const formCount = parsed.forms.length;
  const sectionCount = parsed.sections.length;
  const ctaCount = parsed.ctas.length;

  // Score calculation
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

  // Section count
  if (sectionCount > 10) score += 2;
  else if (sectionCount > 5) score += 1;

  // CTA count
  if (ctaCount > 5) score += 1;

  // Map score to density
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function calculateDifficulty(
  parsed: ParsedDOM,
  layoutType: LayoutType,
  cardSections: number
): { difficulty: Difficulty; difficultyReason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Section count impact
  if (parsed.sections.length > 15) {
    score += 3;
    reasons.push('many sections');
  } else if (parsed.sections.length > 8) {
    score += 2;
    reasons.push('moderate sections');
  } else if (parsed.sections.length > 4) {
    score += 1;
  }

  // Layout complexity
  if (layoutType === 'grid' || layoutType === 'mixed') {
    score += 2;
    reasons.push('complex layout');
  } else if (layoutType === 'two-column') {
    score += 1;
  }

  // Card sections add complexity
  if (cardSections > 3) {
    score += 2;
    reasons.push('multiple card grids');
  } else if (cardSections > 0) {
    score += 1;
  }

  // Forms add complexity
  if (parsed.forms.length > 0) {
    const totalFields = parsed.forms.reduce((sum, f) => sum + f.fields.length, 0);
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

  // Build reason string
  const difficultyReason = reasons.length > 0
    ? reasons.slice(0, 3).join(', ')
    : difficulty === 'easy' ? 'simple structure' : 'moderate complexity';

  return { difficulty, difficultyReason };
}

export const analyzer = {
  analyze: analyzeStructure,
};
