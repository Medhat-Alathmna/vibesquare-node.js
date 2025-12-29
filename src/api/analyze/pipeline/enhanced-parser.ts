import { JSDOM } from 'jsdom';
import {
  MAX_DOM_DEPTH,
  NavItem,
  FormInfo,
  FormField,
  ColorInfo,
  CTAInfo,
  FooterInfo,
  FooterColumn,
  SocialLink,
  PageMetadata,
  CSSClassInfo,
  EnhancedParsedDOM,
  EnhancedRawDOMNode,
  EnhancedImageInfo,
  LayoutSignals,
  VisualSectionMeta,
} from './ir.types';
import { NormalizationResult } from './normalizer';
import { ApiError } from '../../../shared/utils/ApiError';
import httpStatus from 'http-status';

// ============ Constants ============

const MAX_ROOT_NODES = 100;
const MIN_BODY_LENGTH = 100;
const SECTION_SCORE_THRESHOLD = 40;
const CSS_DEDUP_MIN_OCCURRENCES = 3;

// Social media platform patterns
const SOCIAL_PATTERNS: { pattern: RegExp; platform: SocialLink['platform'] }[] = [
  { pattern: /facebook\.com|fb\.com/i, platform: 'facebook' },
  { pattern: /twitter\.com|x\.com/i, platform: 'twitter' },
  { pattern: /instagram\.com/i, platform: 'instagram' },
  { pattern: /linkedin\.com/i, platform: 'linkedin' },
  { pattern: /youtube\.com|youtu\.be/i, platform: 'youtube' },
  { pattern: /github\.com/i, platform: 'github' },
  { pattern: /tiktok\.com/i, platform: 'tiktok' },
];

// CTA keywords for detecting buttons
const CTA_KEYWORDS = [
  'get started', 'sign up', 'subscribe', 'buy now', 'learn more', 'contact',
  'download', 'try free', 'start', 'join', 'register', 'book', 'order',
];

// ============ Visually Meaningful CSS Properties ============

/**
 * CSS properties that are visually meaningful
 * These are the only properties included in the output
 */
const VISUAL_CSS_PROPERTIES = new Set([
  // Tier 1: Layout Positioning
  'position', 'top', 'left', 'right', 'bottom', 'z-index', 'float', 'clear',

  // Tier 2: Layout System (Grid/Flex)
  'display', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex',
  'grid-template-columns', 'grid-template-rows', 'grid-gap', 'gap', 'row-gap', 'column-gap',
  'grid-column', 'grid-row', 'grid-area',
  'align-items', 'justify-content', 'align-self', 'justify-self', 'align-content',
  'place-items', 'place-content', 'place-self',

  // Tier 3: Spacing
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',

  // Tier 4: Visual/Background
  'background', 'background-color', 'background-image', 'background-size', 'background-position',
  'background-repeat', 'background-attachment',
  'border', 'border-width', 'border-style', 'border-color', 'border-radius',
  'border-top', 'border-right', 'border-bottom', 'border-left',
  'opacity', 'filter', 'backdrop-filter',

  // Tier 5: Typography
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'color', 'text-align', 'text-transform', 'text-decoration', 'letter-spacing',
  'text-shadow', 'white-space', 'word-break',

  // Tier 6: Visual Effects
  'box-shadow', 'transform', 'transition', 'animation',
  'overflow', 'overflow-x', 'overflow-y',
  'visibility', 'object-fit', 'object-position',
]);

// ============ Main Parser Function ============

/**
 * Parse HTML into EnhancedParsedDOM with layout signals and visual metadata
 * Output is designed to be sent AS-IS to LLM
 */
export function parseHtmlEnhanced(
  normalizedResult: NormalizationResult,
  originalUrl: string
): EnhancedParsedDOM {
  const dom = new JSDOM(normalizedResult.html);
  const document = dom.window.document;

  // Validate content
  const bodyText = document.body?.textContent?.trim() || '';
  const hasContent = !!(
    document.querySelector('header') ||
    document.querySelector('main') ||
    document.querySelector('section') ||
    document.querySelector('nav') ||
    document.querySelector('footer') ||
    document.querySelector('article') ||
    document.querySelector('div')
  );

  if (bodyText.length < MIN_BODY_LENGTH && !hasContent) {
    throw new ApiError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'This page appears to require JavaScript to render content. Only static HTML pages are supported.'
    );
  }

  // Extract enhanced DOM tree with layout signals
  const { rootNodes, totalNodes, allImages } = extractEnhancedDOMTree(
    document.body,
    normalizedResult.extractedCSS.classes,
    originalUrl
  );

  // Extract background images with mock detection
  const backgroundImages = extractBackgroundImagesEnhanced(
    normalizedResult.extractedCSS.classes,
    originalUrl
  );

  // Merge images (deduplicate by URL)
  const imageUrlSet = new Set(allImages.map(img => img.url));
  for (const bgImg of backgroundImages) {
    if (!imageUrlSet.has(bgImg.url)) {
      allImages.push(bgImg);
    }
  }

  // Analyze visual sections and calculate metrics
  const { visualSectionCount, maxVisualDepth } = analyzeVisualSections(rootNodes);

  // Build shared CSS map for deduplication
  const sharedCSSProperties = buildSharedCSSMap(rootNodes);

  // Extract other global data
  const allForms = extractForms(document);
  const navigation = extractNavigation(document);
  const colors = extractColors(document);
  const fonts = normalizedResult.extractedFonts;
  const ctas = extractCTAs(document);
  const footer = extractFooter(document);
  const socialLinks = extractSocialLinks(document);
  const embeds = normalizedResult.extractedEmbeds;
  const metadata = extractMetadata(document);
  const language = detectLanguage(document);
  const rawTextContent = getRawTextContent(document);

  return {
    rootNodes,
    totalNodes,
    allImages,
    allForms,
    navigation,
    fonts,
    colors,
    ctas,
    footer,
    socialLinks,
    embeds,
    metadata,
    language,
    rawTextContent,
    cssInfo: normalizedResult.extractedCSS,
    sharedCSSProperties: Object.keys(sharedCSSProperties).length > 0 ? sharedCSSProperties : undefined,
    visualSectionCount,
    maxVisualDepth,
  };
}

// ============ Enhanced DOM Extraction ============

/**
 * Extract enhanced DOM tree with layout signals
 */
function extractEnhancedDOMTree(
  body: Element,
  extractedClasses: CSSClassInfo[],
  baseUrl: string
): { rootNodes: EnhancedRawDOMNode[]; totalNodes: number; allImages: EnhancedImageInfo[] } {
  const rootNodes: EnhancedRawDOMNode[] = [];
  const orderCounter = { value: 0 };
  const allImages: EnhancedImageInfo[] = [];

  // Process direct children of body
  const children = Array.from(body.children).slice(0, MAX_ROOT_NODES);

  for (const child of children) {
    const node = extractEnhancedNodeRecursive(
      child as Element,
      orderCounter,
      0,
      extractedClasses,
      baseUrl,
      allImages,
      undefined // No parent background for root nodes
    );
    rootNodes.push(node);
  }

  return {
    rootNodes,
    totalNodes: orderCounter.value,
    allImages,
  };
}

/**
 * Recursively extract enhanced DOM node with layout signals and visual metadata
 */
function extractEnhancedNodeRecursive(
  element: Element,
  orderCounter: { value: number },
  depth: number,
  extractedClasses: CSSClassInfo[],
  baseUrl: string,
  allImages: EnhancedImageInfo[],
  parentBackground?: string
): EnhancedRawDOMNode {
  const currentOrder = orderCounter.value++;
  const tag = element.tagName.toLowerCase();

  // Extract all attributes (excluding class)
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    if (attr.name === 'class') continue;
    attributes[attr.name] = attr.value;
  }

  // Extract CSS properties (filtered to visually meaningful only)
  const allCSS = extractAllCSSProperties(element, extractedClasses);
  const cssProperties = filterVisualCSSProperties(allCSS);

  // Extract layout signals from CSS
  const layoutSignals = extractLayoutSignals(cssProperties);

  // Extract images with mock detection
  const nodeImages = extractNodeImagesEnhanced(element, baseUrl, tag);

  // Add to global images list
  for (const img of nodeImages) {
    if (!allImages.find(existing => existing.url === img.url)) {
      allImages.push(img);
    }
  }

  // Recursively process children (respecting depth limit)
  const children: EnhancedRawDOMNode[] = [];
  const hasChildren = element.children.length > 0;

  // Determine current background for child comparison
  const currentBackground = cssProperties['background-color'] ||
                            cssProperties['background'] ||
                            parentBackground;

  if (depth < MAX_DOM_DEPTH) {
    for (const child of Array.from(element.children)) {
      children.push(
        extractEnhancedNodeRecursive(
          child as Element,
          orderCounter,
          depth + 1,
          extractedClasses,
          baseUrl,
          allImages,
          currentBackground
        )
      );
    }
  }

  // Calculate visual section metadata
  const visualMeta = calculateVisualMeta(
    cssProperties,
    layoutSignals,
    depth,
    children,
    parentBackground
  );

  // Get text content
  let textContent = '';
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) { // Text node
      textContent += node.textContent || '';
    }
  }
  textContent = textContent.trim();
  if (!textContent && element.textContent) {
    textContent = element.textContent.trim();
  }

  return {
    tag,
    order: currentOrder,
    id: element.id || undefined,
    className: element.className || undefined,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    depth,
    isContainer: hasChildren,
    children,
    textContent,
    cssProperties,
    images: nodeImages,
    layoutSignals,
    visualMeta,
  };
}

// ============ CSS Extraction ============

/**
 * Extract ALL CSS properties from element
 * Merges: class-based CSS + inline styles
 */
function extractAllCSSProperties(
  element: Element,
  extractedClasses: CSSClassInfo[]
): Record<string, string> {
  const mergedProperties: Record<string, string> = {};
  const className = element.className || '';

  // 1. Extract properties from CSS classes
  if (className && typeof className === 'string') {
    const classNames = className
      .trim()
      .split(/\s+/)
      .filter(name => name.length > 0);

    for (const name of classNames) {
      const matches = extractedClasses.filter(
        cssClass => cssClass.className.toLowerCase() === name.toLowerCase()
      );

      for (const cssClass of matches) {
        for (const [property, value] of Object.entries(cssClass.properties)) {
          mergedProperties[property] = value;
        }
      }
    }
  }

  // 2. Extract inline styles (override class properties)
  const inlineStyle = element.getAttribute('style');
  if (inlineStyle) {
    const styleRules = inlineStyle.split(';').filter(s => s.trim());
    for (const rule of styleRules) {
      const [property, ...valueParts] = rule.split(':');
      if (property && valueParts.length > 0) {
        const propName = property.trim().toLowerCase();
        const propValue = valueParts.join(':').trim();
        if (propName && propValue) {
          mergedProperties[propName] = propValue;
        }
      }
    }
  }

  return mergedProperties;
}

/**
 * Filter CSS properties to only visually meaningful ones
 */
function filterVisualCSSProperties(
  allProperties: Record<string, string>
): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [property, value] of Object.entries(allProperties)) {
    // Skip vendor prefixes
    if (property.startsWith('-webkit-') ||
        property.startsWith('-moz-') ||
        property.startsWith('-ms-') ||
        property.startsWith('-o-')) {
      continue;
    }

    if (VISUAL_CSS_PROPERTIES.has(property)) {
      filtered[property] = value;
    }
  }

  return filtered;
}

// ============ Layout Signal Extraction ============

/**
 * Extract layout signals from CSS properties
 */
function extractLayoutSignals(
  cssProperties: Record<string, string>
): LayoutSignals {
  // Position type
  const position = cssProperties['position'] || 'static';
  const positionType = (['static', 'relative', 'absolute', 'fixed', 'sticky'].includes(position)
    ? position
    : 'static') as LayoutSignals['positionType'];

  // Z-index and layering
  const zIndex = parseInt(cssProperties['z-index'] || '0', 10) || 0;
  const layering = {
    zIndex,
    isOverlay: zIndex > 100,
    hasBackdrop: !!cssProperties['backdrop-filter'],
  };

  // Spacing metrics
  const spacing = {
    padding: cssProperties['padding'] || null,
    margin: cssProperties['margin'] || null,
    gap: cssProperties['gap'] || null,
    width: cssProperties['width'] || null,
    height: cssProperties['height'] || null,
  };

  // Layout role from display property
  const display = cssProperties['display'] || '';
  const flexDirection = cssProperties['flex-direction'] || 'row';

  let layoutRole: LayoutSignals['layoutRole'] = 'container';
  let gridColumns: number | undefined;
  let flexDir: LayoutSignals['flexDirection'] | undefined;

  if (display === 'grid' || display === 'inline-grid') {
    layoutRole = 'grid';
    gridColumns = extractGridColumnCount(cssProperties);
  } else if (display === 'flex' || display === 'inline-flex') {
    flexDir = (['row', 'column', 'row-reverse', 'column-reverse'].includes(flexDirection)
      ? flexDirection
      : 'row') as LayoutSignals['flexDirection'];
    layoutRole = (flexDir && flexDir.includes('column')) ? 'flex-column' : 'flex-row';
  } else if (positionType === 'absolute') {
    layoutRole = 'absolute-positioned';
  } else if (display === 'inline' || display === 'inline-block') {
    layoutRole = 'inline';
  }

  // Visual effects
  const hasElevation = !!(cssProperties['box-shadow'] && cssProperties['box-shadow'] !== 'none');
  const hasTransform = !!(cssProperties['transform'] && cssProperties['transform'] !== 'none');
  const opacityStr = cssProperties['opacity'];
  const opacity = opacityStr ? parseFloat(opacityStr) : undefined;

  return {
    positionType,
    layering,
    spacing,
    layoutRole,
    gridColumns,
    flexDirection: flexDir,
    hasElevation,
    hasTransform,
    opacity,
  };
}

/**
 * Extract grid column count from CSS
 */
function extractGridColumnCount(cssProperties: Record<string, string>): number | undefined {
  const gridCols = cssProperties['grid-template-columns'];
  if (!gridCols) return undefined;

  // Count explicit columns (e.g., "1fr 1fr 1fr" = 3)
  const parts = gridCols.split(/\s+/).filter(p => p && p !== 'auto');

  // Check for repeat notation
  const repeatMatch = gridCols.match(/repeat\((\d+)/);
  if (repeatMatch) {
    return parseInt(repeatMatch[1], 10);
  }

  return parts.length || undefined;
}

// ============ Visual Section Detection ============

/**
 * Calculate visual section metadata
 */
function calculateVisualMeta(
  cssProperties: Record<string, string>,
  layoutSignals: LayoutSignals,
  depth: number,
  children: EnhancedRawDOMNode[],
  parentBackground?: string
): VisualSectionMeta {
  // Background analysis
  const bgColor = cssProperties['background-color'];
  const bgImage = cssProperties['background-image'];
  const bg = cssProperties['background'];

  const hasBackgroundColor = !!(bgColor && bgColor !== 'transparent' && bgColor !== 'inherit');
  const hasBackgroundImage = !!(bgImage && bgImage !== 'none') || (!!bg && bg.includes('url('));
  const backgroundValue = bgColor || bg || undefined;

  // Check if background changed from parent
  const backgroundChanged = !!(
    backgroundValue &&
    backgroundValue !== parentBackground &&
    backgroundValue !== 'transparent' &&
    backgroundValue !== 'inherit'
  );

  // Calculate section score
  const sectionScore = calculateSectionScore(
    layoutSignals,
    backgroundChanged,
    hasBackgroundColor,
    hasBackgroundImage,
    depth,
    cssProperties
  );

  // Check for nested sections
  const containsNestedSections = children.some(child =>
    child.visualMeta.isSectionCandidate || child.visualMeta.containsNestedSections
  );

  return {
    hasBackgroundColor,
    hasBackgroundImage,
    backgroundValue,
    isSectionCandidate: sectionScore >= SECTION_SCORE_THRESHOLD,
    sectionScore,
    visualDepth: depth,
    containsNestedSections,
  };
}

/**
 * Calculate section score using multi-factor analysis
 * Returns 0-100 confidence score
 */
function calculateSectionScore(
  layoutSignals: LayoutSignals,
  backgroundChanged: boolean,
  hasBackgroundColor: boolean,
  hasBackgroundImage: boolean,
  depth: number,
  cssProperties: Record<string, string>
): number {
  let score = 0;

  // Factor 1: Background change (30 points)
  if (backgroundChanged) {
    score += 30;
  } else if (hasBackgroundColor || hasBackgroundImage) {
    score += 15;
  }

  // Factor 2: Layout role (25 points)
  switch (layoutSignals.layoutRole) {
    case 'grid':
      score += 25;
      break;
    case 'flex-column':
      score += 20;
      break;
    case 'flex-row':
      score += 15;
      break;
    case 'container':
      score += 5;
      break;
  }

  // Factor 3: Positioning (15 points)
  if (layoutSignals.positionType === 'relative') {
    score += 15;
  } else if (layoutSignals.positionType === 'absolute' || layoutSignals.positionType === 'fixed') {
    score += 10;
  }

  // Factor 4: Z-index layering (10 points)
  if (layoutSignals.layering.zIndex > 0) {
    score += 10;
  }

  // Factor 5: Significant spacing (10 points)
  if (hasSignificantSpacing(cssProperties)) {
    score += 10;
  }

  // Factor 6: Depth (10 points) - prefer shallower elements
  if (depth <= 3) {
    score += 10;
  } else if (depth <= 5) {
    score += 5;
  }

  return Math.min(100, score);
}

/**
 * Check if element has significant spacing
 */
function hasSignificantSpacing(cssProperties: Record<string, string>): boolean {
  const spacingProps = ['padding', 'padding-top', 'padding-bottom', 'margin', 'margin-top', 'margin-bottom'];

  for (const prop of spacingProps) {
    const value = cssProperties[prop];
    if (value) {
      // Extract numeric value
      const numMatch = value.match(/(\d+)/);
      if (numMatch && parseInt(numMatch[1], 10) >= 20) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Analyze visual sections and calculate summary metrics
 */
function analyzeVisualSections(
  rootNodes: EnhancedRawDOMNode[]
): { visualSectionCount: number; maxVisualDepth: number } {
  let visualSectionCount = 0;
  let maxVisualDepth = 0;

  function traverse(node: EnhancedRawDOMNode): void {
    if (node.visualMeta.isSectionCandidate) {
      visualSectionCount++;
    }
    if (node.depth > maxVisualDepth) {
      maxVisualDepth = node.depth;
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const node of rootNodes) {
    traverse(node);
  }

  return { visualSectionCount, maxVisualDepth };
}

// ============ Image Mock Detection ============

/**
 * Detect if an image requires a mock placeholder
 */
function detectImageMock(
  src: string | null,
  baseUrl: string
): { url: string; mockRequired: boolean; srcType: EnhancedImageInfo['srcType'] } {
  if (!src || src.trim() === '') {
    return { url: '', mockRequired: true, srcType: 'missing' };
  }

  const trimmedSrc = src.trim();

  // Data URI
  if (trimmedSrc.startsWith('data:')) {
    return { url: trimmedSrc, mockRequired: false, srcType: 'data-uri' };
  }

  // HTTP/HTTPS
  if (trimmedSrc.startsWith('http://') || trimmedSrc.startsWith('https://')) {
    return { url: trimmedSrc, mockRequired: false, srcType: 'http' };
  }

  // Protocol-relative URL
  if (trimmedSrc.startsWith('//')) {
    return { url: 'https:' + trimmedSrc, mockRequired: false, srcType: 'http' };
  }

  // Try to resolve relative URL
  try {
    const resolved = new URL(trimmedSrc, baseUrl).toString();
    if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
      return { url: resolved, mockRequired: false, srcType: 'http' };
    }
  } catch {
    // URL resolution failed
  }

  // Non-resolvable relative URL - requires mock
  return { url: trimmedSrc, mockRequired: true, srcType: 'relative' };
}

/**
 * Extract images from a single node with mock detection
 */
function extractNodeImagesEnhanced(
  element: Element,
  baseUrl: string,
  tag: string
): EnhancedImageInfo[] {
  const images: EnhancedImageInfo[] = [];

  // Check if element itself is an img
  if (tag === 'img') {
    const src = element.getAttribute('src') || element.getAttribute('data-src');
    const { url, mockRequired, srcType } = detectImageMock(src, baseUrl);
    if (url || mockRequired) {
      images.push({
        url,
        alt: (element as HTMLImageElement).alt || undefined,
        mockRequired,
        srcType,
      });
    }
  }

  // Extract direct child images
  const directImgs = element.querySelectorAll(':scope > img');
  directImgs.forEach(img => {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    const { url, mockRequired, srcType } = detectImageMock(src, baseUrl);
    if (url || mockRequired) {
      // Avoid duplicates
      if (!images.find(existing => existing.url === url)) {
        images.push({
          url,
          alt: (img as HTMLImageElement).alt || undefined,
          mockRequired,
          srcType,
        });
      }
    }
  });

  return images;
}

/**
 * Extract background images from CSS with mock detection
 */
function extractBackgroundImagesEnhanced(
  extractedClasses: CSSClassInfo[],
  baseUrl: string
): EnhancedImageInfo[] {
  const bgImages: EnhancedImageInfo[] = [];

  for (const cssClass of extractedClasses) {
    const bgImageProp = cssClass.properties['background-image'] || cssClass.properties['background'];

    if (bgImageProp && bgImageProp.includes('url(')) {
      const urlMatch = bgImageProp.match(/url\(['"]?([^'"()]+)['"]?\)/);
      if (urlMatch) {
        const { url, mockRequired, srcType } = detectImageMock(urlMatch[1], baseUrl);
        if (url || mockRequired) {
          bgImages.push({
            url,
            alt: `Background image from .${cssClass.className}`,
            mockRequired,
            srcType,
          });
        }
      }
    }
  }

  return bgImages;
}

// ============ CSS Normalization ============

/**
 * Build shared CSS map for deduplication
 * Only includes CSS patterns used 3+ times
 */
function buildSharedCSSMap(
  rootNodes: EnhancedRawDOMNode[]
): Record<string, Record<string, string>> {
  // Collect all CSS property sets and their counts
  const cssHashMap = new Map<string, { properties: Record<string, string>; count: number }>();

  function collectCSS(node: EnhancedRawDOMNode): void {
    if (Object.keys(node.cssProperties).length > 0) {
      const hash = hashCSSProperties(node.cssProperties);
      const existing = cssHashMap.get(hash);
      if (existing) {
        existing.count++;
      } else {
        cssHashMap.set(hash, { properties: { ...node.cssProperties }, count: 1 });
      }
    }
    for (const child of node.children) {
      collectCSS(child);
    }
  }

  for (const node of rootNodes) {
    collectCSS(node);
  }

  // Build shared map (only patterns used 3+ times)
  const sharedMap: Record<string, Record<string, string>> = {};
  const hashToRef = new Map<string, string>();
  let refId = 1;

  cssHashMap.forEach(({ properties, count }, hash) => {
    if (count >= CSS_DEDUP_MIN_OCCURRENCES) {
      const refKey = `css-${refId++}`;
      sharedMap[refKey] = properties;
      hashToRef.set(hash, refKey);
    }
  });

  // Apply references to nodes
  function applyRefs(node: EnhancedRawDOMNode): void {
    if (Object.keys(node.cssProperties).length > 0) {
      const hash = hashCSSProperties(node.cssProperties);
      const ref = hashToRef.get(hash);
      if (ref) {
        node.cssRef = ref;
        node.cssProperties = {}; // Clear to save tokens
      }
    }
    for (const child of node.children) {
      applyRefs(child);
    }
  }

  for (const node of rootNodes) {
    applyRefs(node);
  }

  return sharedMap;
}

/**
 * Hash CSS properties for deduplication
 */
function hashCSSProperties(properties: Record<string, string>): string {
  const sortedEntries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(sortedEntries);
}

// ============ Utility Extractors (from parser.ts) ============

function extractNavigation(document: Document): NavItem[] {
  const navItems: NavItem[] = [];
  const nav = document.querySelector('nav') || document.querySelector('header nav');

  if (!nav) {
    const header = document.querySelector('header');
    if (header) {
      const links = header.querySelectorAll('a');
      links.forEach(link => {
        const text = link.textContent?.trim() || '';
        if (text && text.length < 50) {
          navItems.push({
            text,
            href: link.getAttribute('href') || undefined,
            isButton: link.classList.contains('btn') || link.classList.contains('button'),
            children: [],
          });
        }
      });
    }
    return navItems;
  }

  const topLevelItems = nav.querySelectorAll(':scope > ul > li, :scope > a, :scope > div > a');
  topLevelItems.forEach(item => {
    if (item.tagName === 'A') {
      const link = item as HTMLAnchorElement;
      navItems.push({
        text: link.textContent?.trim() || '',
        href: link.getAttribute('href') || undefined,
        isButton: link.classList.contains('btn') || link.classList.contains('button'),
        children: [],
      });
    } else if (item.tagName === 'LI') {
      const link = item.querySelector('a');
      const subMenu = item.querySelector('ul');
      const children: NavItem[] = [];

      if (subMenu) {
        subMenu.querySelectorAll('li > a').forEach(subLink => {
          children.push({
            text: subLink.textContent?.trim() || '',
            href: (subLink as HTMLAnchorElement).getAttribute('href') || undefined,
            isButton: false,
            children: [],
          });
        });
      }

      navItems.push({
        text: link?.textContent?.trim() || item.textContent?.trim().split('\n')[0] || '',
        href: link?.getAttribute('href') || undefined,
        isButton: link?.classList.contains('btn') || link?.classList.contains('button') || false,
        children,
      });
    }
  });

  return navItems;
}

function extractForms(document: Document): FormInfo[] {
  const forms: FormInfo[] = [];
  const formElements = document.querySelectorAll('form');

  formElements.forEach(form => {
    const fields: FormField[] = [];

    form.querySelectorAll('input, select, textarea').forEach(input => {
      const inputEl = input as HTMLInputElement;
      const type = inputEl.type || inputEl.tagName.toLowerCase();

      if (type === 'hidden' || type === 'submit') return;

      let label: string | undefined;
      const id = inputEl.id;
      if (id) {
        const labelEl = document.querySelector(`label[for="${id}"]`);
        label = labelEl?.textContent?.trim();
      }
      if (!label) {
        const parentLabel = inputEl.closest('label');
        if (parentLabel) {
          label = parentLabel.textContent?.replace(inputEl.value || '', '').trim();
        }
      }

      let options: string[] | undefined;
      if (inputEl.tagName === 'SELECT') {
        options = Array.from((input as HTMLSelectElement).options).map(opt => opt.text);
      }

      fields.push({
        name: inputEl.name || inputEl.id || '',
        type: type === 'textarea' ? 'textarea' : type,
        label,
        placeholder: inputEl.placeholder || undefined,
        required: inputEl.required || inputEl.hasAttribute('required'),
        options,
      });
    });

    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    const submitButtonText = submitBtn?.textContent?.trim() || (submitBtn as HTMLInputElement)?.value;

    forms.push({
      id: form.id || undefined,
      action: form.action || undefined,
      method: form.method || 'GET',
      fields,
      submitButtonText,
    });
  });

  return forms;
}

function extractColors(document: Document): ColorInfo[] {
  const colorMap = new Map<string, { property: string; count: number }>();

  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    const style = el.getAttribute('style');
    if (!style) return;

    const colorProps = ['background-color', 'background', 'color', 'border-color'];
    colorProps.forEach(prop => {
      const regex = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i');
      const match = style.match(regex);
      if (match) {
        const value = match[1].trim();
        if (value.match(/^#|^rgb/i)) {
          const key = `${value}|${prop}`;
          const existing = colorMap.get(key);
          if (existing) {
            existing.count++;
          } else {
            colorMap.set(key, { property: prop, count: 1 });
          }
        }
      }
    });
  });

  const colors: ColorInfo[] = [];
  colorMap.forEach((data, key) => {
    const [value] = key.split('|');
    colors.push({
      value,
      property: data.property,
      frequency: data.count,
    });
  });

  return colors.sort((a, b) => b.frequency - a.frequency);
}

function extractCTAs(document: Document): CTAInfo[] {
  const ctas: CTAInfo[] = [];
  const buttonLike = document.querySelectorAll('button, a.btn, a.button, a[class*="btn"], a[class*="button"], input[type="submit"]');

  buttonLike.forEach(el => {
    const text = el.textContent?.trim().toLowerCase() || (el as HTMLInputElement).value?.toLowerCase() || '';
    if (!text) return;

    const isPrimary = CTA_KEYWORDS.some(kw => text.includes(kw)) ||
      el.classList.contains('primary') ||
      el.classList.contains('btn-primary') ||
      el.classList.contains('cta');

    let location = 'section';
    if (el.closest('header') || el.closest('nav')) location = 'header';
    else if (el.closest('footer')) location = 'footer';
    else if (el.closest('.hero') || el.closest('[class*="hero"]') || el.closest('#hero')) location = 'hero';

    ctas.push({
      text: el.textContent?.trim() || (el as HTMLInputElement).value || '',
      href: (el as HTMLAnchorElement).href || undefined,
      type: isPrimary ? 'primary' : el.tagName === 'A' ? 'link' : 'secondary',
      location,
    });
  });

  return ctas;
}

function extractFooter(document: Document): FooterInfo | null {
  const footer = document.querySelector('footer');
  if (!footer) return null;

  const columns: FooterColumn[] = [];
  const possibleColumns = footer.querySelectorAll('div > div, section, ul');
  possibleColumns.forEach(col => {
    const heading = col.querySelector('h3, h4, h5, h6, strong');
    const links = col.querySelectorAll('a');

    if (links.length > 0) {
      columns.push({
        heading: heading?.textContent?.trim(),
        links: Array.from(links).map(link => ({
          text: link.textContent?.trim() || '',
          href: (link as HTMLAnchorElement).href || undefined,
        })),
      });
    }
  });

  const copyrightMatch = footer.textContent?.match(/©\s*\d{4}[^.]*|copyright[^.]+/i);
  const copyright = copyrightMatch?.[0]?.trim();
  const socialLinks = extractSocialLinks(footer as unknown as Document);

  return {
    columns,
    copyright,
    socialLinks,
  };
}

function extractSocialLinks(container: Document | Element): SocialLink[] {
  const socialLinks: SocialLink[] = [];
  const links = container.querySelectorAll('a[href]');

  links.forEach(link => {
    const href = (link as HTMLAnchorElement).href;
    if (!href) return;

    for (const { pattern, platform } of SOCIAL_PATTERNS) {
      if (pattern.test(href)) {
        if (!socialLinks.find(sl => sl.url === href)) {
          socialLinks.push({ platform, url: href });
        }
        break;
      }
    }
  });

  return socialLinks;
}

function extractMetadata(document: Document): PageMetadata {
  const title = document.querySelector('title')?.textContent?.trim();
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || undefined;

  const ogTags: Record<string, string> = {};
  document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
    const property = meta.getAttribute('property')?.replace('og:', '');
    const content = meta.getAttribute('content');
    if (property && content) {
      ogTags[property] = content;
    }
  });

  const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')?.getAttribute('href') || undefined;

  return {
    title,
    description,
    ogTags,
    favicon,
  };
}

function detectLanguage(document: Document): string {
  const htmlLang = document.documentElement.getAttribute('lang');
  if (htmlLang) return htmlLang.split('-')[0];

  const metaLang = document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content');
  if (metaLang) return metaLang.split('-')[0];

  return 'en';
}

function getRawTextContent(document: Document): string {
  const body = document.body;
  if (!body) return '';
  return body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 5000) || '';
}

// ============ Export ============

export const enhancedParser = {
  parse: parseHtmlEnhanced,
};
