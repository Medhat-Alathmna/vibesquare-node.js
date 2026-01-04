import { FetchResult } from './ir.types';
import { ApiError } from '../../../shared/utils/ApiError';
import httpStatus from 'http-status';

const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT = 10000; // 10 seconds
const MAX_REDIRECTS = 5;
const MAX_RETRIES = 3; // Number of retry attempts
const INITIAL_RETRY_DELAY = 1000; // 1 second initial delay

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface FetchOptions {
  timeout?: number;
  maxSize?: number;
  maxRedirects?: number;
  maxRetries?: number;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    timeout = FETCH_TIMEOUT,
    maxSize = MAX_HTML_SIZE,
    maxRedirects = MAX_REDIRECTS,
    maxRetries = MAX_RETRIES
  } = options;

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid URL provided');
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only HTTP and HTTPS URLs are allowed');
  }

  // Retry loop with exponential backoff
  let lastError: Error | null = null;

  for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
    // Add delay before retry (except for first attempt)
    if (retryCount > 0) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1); // Exponential backoff
      await sleep(delay);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let redirectCount = 0;
    let currentUrl = url;
    let finalResponse: Response;

    try {
      // Handle redirects manually to track count
      while (redirectCount <= maxRedirects) {
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'DNT': '1',
          },
          signal: controller.signal,
          redirect: 'manual',
        });

      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new ApiError(httpStatus.BAD_GATEWAY, 'Redirect without location header');
        }

        // Resolve relative URLs
        currentUrl = new URL(location, currentUrl).toString();
        redirectCount++;

        if (redirectCount > maxRedirects) {
          throw new ApiError(httpStatus.BAD_GATEWAY, 'Too many redirects');
        }
        continue;
      }

        finalResponse = response;
        break;
      }

      // Check status codes
      if (finalResponse!.status === 999) {
        throw new ApiError(
          httpStatus.BAD_GATEWAY,
          'This website blocks automated requests. The site has anti-scraping protection.'
        );
      }

      if (finalResponse!.status === 401 || finalResponse!.status === 403) {
        throw new ApiError(httpStatus.BAD_GATEWAY, 'Page is protected (requires authentication)');
      }

      if (!finalResponse!.ok) {
        // Retryable status codes (5xx server errors, 429 too many requests)
        if (finalResponse!.status >= 500 || finalResponse!.status === 429) {
          throw new Error(`Retryable error: HTTP ${finalResponse!.status}`);
        }
        throw new ApiError(httpStatus.BAD_GATEWAY, `Failed to fetch URL: HTTP ${finalResponse!.status}`);
      }

      // Check content type
      const contentType = finalResponse!.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'URL does not return HTML content');
      }

      // Check content length if available
      const contentLength = finalResponse!.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > maxSize) {
        throw new ApiError(413, `HTML content exceeds maximum size of ${maxSize / 1024 / 1024} MB`);
      }

      // Read body with size check
      const reader = finalResponse!.body?.getReader();
      if (!reader) {
        throw new ApiError(httpStatus.BAD_GATEWAY, 'Failed to read response body');
      }

      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalSize += value.length;
        if (totalSize > maxSize) {
          reader.cancel();
          throw new ApiError(413, `HTML content exceeds maximum size of ${maxSize / 1024 / 1024} MB`);
        }

        chunks.push(value);
      }

      // Combine chunks and decode
      const combinedChunks = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        combinedChunks.set(chunk, offset);
        offset += chunk.length;
      }

      const html = new TextDecoder('utf-8').decode(combinedChunks);

      // Success - return result
      return {
        html,
        finalUrl: currentUrl,
        statusCode: finalResponse!.status,
        contentLength: totalSize,
      };

    } catch (error) {
      // Non-retryable errors - throw immediately
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new ApiError(httpStatus.GATEWAY_TIMEOUT, `Request timed out after ${timeout / 1000} seconds`);
        // Don't retry on timeout for now
        throw lastError;
      }

      // Retryable errors (network issues, 5xx, 429)
      if (error instanceof Error) {
        lastError = error;
        // Continue to next retry iteration
        if (retryCount < maxRetries) {
          continue;
        }
      }

      // If this was the last retry, throw error
      if (retryCount === maxRetries) {
        throw new ApiError(
          httpStatus.BAD_GATEWAY,
          `Failed to fetch URL after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // If we get here, all retries failed
  throw new ApiError(
    httpStatus.BAD_GATEWAY,
    `Failed to fetch URL after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

export const fetcher = {
  fetch: fetchUrl,
};
