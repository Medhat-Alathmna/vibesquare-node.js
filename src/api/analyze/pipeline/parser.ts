import { JSDOM } from 'jsdom';
import {
  RawParsedDOM,
  RawDOMNode,
  MAX_DOM_DEPTH,
  NavItem,
  FormInfo,
  FormField,
  ImageInfo,
  ColorInfo,
  CTAInfo,
  FooterInfo,
  FooterColumn,
  SocialLink,
  PageMetadata,
  CSSClassInfo,
} from './ir.types';
import { NormalizationResult } from './normalizer';
import { ApiError } from '../../../shared/utils/ApiError';
import httpStatus from 'http-status';

const MAX_ROOT_NODES = 100;  // Max top-level nodes to process
const MIN_BODY_LENGTH = 100;

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

/**
 * Resolve relative URLs to absolute URLs
 * Handles all relative URL patterns (assets/, ./assets/, ../assets/, /path, etc.)
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (!url || !baseUrl) return url;

  // Already absolute URL (starts with protocol or //)
  if (/^(https?:)?\/\//i.test(url)) {
    return url;
  }

  // Data URLs, blob URLs, etc.
  if (/^(data|blob|mailto):/i.test(url)) {
    return url;
  }

  // Use URL API to properly resolve relative URLs
  try {
    const resolved = new URL(url, baseUrl);
    return resolved.toString();
  } catch (error) {
    // If URL parsing fails, try manual concatenation
    // Remove trailing slash from baseUrl
    const cleanBase = baseUrl.replace(/\/$/, '');

    // If URL starts with /, replace the path completely
    if (url.startsWith('/')) {
      try {
        const baseUrlObj = new URL(cleanBase);
        return `${baseUrlObj.origin}${url}`;
      } catch {
        return `${cleanBase}${url}`;
      }
    }

    // Otherwise, append to base URL
    return `${cleanBase}/${url.replace(/^\.\//, '')}`;
  }
}

/**
 * Parse HTML into RawParsedDOM - Full hierarchical DOM representation
 * NO semantic interpretation - just raw extraction
 */
export function parseHtml(
  normalizedResult: NormalizationResult,
  originalUrl: string
): RawParsedDOM {
  const dom = new JSDOM(normalizedResult.html);
  const document = dom.window.document;

  // Check for JS-only page
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

  // Extract full DOM tree - NO semantic interpretation
  const { rootNodes, totalNodes } = extractDOMTree(
    document.body,
    normalizedResult.extractedCSS.classes,
    originalUrl
  );

  // Extract global data for convenience
  const allImages = extractImages(document, originalUrl);
  const backgroundImages = extractBackgroundImages(
    document,
    normalizedResult.extractedCSS.classes,
    originalUrl
  );

  // Merge images (deduplicate by URL)
  const existingUrls = new Set(allImages.map(img => img.url));
  for (const bgImg of backgroundImages) {
    if (!existingUrls.has(bgImg.url)) {
      allImages.push(bgImg);
    }
  }

  const allForms = extractForms(document);
  const navigation = extractNavigation(document);
  const colors = extractColors(document);
  const fonts = normalizedResult.extractedFonts;
  const socialLinks = extractSocialLinks(document);
  const embeds = normalizedResult.extractedEmbeds;
  const metadata = extractMetadata(document);
  const language = detectLanguage(document);
  const rawTextContent = getRawTextContent(document);

  const rawParsedDOM = {
    rootNodes,
    totalNodes,
    allImages,
    allForms,
    navigation,
    fonts,
    colors,
    embeds,
    ctas: extractCTAs(document),
    footer: null,
    socialLinks,
    metadata,
    language,
    rawTextContent,
    cssInfo: normalizedResult.extractedCSS,
  };

  // Clean the parsed DOM by removing empty properties
  return cleanParsedDOM(rawParsedDOM);
}

/**
 * Extract ALL CSS properties from element
 * Merges: class-based CSS + inline styles
 * NO FILTERING - all properties preserved
 */
function extractAllCSSProperties(
  element: Element,
  extractedClasses: CSSClassInfo[]
): Record<string, string> {
  const mergedProperties: Record<string, string> = {};
  const className = element.className || '';

  // 1. Extract properties from CSS classes (INCLUDING media queries)
  if (className) {
    const classNames = className
      .trim()
      .split(/\s+/)
      .filter(name => name.length > 0);

    for (const name of classNames) {
      // Match ALL classes including media query ones
      const matches = extractedClasses.filter(
        cssClass => cssClass.className.toLowerCase() === name.toLowerCase()
      );

      for (const cssClass of matches) {
        for (const [property, value] of Object.entries(cssClass.properties)) {
          // Later values override earlier ones (CSS specificity simulation)
          mergedProperties[property] = value;
        }
      }
    }
  }

  // 2. Extract inline styles (style="...") - these override class properties
  const inlineStyle = element.getAttribute('style');
  if (inlineStyle) {
    // Parse inline style string
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
 * Extract full DOM tree recursively
 * Preserves complete hierarchy up to MAX_DOM_DEPTH levels
 */
function extractDOMTree(
  body: Element,
  extractedClasses: CSSClassInfo[],
  baseUrl: string
): { rootNodes: RawDOMNode[]; totalNodes: number } {
  const rootNodes: RawDOMNode[] = [];
  const orderCounter = { value: 0 };

  // Process direct children of body
  const children = Array.from(body.children).slice(0, MAX_ROOT_NODES);

  for (const child of children) {
    const node = extractNodeRecursive(
      child as Element,
      orderCounter,
      0, // depth starts at 0
      extractedClasses,
      baseUrl
    );
    rootNodes.push(node);
  }

  return {
    rootNodes,
    totalNodes: orderCounter.value,
  };
}

/**
 * Recursively extract a single DOM node and all its children
 * NO semantic interpretation - just raw data extraction
 */
function extractNodeRecursive(
  element: Element,
  orderCounter: { value: number },
  depth: number,
  extractedClasses: CSSClassInfo[],
  baseUrl: string
): RawDOMNode {
  const currentOrder = orderCounter.value++;
  const tag = element.tagName.toLowerCase();

  // Extract all attributes
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    if (attr.name === 'class') continue;
    attributes[attr.name] = attr.value;
  }

  // Extract CSS properties (classes + inline merged)
  const cssProperties = extractAllCSSProperties(element, extractedClasses);

  // Extract images directly in this element (not nested)
  const images: ImageInfo[] = [];
  const directImgs = element.querySelectorAll(':scope > img');
  directImgs.forEach(img => {
    let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (src) {
      src = resolveUrl(src, baseUrl);
      images.push({
        url: src,
        alt: (img as HTMLImageElement).alt || undefined,
      });
    }
  });

  // Also check if this element itself is an img
  if (tag === 'img') {
    let src = element.getAttribute('src') || element.getAttribute('data-src') || '';
    if (src) {
      src = resolveUrl(src, baseUrl);
      images.push({
        url: src,
        alt: (element as HTMLImageElement).alt || undefined,
      });
    }
  }

  // Recursively process children (respecting depth limit)
  const children: RawDOMNode[] = [];
  const hasChildren = element.children.length > 0;

  if (depth < MAX_DOM_DEPTH) {
    for (const child of Array.from(element.children)) {
      children.push(
        extractNodeRecursive(
          child as Element,
          orderCounter,
          depth + 1,
          extractedClasses,
          baseUrl
        )
      );
    }
  }

  // Get direct text content (not from children)
  let textContent = '';
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 3) { // Text node
      textContent += node.textContent || '';
    }
  }
  textContent = textContent.trim();

  // If no direct text, get full text content
  if (!textContent && element.textContent) {
    textContent = element.textContent.trim();
  }

  return {
    tag,
    order: currentOrder,
    id: element.id || undefined,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    depth,
    isContainer: hasChildren,
    children,
    textContent,
    cssProperties,
    images,
  };
}


/**
 * Extract background images from CSS classes
 * Returns array of ImageInfo for CSS background-image properties
 */
function extractBackgroundImages(
  document: Document,
  extractedClasses: CSSClassInfo[],
  baseUrl: string
): ImageInfo[] {
  const bgImages: ImageInfo[] = [];

  // Search all CSS classes for background-image
  for (const cssClass of extractedClasses) {
    const bgImageProp = cssClass.properties['background-image'] || cssClass.properties['background'];

    if (bgImageProp && bgImageProp.includes('url(')) {
      // Extract URL from url(...) syntax
      const urlMatch = bgImageProp.match(/url\(['"]?([^'"()]+)['"]?\)/);
      if (urlMatch) {
        let url = urlMatch[1];

        // Resolve relative URLs
        url = resolveUrl(url, baseUrl);

        bgImages.push({
          url,
          alt: `Background image from .${cssClass.className}`,
        });
      }
    }
  }

  return bgImages;
}

function extractNavigation(document: Document): NavItem[] {
  const navItems: NavItem[] = [];
  const nav = document.querySelector('nav') || document.querySelector('header nav');

  if (!nav) {
    // Try to find navigation in header
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

  // Extract from nav element
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

    // Extract inputs
    form.querySelectorAll('input, select, textarea').forEach(input => {
      const inputEl = input as HTMLInputElement;
      const type = inputEl.type || inputEl.tagName.toLowerCase();

      // Skip hidden and submit buttons
      if (type === 'hidden' || type === 'submit') return;

      // Find label
      let label: string | undefined;
      const id = inputEl.id;
      if (id) {
        const labelEl = document.querySelector(`label[for="${id}"]`);
        label = labelEl?.textContent?.trim();
      }
      if (!label) {
        // Check for wrapping label
        const parentLabel = inputEl.closest('label');
        if (parentLabel) {
          label = parentLabel.textContent?.replace(inputEl.value || '', '').trim();
        }
      }

      // Extract options for select
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

    // Find submit button
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

function extractImages(document: Document, baseUrl: string): ImageInfo[] {
  const images: ImageInfo[] = [];
  const imgElements = document.querySelectorAll('img');

  imgElements.forEach(img => {
    let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (!src) return;

    // Resolve relative URLs
    src = resolveUrl(src, baseUrl);

    images.push({
      url: src,
      alt: img.alt || undefined,
    });
  });

  return images;
}

function extractColors(document: Document): ColorInfo[] {
  const colorMap = new Map<string, { property: string; count: number }>();

  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    const style = el.getAttribute('style');
    if (!style) return;

    // Extract color properties
    const colorProps = ['background-color', 'background', 'color', 'border-color'];
    colorProps.forEach(prop => {
      const regex = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i');
      const match = style.match(regex);
      if (match) {
        const value = match[1].trim();
        // Only keep hex colors or rgb/rgba
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

  // Sort by frequency
  return colors.sort((a, b) => b.frequency - a.frequency);
}

function extractCTAs(document: Document): CTAInfo[] {
  const ctas: CTAInfo[] = [];

  // Find buttons and button-like links
  const buttonLike = document.querySelectorAll('button, a.btn, a.button, a[class*="btn"], a[class*="button"], input[type="submit"]');

  buttonLike.forEach(el => {
    const text = el.textContent?.trim().toLowerCase() || (el as HTMLInputElement).value?.toLowerCase() || '';
    if (!text) return;

    // Determine if it's a primary CTA
    const isPrimary = CTA_KEYWORDS.some(kw => text.includes(kw)) ||
      el.classList.contains('primary') ||
      el.classList.contains('btn-primary') ||
      el.classList.contains('cta');

    // Determine location
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


function extractSocialLinks(container: Document | Element): SocialLink[] {
  const socialLinks: SocialLink[] = [];
  const links = container.querySelectorAll('a[href]');

  links.forEach(link => {
    const href = (link as HTMLAnchorElement).href;
    if (!href) return;

    for (const { pattern, platform } of SOCIAL_PATTERNS) {
      if (pattern.test(href)) {
        // Avoid duplicates
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
  // Try html lang attribute
  const htmlLang = document.documentElement.getAttribute('lang');
  if (htmlLang) return htmlLang.split('-')[0];

  // Try meta tag
  const metaLang = document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content');
  if (metaLang) return metaLang.split('-')[0];

  // Default to English
  return 'en';
}

function getRawTextContent(document: Document): string {
  // Get text from body, removing excessive whitespace
  const body = document.body;
  if (!body) return '';

  return body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 5000) || '';
}

/**
 * Clean parsed DOM by removing empty children arrays and cssProperties objects
 * Removes: children: [], cssProperties: {}, images: [], attributes: {}
 */
function cleanParsedDOM<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays - recursively clean each item
  if (Array.isArray(obj)) {
    return obj.map(item => cleanParsedDOM(item)) as T;
  }

  // Handle objects
  if (typeof obj === 'object') {
    const cleaned: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip undefined and null
      if (value === undefined || value === null) {
        continue;
      }

      // Skip empty arrays (children, images, etc.)
      if (Array.isArray(value) && value.length === 0) {
        continue;
      }

      // Skip empty objects (cssProperties, attributes, etc.)
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
        continue;
      }

      // Recursively clean nested objects/arrays
      const cleanedValue = cleanParsedDOM(value);

      // Add the cleaned value
      cleaned[key] = cleanedValue;
    }

    return cleaned as T;
  }

  // Return primitives as-is
  return obj;
}

export const parser = {
  parse: parseHtml,
  clean: cleanParsedDOM,
};
