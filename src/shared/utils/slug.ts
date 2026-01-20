/**
 * Utility functions for generating URL-friendly slugs
 */

/**
 * Generates a URL-friendly slug from a string
 *
 * @param text - The text to convert to a slug
 * @returns A lowercase, hyphenated slug
 *
 * @example
 * generateSlug('E-commerce Store') // 'e-commerce-store'
 * generateSlug('Landing Page!') // 'landing-page'
 * generateSlug('Admin Panel (New)') // 'admin-panel-new'
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()                    // Convert to lowercase
    .trim()                           // Remove leading/trailing whitespace
    .replace(/[^\w\s-]/g, '')        // Remove special characters except spaces and hyphens
    .replace(/[\s_]+/g, '-')         // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-')             // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');        // Remove leading/trailing hyphens
}

/**
 * Validates if a string is a valid slug format
 *
 * @param slug - The slug to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * isValidSlug('e-commerce') // true
 * isValidSlug('E-commerce') // false (uppercase not allowed)
 * isValidSlug('e commerce') // false (spaces not allowed)
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

/**
 * Generates a unique slug by appending a number if needed
 *
 * @param baseSlug - The base slug to make unique
 * @param existingSlugs - Array of existing slugs to check against
 * @returns A unique slug
 *
 * @example
 * makeUniqueSlug('e-commerce', ['e-commerce']) // 'e-commerce-2'
 * makeUniqueSlug('dashboard', ['dashboard', 'dashboard-2']) // 'dashboard-3'
 */
export function makeUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug;
  let counter = 2;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
