/**
 * Pipeline Queue Service
 *
 * Manages concurrent requests to the same URL to prevent duplicate
 * pipeline executions. When multiple users request analysis of the
 * same URL simultaneously, only one pipeline execution occurs and
 * all requests receive the same result.
 *
 * This is critical for:
 * 1. Resource efficiency (prevents wasted LLM API calls)
 * 2. Cost reduction (multiple users share the same analysis)
 * 3. Response consistency (all users get identical results)
 */

export class PipelineQueueService {
  // Map of normalized URL → Promise of pipeline execution
  private queue: Map<string, Promise<any>> = new Map();

  /**
   * Execute a pipeline function, ensuring only one execution per URL
   *
   * If another request is already processing the same URL, this will
   * wait for that existing execution to complete and return its result.
   *
   * @param normalizedUrl - The normalized URL being processed
   * @param executor - The pipeline execution function
   * @returns The result of the pipeline execution
   *
   * @example
   * const result = await pipelineQueue.execute(
   *   'example.com/page',
   *   () => executePipelineV2({ url: 'https://example.com/page' })
   * );
   */
  async execute<T>(
    normalizedUrl: string,
    executor: () => Promise<T>
  ): Promise<T> {
    // Check if already processing this URL
    const existingPromise = this.queue.get(normalizedUrl);

    if (existingPromise) {
      console.log(`[PipelineQueue] ⏳ Waiting for existing execution: ${normalizedUrl}`);
      console.log(`[PipelineQueue] 📊 Current queue size: ${this.queue.size}`);

      try {
        // Wait for the existing promise to resolve
        const result = await existingPromise;
        console.log(`[PipelineQueue] ✅ Received result from queued execution: ${normalizedUrl}`);
        return result as T;
      } catch (error) {
        console.error(`[PipelineQueue] ❌ Queued execution failed: ${normalizedUrl}`, error);
        throw error;
      }
    }

    console.log(`[PipelineQueue] 🚀 Starting new execution: ${normalizedUrl}`);

    // Create new promise for this execution
    const promise = executor()
      .then((result) => {
        console.log(`[PipelineQueue] ✅ Execution completed: ${normalizedUrl}`);
        return result;
      })
      .catch((error) => {
        console.error(`[PipelineQueue] ❌ Execution failed: ${normalizedUrl}`, error);
        throw error;
      })
      .finally(() => {
        // Remove from queue when done (success or failure)
        this.queue.delete(normalizedUrl);
        console.log(`[PipelineQueue] 🧹 Removed from queue: ${normalizedUrl}`);
        console.log(`[PipelineQueue] 📊 Remaining queue size: ${this.queue.size}`);
      });

    // Add to queue
    this.queue.set(normalizedUrl, promise);
    console.log(`[PipelineQueue] 📝 Added to queue: ${normalizedUrl}`);
    console.log(`[PipelineQueue] 📊 Current queue size: ${this.queue.size}`);

    return promise;
  }

  /**
   * Check if a URL is currently being processed
   *
   * @param normalizedUrl - The normalized URL to check
   * @returns true if URL is in queue, false otherwise
   */
  isQueued(normalizedUrl: string): boolean {
    return this.queue.has(normalizedUrl);
  }

  /**
   * Get the current queue size
   *
   * @returns Number of URLs currently being processed
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Get all URLs currently in the queue
   *
   * @returns Array of normalized URLs being processed
   */
  getQueuedUrls(): string[] {
    return Array.from(this.queue.keys());
  }

  /**
   * Clear all queued executions (use with caution!)
   * This will cause all waiting requests to fail.
   */
  clear(): void {
    console.warn('[PipelineQueue] ⚠️  Clearing all queued executions');
    this.queue.clear();
  }

  /**
   * Get queue statistics for monitoring
   *
   * @returns Object with queue statistics
   */
  getStats(): {
    queueSize: number;
    queuedUrls: string[];
  } {
    return {
      queueSize: this.queue.size,
      queuedUrls: this.getQueuedUrls(),
    };
  }
}

// Singleton instance
export const pipelineQueueService = new PipelineQueueService();
