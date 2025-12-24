import { JSDOM } from 'jsdom';
import { FontInfo, EmbedInfo, CSSInfo, CSSClassInfo } from './ir.types';

export interface NormalizationResult {
  html: string;
  extractedFonts: FontInfo[];
  extractedEmbeds: EmbedInfo[];
  extractedCSS: CSSInfo;
}

// Inline event handlers to remove
const EVENT_HANDLERS = [
  'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onmouseout', 'onmousemove',
  'onkeydown', 'onkeyup', 'onkeypress',
  'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset',
  'onload', 'onunload', 'onerror', 'onresize', 'onscroll',
  'ondragstart', 'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondrop',
  'ontouchstart', 'ontouchmove', 'ontouchend', 'ontouchcancel',
  'oncontextmenu', 'onwheel', 'oninput', 'oninvalid', 'onsearch', 'onselect',
];

// Tags to completely remove
const REMOVE_TAGS = ['script', 'noscript', 'style'];

// ============ CSS Extraction Functions ============

function detectGridColumns(css: string): number | undefined {
  // Match: grid-template-columns: repeat(3, 1fr)
  const repeatMatch = css.match(/grid-template-columns:\s*repeat\((\d+)/i);
  if (repeatMatch) return parseInt(repeatMatch[1]);

  // Match: grid-template-columns: 1fr 1fr 1fr
  const frMatch = css.match(/grid-template-columns:\s*((?:[\d.]+fr\s*)+)/i);
  if (frMatch) {
    return frMatch[1].trim().split(/\s+/).length;
  }

  // Match: grid-template-columns: 200px 200px 200px
  const pxMatch = css.match(/grid-template-columns:\s*((?:\d+px\s*)+)/i);
  if (pxMatch) {
    return pxMatch[1].trim().split(/\s+/).length;
  }

  return undefined;
}

function detectFlexColumns(css: string): number | undefined {
  // Match: flex-basis: 33.33%
  const basisMatch = css.match(/flex-basis:\s*([\d.]+)%/i);
  if (basisMatch) {
    const percent = parseFloat(basisMatch[1]);
    if (percent > 0 && percent <= 50) return Math.round(100 / percent);
  }

  // Match: width: calc(100%/3) or width: 33.33%
  const widthMatch = css.match(/width:\s*(?:calc\(100%\s*\/\s*(\d+)\)|([\d.]+)%)/i);
  if (widthMatch) {
    if (widthMatch[1]) return parseInt(widthMatch[1]);
    if (widthMatch[2]) {
      const percent = parseFloat(widthMatch[2]);
      if (percent > 0 && percent <= 50) return Math.round(100 / percent);
    }
  }

  return undefined;
}

function detectBreakpoints(css: string): string[] {
  const breakpoints: string[] = [];
  const mediaMatches = css.matchAll(/@media[^{]*\((?:max|min)-width:\s*(\d+)px\)/gi);
  for (const match of mediaMatches) {
    breakpoints.push(match[1] + 'px');
  }
  return [...new Set(breakpoints)].sort((a, b) => parseInt(a) - parseInt(b));
}

function detectResponsiveGrid(css: string): boolean {
  // Check if grid-template-columns exists inside a media query
  return /@media[^{]*\{[^}]*grid-template-columns/i.test(css);
}

function extractCSSClasses(css: string): CSSClassInfo[] {
  const classes: CSSClassInfo[] = [];
  const processedClasses = new Set<string>();

  // Extract classes from regular CSS (outside media queries)
  const classRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = classRegex.exec(css)) !== null) {
    const className = match[1];
    const propertiesBlock = match[2];

    // Skip if already processed
    if (processedClasses.has(className)) continue;
    processedClasses.add(className);

    const properties: Record<string, string> = {};

    // Extract property-value pairs
    const propRegex = /([a-z-]+)\s*:\s*([^;]+);?/gi;
    let propMatch;

    while ((propMatch = propRegex.exec(propertiesBlock)) !== null) {
      const property = propMatch[1].trim();
      const value = propMatch[2].trim();
      properties[property] = value;
    }

    if (Object.keys(properties).length > 0) {
      classes.push({
        className,
        properties,
      });
    }
  }

  // Extract classes from media queries
  const mediaQueryRegex = /@media\s*([^{]+)\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let mediaMatch;

  while ((mediaMatch = mediaQueryRegex.exec(css)) !== null) {
    const mediaQuery = mediaMatch[1].trim();
    const mediaContent = mediaMatch[2];

    const mediaClassRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
    let mediaClassMatch;

    while ((mediaClassMatch = mediaClassRegex.exec(mediaContent)) !== null) {
      const className = mediaClassMatch[1];
      const propertiesBlock = mediaClassMatch[2];

      const properties: Record<string, string> = {};

      const propRegex = /([a-z-]+)\s*:\s*([^;]+);?/gi;
      let propMatch;

      while ((propMatch = propRegex.exec(propertiesBlock)) !== null) {
        const property = propMatch[1].trim();
        const value = propMatch[2].trim();
        properties[property] = value;
      }

      if (Object.keys(properties).length > 0) {
        classes.push({
          className,
          properties,
          mediaQuery: `@media ${mediaQuery}`,
        });
      }
    }
  }

  return classes;
}

async function extractCSSInfo(document: Document, baseUrl: string): Promise<CSSInfo> {
  let allCSS = '';

  // 1. Extract from <style> tags
  const styleTags = document.querySelectorAll('style');
  styleTags.forEach(style => {
    allCSS += style.textContent || '';
  });

  // 2. Fetch external CSS files from <link> tags
  const linkTags = document.querySelectorAll('link[rel="stylesheet"]');
  const cssPromises: Promise<string>[] = [];

  linkTags.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    // Resolve relative URLs
    let cssUrl: string;
    try {
      cssUrl = new URL(href, baseUrl).toString();
    } catch {
      return; // Skip invalid URLs
    }

    // Fetch CSS file
    const cssPromise = fetch(cssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })
      .then(res => {
        if (!res.ok) return '';
        return res.text();
      })
      .catch(() => ''); // Ignore fetch errors for individual CSS files

    cssPromises.push(cssPromise);
  });

  // Wait for all CSS files (max 10 files to avoid performance issues)
  const externalCSS = await Promise.all(cssPromises.slice(0, 10));
  allCSS += ' ' + externalCSS.join(' ');

  // 3. Also check inline styles in elements for grid/flex patterns
  const elementsWithStyle = document.querySelectorAll('[style*="grid"], [style*="flex"]');
  elementsWithStyle.forEach(el => {
    const style = el.getAttribute('style');
    if (style) {
      allCSS += ' ' + style;
    }
  });

  return {
    gridColumns: detectGridColumns(allCSS),
    flexColumns: detectFlexColumns(allCSS),
    breakpoints: detectBreakpoints(allCSS),
    hasResponsiveGrid: detectResponsiveGrid(allCSS),
    classes: extractCSSClasses(allCSS),
  };
}

// ============ Main Normalization Function ============

export async function normalizeHtml(rawHtml: string, baseUrl: string): Promise<NormalizationResult> {
  const dom = new JSDOM(rawHtml);
  const document = dom.window.document;

  const extractedFonts: FontInfo[] = [];
  const extractedEmbeds: EmbedInfo[] = [];

  // Extract Google Fonts before removing link tags
  const fontLinks = document.querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]');
  fontLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      // Parse Google Fonts URL to extract font families
      const familyMatch = href.match(/family=([^&]+)/);
      if (familyMatch) {
        const families = familyMatch[1].split('|');
        families.forEach(family => {
          const fontName = family.split(':')[0].replace(/\+/g, ' ');
          extractedFonts.push({
            family: fontName,
            source: 'google',
            url: href,
          });
        });
      }
    }
  });

  // Extract embeds before removing iframes
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    const src = iframe.getAttribute('src') || '';
    let embedInfo: EmbedInfo;

    if (src.includes('youtube.com') || src.includes('youtu.be')) {
      embedInfo = { type: 'video', platform: 'youtube', url: src };
    } else if (src.includes('vimeo.com')) {
      embedInfo = { type: 'video', platform: 'vimeo', url: src };
    } else if (src.includes('google.com/maps') || src.includes('maps.google.com')) {
      embedInfo = { type: 'map', platform: 'google-maps', url: src };
    } else if (src.includes('openstreetmap.org')) {
      embedInfo = { type: 'map', platform: 'openstreetmap', url: src };
    } else if (src.includes('spotify.com')) {
      embedInfo = { type: 'widget', platform: 'spotify', url: src };
    } else if (src.includes('twitter.com') || src.includes('x.com')) {
      embedInfo = { type: 'widget', platform: 'twitter', url: src };
    } else if (src.includes('facebook.com')) {
      embedInfo = { type: 'widget', platform: 'facebook', url: src };
    } else {
      embedInfo = { type: 'unknown', url: src };
    }

    extractedEmbeds.push(embedInfo);
  });

  // Extract CSS info BEFORE removing style tags (now async!)
  const extractedCSS = await extractCSSInfo(document, baseUrl);

  // Remove script, noscript, style tags
  REMOVE_TAGS.forEach(tag => {
    const elements = document.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  // Remove iframes (content extracted above)
  iframes.forEach(iframe => iframe.remove());

  // Remove SVG elements (often icons/graphics that aren't needed for structure)
  const svgs = document.querySelectorAll('svg');
  svgs.forEach(svg => svg.remove());

  // Remove inline event handlers
  const allElements = document.querySelectorAll('*');
  allElements.forEach(element => {
    EVENT_HANDLERS.forEach(handler => {
      element.removeAttribute(handler);
    });
    // Also remove javascript: hrefs
    const href = element.getAttribute('href');
    if (href && href.toLowerCase().startsWith('javascript:')) {
      element.setAttribute('href', '#');
    }
  });

  // Remove comments
  const walker = document.createTreeWalker(
    document.documentElement,
    128, // NodeFilter.SHOW_COMMENT
    null
  );
  const comments: Comment[] = [];
  while (walker.nextNode()) {
    comments.push(walker.currentNode as Comment);
  }
  comments.forEach(comment => comment.remove());

  // Normalize whitespace in text nodes (but keep structure)
  const textWalker = document.createTreeWalker(
    document.documentElement,
    4, // NodeFilter.SHOW_TEXT
    null
  );
  const textNodes: Text[] = [];
  while (textWalker.nextNode()) {
    textNodes.push(textWalker.currentNode as Text);
  }
  textNodes.forEach(node => {
    // Replace multiple whitespace with single space, but preserve line breaks for block elements
    const normalized = node.textContent?.replace(/[ \t]+/g, ' ') || '';
    node.textContent = normalized;
  });

  // Get the cleaned HTML
  const cleanedHtml = dom.serialize();

  return {
    html: cleanedHtml,
    extractedFonts,
    extractedEmbeds,
    extractedCSS,
  };
}

export const normalizer = {
  clean: normalizeHtml,
};
