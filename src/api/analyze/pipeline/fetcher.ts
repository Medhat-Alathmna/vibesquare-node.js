import { FetchResult } from './ir.types';
import { ApiError } from '../../../shared/utils/ApiError';
import httpStatus from 'http-status';

const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT = 10000; // 10 seconds
const MAX_REDIRECTS = 5;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface FetchOptions {
  timeout?: number;
  maxSize?: number;
  maxRedirects?: number;
}

export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    timeout = FETCH_TIMEOUT,
    maxSize = MAX_HTML_SIZE,
    maxRedirects = MAX_REDIRECTS
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
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
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
    if (finalResponse!.status === 401 || finalResponse!.status === 403) {
      throw new ApiError(httpStatus.BAD_GATEWAY, 'Page is protected (requires authentication)');
    }

    if (!finalResponse!.ok) {
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

    return {
      html,
      finalUrl: currentUrl,
      statusCode: finalResponse!.status,
      contentLength: totalSize,
    };

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiError(httpStatus.GATEWAY_TIMEOUT, `Request timed out after ${timeout / 1000} seconds`);
      }
      throw new ApiError(httpStatus.BAD_GATEWAY, `Failed to fetch URL: ${error.message}`);
    }

    throw new ApiError(httpStatus.BAD_GATEWAY, 'Failed to fetch URL');
  } finally {
    clearTimeout(timeoutId);
  }
}

export const fetcher = {
  fetch: fetchUrl,
};
