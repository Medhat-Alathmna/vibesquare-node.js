/**
 * Visual Parser - Complete Redesign
 *
 * Builds visualTree from HTML by inferring VISUAL hierarchy, not DOM hierarchy.
 * Collapses meaningless wrappers, infers roles from CSS, groups by visual behavior.
 */

import { JSDOM } from 'jsdom';
import {
  VisualParsedDOM,
  VisualNode,
  VisualRole,
  LayoutIntent,
  CSSSignals,
  ImageAsset,
  FormAsset,
  Ambiguity,
  VisualIdentity,
  CSSClassInfo,
} from './ir.types';
import { NormalizationResult } from './normalizer';
import { ApiError } from '../../../shared/utils/ApiError';
import httpStatus from 'http-status';

// ============ Constants ============

const MIN_BODY_LENGTH = 100;
const MAX_TEXT_LENGTH = 200;  // Truncate text content
const MAX_COLORS = 3;

// ============ Internal Types ============

interface RawNode {
  element: Element;
  tag: string;
  id?: string;
  className?: string;
  css: Record<string, string>;
  text: string;
  children: RawNode[];
  depth: number;
  order: number;
  images: { src: string; alt?: string }[];
}

interface ParserContext {
  extractedClasses: CSSClassInfo[];
  baseUrl: string;
  orderCounter: { value: number };
  images: ImageAsset[];
  forms: FormAsset[];
  ambiguities: Ambiguity[];
  colors: Map<string, number>;
}

// ============ Main Parser ============

export function parseVisualDOM(
  normalizedResult: NormalizationResult,
  originalUrl: string
): VisualParsedDOM {
  const dom = new JSDOM(normalizedResult.html);
  const document = dom.window.document;

  // Validate content
  const bodyText = document.body?.textContent?.trim() || '';
  if (bodyText.length < MIN_BODY_LENGTH && !hasStructuralContent(document)) {
    throw new ApiError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'Page requires JavaScript or has no content.'
    );
  }

  // Initialize context
  const context: ParserContext = {
    extractedClasses: normalizedResult.extractedCSS.classes,
    baseUrl: originalUrl,
    orderCounter: { value: 0 },
    images: [],
    forms: [],
    ambiguities: [],
    colors: new Map(),
  };

  // Step 1: Build raw node tree
  const rawNodes = buildRawTree(document.body, context, 0);

  // Step 2: Collapse meaningless wrappers
  const collapsedNodes = rawNodes.map(n => collapseWrapper(n));

  // Step 3: Build visual tree with role inference
  const visualTree = collapsedNodes
    .map((n, i) => buildVisualNode(n, context, `v-${i}`, 0))
    .filter((n): n is VisualNode => n !== null);

  // Step 4: Extract forms
  extractForms(document, context);

  // Step 5: Infer visual identity
  const visualIdentity = inferVisualIdentity(context);

  // Step 6: Detect ambiguities
  detectAmbiguities(visualTree, context);

  return {
    meta: {
      sourceUrl: originalUrl,
      title: document.title || '',
      language: document.documentElement.lang || 'en',
    },
    visualTree,
    assets: {
      images: context.images,
      forms: context.forms,
    },
    designSignals: {
      visualIdentity,
      ambiguities: context.ambiguities,
    },
  };
}

// ============ Raw Tree Builder ============

function buildRawTree(
  parent: Element,
  context: ParserContext,
  depth: number
): RawNode[] {
  const nodes: RawNode[] = [];

  for (const child of Array.from(parent.children)) {
    const tag = child.tagName.toLowerCase();

    // Skip non-visual elements
    if (shouldSkipElement(tag)) continue;

    const css = extractCSS(child, context.extractedClasses);
    const text = getDirectText(child);
    const images = extractDirectImages(child, context.baseUrl);

    // Track colors
    trackColors(css, context);

    const rawNode: RawNode = {
      element: child,
      tag,
      id: child.id || undefined,
      className: child.className || undefined,
      css,
      text,
      children: buildRawTree(child, context, depth + 1),
      depth,
      order: context.orderCounter.value++,
      images,
    };

    nodes.push(rawNode);
  }

  return nodes;
}

// ============ Wrapper Collapsing ============

/**
 * Collapse meaningless wrapper nodes
 * A wrapper is meaningless if:
 * - It has no visual CSS (background, border, shadow, etc.)
 * - It has exactly one child
 * - It adds no layout behavior
 */
function collapseWrapper(node: RawNode): RawNode {
  // First, recursively collapse children
  const collapsedChildren = node.children.map(c => collapseWrapper(c));
  node.children = collapsedChildren;

  // Check if this node is a meaningless wrapper
  if (isMeaninglessWrapper(node)) {
    // Promote the single child
    if (node.children.length === 1) {
      const child = node.children[0];
      // Merge any text content
      if (node.text && !child.text) {
        child.text = node.text;
      }
      return child;
    }
  }

  return node;
}

function isMeaninglessWrapper(node: RawNode): boolean {
  // Must have exactly one child
  if (node.children.length !== 1) return false;

  // Must be a div or span (common wrappers)
  if (node.tag !== 'div' && node.tag !== 'span') return false;

  // Check for visual CSS that makes it meaningful
  const css = node.css;

  // Has background?
  if (css['background'] || css['background-color'] || css['background-image']) {
    const bg = css['background-color'] || css['background'];
    if (bg && bg !== 'transparent' && bg !== 'inherit' && bg !== 'none') {
      return false;
    }
  }

  // Has border?
  if (css['border'] || css['border-width']) {
    if (css['border'] && css['border'] !== 'none' && css['border'] !== '0') {
      return false;
    }
  }

  // Has shadow?
  if (css['box-shadow'] && css['box-shadow'] !== 'none') {
    return false;
  }

  // Has padding/margin that creates visual separation?
  const padding = parseSpacing(css['padding']);
  const margin = parseSpacing(css['margin']);
  if (padding > 20 || margin > 20) {
    return false;
  }

  // Is a layout container?
  const display = css['display'];
  if (display === 'flex' || display === 'grid') {
    // Check if it actually changes layout
    const childCount = node.children.length;
    if (childCount > 1) return false;  // Layout matters with multiple children
  }

  return true;
}

function parseSpacing(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ============ Visual Node Builder ============

function buildVisualNode(
  raw: RawNode,
  context: ParserContext,
  id: string,
  visualDepth: number
): VisualNode | null {
  // Skip if node has no content and no meaningful children
  if (!hasVisualContent(raw)) {
    return null;
  }

  // Infer role
  const role = inferRole(raw, visualDepth);

  // Infer layout intent
  const layoutIntent = inferLayoutIntent(raw);

  // Extract CSS signals
  const cssSignals = extractCSSSignals(raw.css, context);

  // Generate visual purpose
  const visualPurpose = generateVisualPurpose(raw, role, layoutIntent);

  // Extract images as assets
  extractImageAssets(raw, id, context);

  // Build children
  const children: VisualNode[] = [];
  raw.children.forEach((child, i) => {
    const childNode = buildVisualNode(child, context, `${id}-${i}`, visualDepth + 1);
    if (childNode) {
      children.push(childNode);
    }
  });

  // Determine if container
  const isContainer = children.length > 0;

  // Get text content (truncated)
  const textContent = raw.text.length > 0
    ? raw.text.slice(0, MAX_TEXT_LENGTH) + (raw.text.length > MAX_TEXT_LENGTH ? '...' : '')
    : undefined;

  return {
    id,
    role,
    tag: raw.tag,
    order: raw.order,
    depth: visualDepth,
    layoutIntent,
    isContainer,
    visualPurpose,
    textContent,
    cssSignals,
    children,
  };
}

// ============ Role Inference ============

function inferRole(node: RawNode, depth: number): VisualRole {
  const tag = node.tag;
  const css = node.css;
  const className = (node.className || '').toLowerCase();
  const id = (node.id || '').toLowerCase();

  // Check semantic tags first
  if (tag === 'header') return 'header';
  if (tag === 'footer') return 'footer';
  if (tag === 'nav') return 'nav';
  if (tag === 'main') return 'section';
  if (tag === 'article') return 'content';
  if (tag === 'aside') return 'section';

  // Check class/id hints
  if (containsHint(className, id, ['header', 'masthead', 'top-bar'])) return 'header';
  if (containsHint(className, id, ['footer', 'bottom'])) return 'footer';
  if (containsHint(className, id, ['nav', 'menu', 'navigation'])) return 'nav';
  if (containsHint(className, id, ['hero', 'banner', 'jumbotron', 'splash'])) return 'hero';
  if (containsHint(className, id, ['card', 'tile', 'item', 'feature'])) return 'card';

  // Check CSS for role hints
  const position = css['position'];
  if (position === 'fixed' || position === 'sticky') {
    // Fixed/sticky at top is likely header
    if (depth === 0 || css['top'] === '0' || css['top'] === '0px') {
      return 'header';
    }
  }

  // Check if it's a layout container
  const display = css['display'];
  if (display === 'flex' || display === 'grid') {
    if (node.children.length > 0 && !hasDirectMeaningfulContent(node)) {
      return 'layout';
    }
  }

  // Check for hero-like characteristics
  if (depth <= 1) {
    const height = css['height'] || css['min-height'];
    if (height && (height.includes('vh') || parseSpacing(height) > 400)) {
      return 'hero';
    }
    // Large background image at top
    if (css['background-image'] && css['background-size'] === 'cover') {
      return 'hero';
    }
  }

  // Check for content block
  if (hasDirectMeaningfulContent(node) && node.children.length === 0) {
    return 'content';
  }

  // Check for section-like characteristics
  if (node.children.length > 0) {
    const bg = css['background'] || css['background-color'];
    if (bg && bg !== 'transparent' && bg !== 'inherit') {
      return 'section';
    }
    const padding = parseSpacing(css['padding']) + parseSpacing(css['padding-top']) + parseSpacing(css['padding-bottom']);
    if (padding > 30) {
      return 'section';
    }
  }

  // Default based on depth
  if (depth === 0) return 'section';

  return 'unknown';
}

function containsHint(className: string, id: string, hints: string[]): boolean {
  return hints.some(hint => className.includes(hint) || id.includes(hint));
}

function hasDirectMeaningfulContent(node: RawNode): boolean {
  // Has meaningful text?
  if (node.text.length > 20) return true;

  // Has images?
  if (node.images.length > 0) return true;

  return false;
}

// ============ Layout Intent Inference ============

function inferLayoutIntent(node: RawNode): LayoutIntent {
  const css = node.css;
  const display = css['display'];

  if (display === 'grid') return 'grid';

  if (display === 'flex') {
    const direction = css['flex-direction'] || 'row';
    return direction.includes('column') ? 'column' : 'row';
  }

  // Check for absolute/fixed positioning (overlay)
  const position = css['position'];
  if (position === 'absolute' || position === 'fixed') {
    return 'overlay';
  }

  // Check for stacking (z-index)
  const zIndex = parseInt(css['z-index'] || '0', 10);
  if (zIndex > 10) return 'stack';

  // Default to column for block elements
  if (display === 'block' || !display) {
    if (node.children.length > 0) return 'column';
  }

  return 'unknown';
}

// ============ CSS Signal Extraction ============

function extractCSSSignals(css: Record<string, string>, context: ParserContext): CSSSignals {
  // Position
  const rawPosition = css['position'] || 'static';
  let position: CSSSignals['position'] = 'static';
  if (rawPosition === 'fixed') position = 'fixed';
  else if (rawPosition === 'sticky') position = 'sticky';
  else if (rawPosition === 'absolute') position = 'absolute';

  // Layout
  const display = css['display'] || 'block';
  let layout: CSSSignals['layout'] = 'block';
  if (display === 'flex' || display === 'inline-flex') layout = 'flex';
  else if (display === 'grid' || display === 'inline-grid') layout = 'grid';

  // Dominant colors (from this element)
  const dominantColors: string[] = [];
  const bg = css['background-color'] || extractColorFromBackground(css['background']);
  const color = css['color'];
  const borderColor = css['border-color'];

  if (bg && isValidColor(bg)) dominantColors.push(normalizeColor(bg));
  if (color && isValidColor(color)) dominantColors.push(normalizeColor(color));
  if (borderColor && isValidColor(borderColor)) dominantColors.push(normalizeColor(borderColor));

  // Emphasis
  const emphasis: CSSSignals['emphasis'] = [];
  if (css['background'] || css['background-color'] || css['background-image']) {
    const bgVal = css['background-color'] || css['background'];
    if (bgVal && bgVal !== 'transparent' && bgVal !== 'inherit') {
      emphasis.push('background');
    }
  }
  if (css['box-shadow'] && css['box-shadow'] !== 'none') {
    emphasis.push('shadow');
  }
  if (css['backdrop-filter'] || css['filter']) {
    if ((css['backdrop-filter'] || css['filter']).includes('blur')) {
      emphasis.push('blur');
    }
  }
  if (css['border'] && css['border'] !== 'none' && css['border'] !== '0') {
    emphasis.push('border');
  }

  return {
    position,
    layout,
    dominantColors: dominantColors.slice(0, MAX_COLORS),
    emphasis,
  };
}

function extractColorFromBackground(bg: string | undefined): string | undefined {
  if (!bg) return undefined;
  // Try to extract color from background shorthand
  const hexMatch = bg.match(/#[0-9a-fA-F]{3,8}/);
  if (hexMatch) return hexMatch[0];
  const rgbMatch = bg.match(/rgba?\([^)]+\)/);
  if (rgbMatch) return rgbMatch[0];
  return undefined;
}

function isValidColor(value: string): boolean {
  if (!value) return false;
  if (value === 'transparent' || value === 'inherit' || value === 'initial') return false;
  return value.startsWith('#') || value.startsWith('rgb');
}

function normalizeColor(color: string): string {
  // Return as-is for hex
  if (color.startsWith('#')) return color.toLowerCase();
  // Convert rgb to hex (simplified)
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return color;
}

// ============ Visual Purpose Generator ============

function generateVisualPurpose(node: RawNode, role: VisualRole, layout: LayoutIntent): string {
  const parts: string[] = [];

  // Role-based description
  switch (role) {
    case 'header':
      parts.push('Site header with branding/navigation');
      break;
    case 'hero':
      parts.push('Hero section with prominent visual impact');
      break;
    case 'footer':
      parts.push('Site footer with links and information');
      break;
    case 'nav':
      parts.push('Navigation menu');
      break;
    case 'card':
      parts.push('Card component');
      break;
    case 'layout':
      parts.push(`Layout container arranging children in ${layout}`);
      break;
    case 'content':
      parts.push('Content block');
      break;
    case 'section':
      parts.push('Visual section grouping related content');
      break;
    default:
      parts.push('Visual element');
  }

  // Add child count if container
  if (node.children.length > 0) {
    parts.push(`(${node.children.length} children)`);
  }

  // Add layout info
  if (layout !== 'unknown' && role !== 'layout') {
    parts.push(`[${layout} layout]`);
  }

  return parts.join(' ');
}

// ============ Asset Extraction ============

function extractImageAssets(node: RawNode, nodeId: string, context: ParserContext): void {
  for (const img of node.images) {
    const asset = createImageAsset(img, nodeId, context);
    context.images.push(asset);
  }
}

function createImageAsset(
  img: { src: string; alt?: string },
  parentNodeId: string,
  context: ParserContext
): ImageAsset {
  const id = `img-${context.images.length}`;

  // Determine source type
  let source: ImageAsset['source'] = 'missing';
  let url: string | undefined;

  if (!img.src || img.src.trim() === '') {
    source = 'missing';
  } else if (img.src.startsWith('http://') || img.src.startsWith('https://')) {
    source = 'http';
    url = img.src;
  } else if (img.src.startsWith('data:')) {
    source = 'local';
  } else {
    // Try to resolve
    try {
      const resolved = new URL(img.src, context.baseUrl).toString();
      if (resolved.startsWith('http')) {
        source = 'http';
        url = resolved;
      } else {
        source = 'local';
      }
    } catch {
      source = 'local';
    }
  }

  // Infer context from parent node and alt text
  const contextHint = inferImageContext(img, parentNodeId);

  // Generate hint
  const hint = img.alt || generateImageHint(contextHint, source);

  return {
    id,
    context: contextHint,
    source,
    url,
    hint,
    parentNodeId,
  };
}

function inferImageContext(
  img: { src: string; alt?: string },
  parentNodeId: string
): ImageAsset['context'] {
  const alt = (img.alt || '').toLowerCase();
  const src = (img.src || '').toLowerCase();

  // Check alt text hints
  if (alt.includes('logo')) return 'logo';
  if (alt.includes('avatar') || alt.includes('profile')) return 'avatar';
  if (alt.includes('icon')) return 'icon';
  if (alt.includes('hero') || alt.includes('banner')) return 'hero';

  // Check src hints
  if (src.includes('logo')) return 'logo';
  if (src.includes('avatar')) return 'avatar';
  if (src.includes('icon') || src.includes('svg')) return 'icon';
  if (src.includes('hero') || src.includes('banner')) return 'hero';
  if (src.includes('bg') || src.includes('background')) return 'background';

  // Check parent context
  if (parentNodeId.includes('v-0')) return 'hero';  // First major section

  return 'unknown';
}

function generateImageHint(context: ImageAsset['context'], source: ImageAsset['source']): string {
  if (source === 'http') return `Image (${context})`;

  switch (context) {
    case 'hero': return 'Hero illustration or banner image';
    case 'card': return 'Card thumbnail or preview image';
    case 'background': return 'Background texture or pattern';
    case 'icon': return 'Icon graphic';
    case 'avatar': return 'User avatar or profile picture';
    case 'logo': return 'Brand logo';
    default: return 'Placeholder image needed';
  }
}

function extractForms(document: Document, context: ParserContext): void {
  const formElements = document.querySelectorAll('form');

  formElements.forEach((form, i) => {
    const inputs = form.querySelectorAll('input, select, textarea');
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');

    // Infer purpose
    const purpose = inferFormPurpose(form, inputs);

    context.forms.push({
      id: `form-${i}`,
      purpose,
      fieldCount: inputs.length,
      hasSubmit: !!submitBtn,
    });
  });
}

function inferFormPurpose(
  form: Element,
  inputs: NodeListOf<Element>
): FormAsset['purpose'] {
  const action = form.getAttribute('action') || '';
  const className = (form.className || '').toLowerCase();
  const inputTypes = Array.from(inputs).map(i => i.getAttribute('type') || 'text');
  const inputNames = Array.from(inputs).map(i => (i.getAttribute('name') || '').toLowerCase());

  // Check for login
  if (inputNames.some(n => n.includes('password')) && inputNames.some(n => n.includes('email') || n.includes('user'))) {
    return 'login';
  }

  // Check for newsletter
  if (inputNames.length === 1 && inputNames[0].includes('email')) {
    return 'newsletter';
  }

  // Check for search
  if (inputTypes.includes('search') || className.includes('search') || action.includes('search')) {
    return 'search';
  }

  // Check for contact
  if (inputNames.some(n => n.includes('message') || n.includes('subject'))) {
    return 'contact';
  }

  // Check for checkout
  if (inputNames.some(n => n.includes('card') || n.includes('payment'))) {
    return 'checkout';
  }

  return 'unknown';
}

// ============ Visual Identity Inference ============

function inferVisualIdentity(context: ParserContext): VisualIdentity {
  // Get top colors
  const sortedColors = Array.from(context.colors.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Infer tone from colors
  let tone: VisualIdentity['tone'] = 'unknown';

  if (sortedColors.length > 0) {
    // Check for dark/corporate
    const hasDarkColors = sortedColors.some(([c]) => isDarkColor(c));
    const hasBrightColors = sortedColors.some(([c]) => isBrightColor(c));

    if (hasDarkColors && !hasBrightColors) {
      tone = 'corporate';
    } else if (hasBrightColors) {
      tone = 'modern';
    }
  }

  // Infer density (simplified)
  const density: VisualIdentity['density'] = 'balanced';

  // Infer contrast
  const contrast: VisualIdentity['contrast'] = 'medium';

  return { tone, density, contrast };
}

function isDarkColor(hex: string): boolean {
  if (!hex.startsWith('#')) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance < 80;
}

function isBrightColor(hex: string): boolean {
  if (!hex.startsWith('#')) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Check if color is saturated and bright
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  return saturation > 0.5 && max > 150;
}

// ============ Ambiguity Detection ============

function detectAmbiguities(visualTree: VisualNode[], context: ParserContext): void {
  traverseVisualTree(visualTree, (node) => {
    // Check for position ambiguity
    if (node.cssSignals.position === 'fixed' || node.cssSignals.position === 'sticky') {
      if (node.role === 'header' || node.role === 'nav') {
        context.ambiguities.push({
          nodeId: node.id,
          questionForUser: `Should the ${node.role} remain fixed/sticky when scrolling?`,
          reason: `CSS indicates ${node.cssSignals.position} positioning but scroll behavior should be confirmed.`,
        });
      }
    }

    // Check for unknown roles
    if (node.role === 'unknown' && node.isContainer && node.children.length > 2) {
      context.ambiguities.push({
        nodeId: node.id,
        questionForUser: 'What is the purpose of this section?',
        reason: 'Could not infer visual role from CSS or structure.',
      });
    }
  });
}

function traverseVisualTree(nodes: VisualNode[], callback: (node: VisualNode) => void): void {
  for (const node of nodes) {
    callback(node);
    traverseVisualTree(node.children, callback);
  }
}

// ============ Helper Functions ============

function hasStructuralContent(document: Document): boolean {
  return !!(
    document.querySelector('header') ||
    document.querySelector('main') ||
    document.querySelector('section') ||
    document.querySelector('nav') ||
    document.querySelector('footer') ||
    document.querySelector('article') ||
    document.querySelector('div')
  );
}

function shouldSkipElement(tag: string): boolean {
  const skipTags = ['script', 'style', 'noscript', 'meta', 'link', 'head', 'title', 'br', 'hr'];
  return skipTags.includes(tag);
}

function extractCSS(element: Element, extractedClasses: CSSClassInfo[]): Record<string, string> {
  const merged: Record<string, string> = {};
  const className = element.className || '';

  // From classes
  if (className && typeof className === 'string') {
    const classNames = className.trim().split(/\s+/).filter(n => n);
    for (const name of classNames) {
      const matches = extractedClasses.filter(
        c => c.className.toLowerCase() === name.toLowerCase()
      );
      for (const match of matches) {
        Object.assign(merged, match.properties);
      }
    }
  }

  // From inline style
  const inline = element.getAttribute('style');
  if (inline) {
    for (const rule of inline.split(';')) {
      const [prop, ...vals] = rule.split(':');
      if (prop && vals.length) {
        merged[prop.trim().toLowerCase()] = vals.join(':').trim();
      }
    }
  }

  return merged;
}

function getDirectText(element: Element): string {
  let text = '';
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) { // Text node
      text += node.textContent || '';
    }
  }
  return text.trim().replace(/\s+/g, ' ');
}

function extractDirectImages(element: Element, baseUrl: string): { src: string; alt?: string }[] {
  const images: { src: string; alt?: string }[] = [];
  const tag = element.tagName.toLowerCase();

  // Check if element itself is an img
  if (tag === 'img') {
    const src = element.getAttribute('src') || element.getAttribute('data-src') || '';
    images.push({ src, alt: (element as HTMLImageElement).alt || undefined });
  }

  // Check direct child images
  const directImgs = element.querySelectorAll(':scope > img');
  directImgs.forEach(img => {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    images.push({ src, alt: (img as HTMLImageElement).alt || undefined });
  });

  return images;
}

function trackColors(css: Record<string, string>, context: ParserContext): void {
  const colorProps = ['background-color', 'color', 'border-color'];
  for (const prop of colorProps) {
    const value = css[prop];
    if (value && isValidColor(value)) {
      const normalized = normalizeColor(value);
      context.colors.set(normalized, (context.colors.get(normalized) || 0) + 1);
    }
  }
}

function hasVisualContent(node: RawNode): boolean {
  // Has text?
  if (node.text.length > 0) return true;

  // Has images?
  if (node.images.length > 0) return true;

  // Has meaningful children?
  if (node.children.some(c => hasVisualContent(c))) return true;

  // Has visual CSS?
  const css = node.css;
  if (css['background'] || css['background-color'] || css['background-image']) {
    const bg = css['background-color'] || css['background'];
    if (bg && bg !== 'transparent' && bg !== 'inherit') {
      return true;
    }
  }

  return false;
}

// ============ Export ============

export const visualParser = {
  parse: parseVisualDOM,
};
