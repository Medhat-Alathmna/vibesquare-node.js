/**
 * Toon Compression Utility
 *
 * Utilities for compressing and decompressing JSON data using @toon-format/toon.
 * Toon is a compact, human-readable, schema-aware encoding of JSON.
 * It reduces token count for LLM prompts while remaining readable.
 */

import { encode, decode } from '@toon-format/toon';

/**
 * Compress a JSON object to Toon format
 *
 * @param data - Any JSON-serializable data
 * @returns Toon-encoded string (smaller than JSON)
 */
export function compressJSON<T = any>(data: T): string {
  try {
    // Encode the data to Toon format
    const encoded = encode(data);

    return encoded;
  } catch (error) {
    console.error('[Toon Compression] Error compressing data:', error);
    throw new Error(`Failed to compress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decompress Toon format data back to JSON
 *
 * @param compressed - Toon-encoded string
 * @returns Decompressed JSON object
 */
export function decompressJSON<T = any>(compressed: string): T {
  try {
    // Decode the Toon data
    const decoded = decode(compressed);

    return decoded as T;
  } catch (error) {
    console.error('[Toon Compression] Error decompressing data:', error);
    throw new Error(`Failed to decompress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate compression ratio
 *
 * @param original - Original JSON object
 * @param compressed - Compressed Toon string
 * @returns Compression ratio (0-1, lower is better)
 */
export function calculateCompressionRatio(original: any, compressed: string): number {
  const originalSize = JSON.stringify(original).length;
  const compressedSize = compressed.length;

  return compressedSize / originalSize;
}

/**
 * Get compression stats
 *
 * @param original - Original JSON object
 * @param compressed - Compressed Toon string
 * @returns Compression statistics
 */
export function getCompressionStats(original: any, compressed: string) {
  const originalSize = JSON.stringify(original).length;
  const compressedSize = compressed.length;
  const ratio = calculateCompressionRatio(original, compressed);
  const savedBytes = originalSize - compressedSize;
  const savedPercentage = ((savedBytes / originalSize) * 100).toFixed(2);

  return {
    originalSize,
    compressedSize,
    savedBytes,
    savedPercentage: `${savedPercentage}%`,
    compressionRatio: ratio.toFixed(2),
  };
}

/**
 * Compress data only if it reduces size significantly
 *
 * @param data - JSON object to potentially compress
 * @param threshold - Minimum compression ratio to accept (default: 0.7 = 30% reduction)
 * @returns Object with compression result and stats
 */
export function smartCompress<T = any>(data: T, threshold: number = 0.7) {
  const compressed = compressJSON(data);
  const ratio = calculateCompressionRatio(data, compressed);

  if (ratio < threshold) {
    return {
      compressed: true,
      data: compressed,
      stats: getCompressionStats(data, compressed),
    };
  }

  return {
    compressed: false,
    data: data,
    stats: {
      originalSize: JSON.stringify(data).length,
      compressedSize: compressed.length,
      savedBytes: 0,
      savedPercentage: '0%',
      compressionRatio: ratio.toFixed(2),
      reason: 'Compression ratio did not meet threshold',
    },
  };
}
