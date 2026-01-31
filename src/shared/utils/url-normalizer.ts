/**
 * URL Normalization Utility for Visual Pipeline Caching
 *
 * Normalizes URLs to ensure cache deduplication works correctly.
 * Multiple URL formats pointing to the same resource should normalize to the same value.
 *
 * Normalization Rules:
 * 1. Remove protocol differences (http:// and https:// → same)
 * 2. Remove www prefix (www.example.com → example.com)
 * 3. Remove trailing slashes (example.com/ → example.com)
 * 4. Remove query parameters (?page=1 → removed)
 * 5. Remove hash fragments (#section → removed)
 * 6. Convert to lowercase
 * 7. Preserve path structure (/products/123 stays as-is)
 *
 * Examples:
 * - https://www.example.com/ → example.com
 * - http://Example.COM/products?id=1 → example.com/products
 * - https://www.example.com/page#section → example.com/page
 */

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Normalizes a URL for cache key generation
 *
 * @param urlString - The URL to normalize
 * @returns Normalized URL string (without protocol)
 * @throws Error if URL is invalid
 *
 * @example
 * normalizeUrl('https://www.example.com/') // → 'example.com'
 * normalizeUrl('HTTP://Example.COM/products?id=1') // → 'example.com/products'
 */
export function normalizeUrl(urlString: string): string {
  // Validate URL
  if (!isValidUrl(urlString)) {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  try {
    const url = new URL(urlString);

    // Extract hostname and remove 'www.' prefix
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    // Extract pathname and remove trailing slash
    let pathname = url.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }

    // Combine hostname and pathname (no protocol, no query, no hash)
    const normalized = hostname + pathname;

    return normalized;
  } catch (error) {
    throw new Error(`Failed to normalize URL: ${urlString}. Error: ${(error as Error).message}`);
  }
}

/**
 * Extracts the domain (hostname) from a URL
 *
 * @param urlString - The URL to extract domain from
 * @returns Domain name without protocol or www prefix
 *
 * @example
 * extractDomain('https://www.example.com/page') // → 'example.com'
 */
export function extractDomain(urlString: string): string {
  if (!isValidUrl(urlString)) {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  const url = new URL(urlString);
  let hostname = url.hostname.toLowerCase();

  // Remove 'www.' prefix
  if (hostname.startsWith('www.')) {
    hostname = hostname.substring(4);
  }

  return hostname;
}

/**
 * Checks if two URLs normalize to the same value
 *
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns true if URLs normalize to the same value
 *
 * @example
 * areUrlsEquivalent('https://example.com/', 'http://www.example.com') // → true
 */
export function areUrlsEquivalent(url1: string, url2: string): boolean {
  try {
    return normalizeUrl(url1) === normalizeUrl(url2);
  } catch (error) {
    return false;
  }
}

/**
 * Gets the original protocol from a URL
 * This is useful if you need to preserve the original protocol for other purposes
 *
 * @param urlString - The URL to extract protocol from
 * @returns Protocol (http: or https:)
 */
export function getProtocol(urlString: string): string {
  if (!isValidUrl(urlString)) {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  const url = new URL(urlString);
  return url.protocol;
}
