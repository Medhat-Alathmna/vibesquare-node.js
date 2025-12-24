import { JSDOM } from 'jsdom';
import {
  ParsedDOM,
  ParsedSection,
  NavItem,
  FormInfo,
  FormField,
  ImageInfo,
  ColorInfo,
  FontInfo,
  CTAInfo,
  FooterInfo,
  FooterColumn,
  SocialLink,
  EmbedInfo,
  PageMetadata,
} from './ir.types';
import { NormalizationResult } from './normalizer';
import { ApiError } from '../../../shared/utils/ApiError';
import httpStatus from 'http-status';

const MAX_SECTIONS = 50;
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

export function parseHtml(
  normalizedResult: NormalizationResult,
  originalUrl: string
): ParsedDOM {
  const dom = new JSDOM(normalizedResult.html);
  const document = dom.window.document;

  // Check for JS-only page
  const bodyText = document.body?.textContent?.trim() || '';
  const hasSemanticTags = !!(
    document.querySelector('header') ||
    document.querySelector('main') ||
    document.querySelector('section') ||
    document.querySelector('nav') ||
    document.querySelector('footer') ||
    document.querySelector('article')
  );

  if (bodyText.length < MIN_BODY_LENGTH && !hasSemanticTags) {
    throw new ApiError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'This page appears to require JavaScript to render content. Only static HTML pages are supported.'
    );
  }

  // Extract sections
  const sections = extractSections(document);

  // Extract navigation
  const navigation = extractNavigation(document);

  // Extract forms
  const forms = extractForms(document);

  // Extract images
  const images = extractImages(document, originalUrl);

  // Extract colors from inline styles
  const colors = extractColors(document);

  // Combine fonts from normalization result
  const fonts = normalizedResult.extractedFonts;

  // Extract CTAs
  const ctas = extractCTAs(document);

  // Extract footer
  const footer = extractFooter(document);

  // Extract social links
  const socialLinks = extractSocialLinks(document);

  // Get embeds from normalization result
  const embeds = normalizedResult.extractedEmbeds;

  // Extract metadata
  const metadata = extractMetadata(document);

  // Detect language
  const language = detectLanguage(document);

  // Get raw text content for LLM
  const rawTextContent = getRawTextContent(document);

  return {
    sections,
    navigation,
    forms,
    images,
    colors,
    fonts,
    ctas,
    footer,
    socialLinks,
    embeds,
    metadata,
    language,
    rawTextContent,
    cssInfo: normalizedResult.extractedCSS,
  };
}

function extractSections(document: Document): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const sectionTags = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'];

  // First, try semantic sections
  sectionTags.forEach(tag => {
    const elements = document.querySelectorAll(tag);
    elements.forEach((el, index) => {
      if (sections.length >= MAX_SECTIONS) return;

      sections.push({
        tag,
        id: el.id || undefined,
        className: el.className || undefined,
        textContent: el.textContent?.slice(0, 500).trim() || '',
        childCount: el.children.length,
        hasImages: el.querySelectorAll('img').length > 0,
        hasForms: el.querySelectorAll('form').length > 0,
        order: sections.length,
      });
    });
  });

  // If no semantic sections, try divs with common class names
  if (sections.length === 0) {
    const commonClasses = ['hero', 'banner', 'features', 'about', 'services', 'testimonials', 'pricing', 'contact', 'cta'];
    commonClasses.forEach(cls => {
      const elements = document.querySelectorAll(`div[class*="${cls}"], div[id*="${cls}"]`);
      elements.forEach(el => {
        if (sections.length >= MAX_SECTIONS) return;

        sections.push({
          tag: 'div',
          id: el.id || undefined,
          className: el.className || undefined,
          textContent: el.textContent?.slice(0, 500).trim() || '',
          childCount: el.children.length,
          hasImages: el.querySelectorAll('img').length > 0,
          hasForms: el.querySelectorAll('form').length > 0,
          order: sections.length,
        });
      });
    });
  }

  return sections.slice(0, MAX_SECTIONS);
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
    try {
      src = new URL(src, baseUrl).toString();
    } catch {
      // Keep as-is if URL parsing fails
    }

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

function extractFooter(document: Document): FooterInfo | null {
  const footer = document.querySelector('footer');
  if (!footer) return null;

  const columns: FooterColumn[] = [];

  // Try to find footer columns
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

  // Extract copyright
  const copyrightMatch = footer.textContent?.match(/©\s*\d{4}[^.]*|copyright[^.]+/i);
  const copyright = copyrightMatch?.[0]?.trim();

  // Extract social links from footer
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

export const parser = {
  parse: parseHtml,
};
