/**
 * Base Agent Class
 *
 * Abstract base class for all agents in the multi-agent system.
 * Provides common functionality for LLM calls, error handling, and output parsing.
 */

import { z, ZodSchema } from 'zod';
import { openrouter, OpenRouterError } from '../providers/openrouter.client';
import {
  AgentConfig,
  AgentInput,
  AgentOutput,
  AgentPriority,
  Ambiguity,
} from './agent.types';

// ============ Base Agent Abstract Class ============

export abstract class BaseAgent<TOutput> {
  protected config: AgentConfig;
  protected outputSchema?: ZodSchema<TOutput>;

  constructor(config: AgentConfig, outputSchema?: ZodSchema<TOutput>) {
    this.config = config;
    this.outputSchema = outputSchema;
  }

  /**
   * Get agent name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get agent priority
   */
  get priority(): AgentPriority {
    return this.config.priority;
  }

  /**
   * Check if agent is critical (pipeline should fail if it fails)
   */
  get isCritical(): boolean {
    return this.config.priority === 'critical';
  }

  /**
   * Abstract method to build the user prompt from input
   * Must be implemented by each agent
   */
  protected abstract buildUserPrompt(input: AgentInput): string;

  /**
   * Abstract method to extract relevant data from ParsedDOM
   * Allows agents to work with only the data they need
   */
  protected abstract extractRelevantData(input: AgentInput): unknown;

  /**
   * Execute the agent
   */
  async execute(input: AgentInput): Promise<AgentOutput<TOutput>> {
    const startTime = Date.now();

    try {
      // Build the prompt
      const userPrompt = this.buildUserPrompt(input);

      // Call the LLM
      const result = await openrouter.call({
        model: this.config.model,
        systemPrompt: this.config.systemPrompt,
        userPrompt,
        maxTokens: this.config.maxTokens,
        timeout: this.config.timeout,
      });

      // Parse the response
      const parsed = this.parseResponse(result.content);

      // Validate if schema provided
      const validated = this.validateOutput(parsed);

      // Extract ambiguities
      const ambiguities = this.extractAmbiguities(validated);

      const processingTimeMs = Date.now() - startTime;

      return {
        data: validated,
        confidence: this.calculateConfidence(validated),
        ambiguities,
        processingTimeMs,
        tokenUsage: result.tokenUsage.total,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      if (error instanceof OpenRouterError) {
        throw new AgentExecutionError(
          this.config.name,
          `LLM call failed: ${error.message}`,
          error.code === 'TIMEOUT' ? 'timeout' : 'llm_error',
          this.isCritical
        );
      }

      if (error instanceof AgentExecutionError) {
        throw error;
      }

      throw new AgentExecutionError(
        this.config.name,
        error instanceof Error ? error.message : 'Unknown error',
        'unknown',
        this.isCritical
      );
    }
  }

  /**
   * Parse LLM response to extract JSON
   */
  protected parseResponse(content: string): TOutput {
    return openrouter.parseJsonResponse<TOutput>(content);
  }

  /**
   * Validate output against schema if provided
   */
  protected validateOutput(data: TOutput): TOutput {
    if (this.outputSchema) {
      const result = this.outputSchema.safeParse(data);
      if (!result.success) {
        throw new AgentExecutionError(
          this.config.name,
          `Output validation failed: ${result.error.message}`,
          'validation_error',
          this.isCritical
        );
      }
      return result.data;
    }
    return data;
  }

  /**
   * Extract ambiguities from output
   * Override in subclasses for custom extraction
   */
  protected extractAmbiguities(output: TOutput): Ambiguity[] {
    // Default: look for ambiguities array in output
    if (output && typeof output === 'object' && 'ambiguities' in output) {
      const ambiguities = (output as { ambiguities?: string[] }).ambiguities;
      if (Array.isArray(ambiguities)) {
        return ambiguities.map((q) => ({
          section: this.config.name,
          question: q,
          reason: 'Detected by agent',
          criticality: 'medium' as const,
        }));
      }
    }
    return [];
  }

  /**
   * Calculate confidence score from output
   * Override in subclasses for custom calculation
   */
  protected calculateConfidence(output: TOutput): number {
    // Default: look for confidence in output
    if (output && typeof output === 'object' && 'confidence' in output) {
      const confidence = (output as { confidence?: number }).confidence;
      if (typeof confidence === 'number') {
        return Math.max(0, Math.min(1, confidence));
      }
    }
    return 0.8; // Default confidence
  }

  /**
   * Retry logic for failed executions
   */
  async executeWithRetry(
    input: AgentInput,
    maxRetries: number = this.config.retryCount
  ): Promise<AgentOutput<TOutput>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on validation errors
        if (error instanceof AgentExecutionError && error.type === 'validation_error') {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }
}

// ============ Agent Execution Error ============

export class AgentExecutionError extends Error {
  constructor(
    public agentName: string,
    message: string,
    public type: 'timeout' | 'llm_error' | 'validation_error' | 'unknown',
    public isCritical: boolean
  ) {
    super(message);
    this.name = 'AgentExecutionError';
  }
}

// ============ Helper Functions ============

/**
 * Truncate text to max length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Summarize DOM nodes for prompt
 */
export function summarizeNodes(
  nodes: { tag: string; order: number; textContent?: string; cssProperties?: Record<string, string> }[],
  maxNodes: number = 50
): string {
  const summary = nodes.slice(0, maxNodes).map((node) => {
    const text = node.textContent ? truncateText(node.textContent.trim(), 50) : '';
    const css = node.cssProperties
      ? Object.entries(node.cssProperties)
          .slice(0, 5)
          .map(([k, v]) => `${k}:${v}`)
          .join(';')
      : '';

    return `[${node.order}] <${node.tag}>${text ? ` "${text}"` : ''}${css ? ` {${css}}` : ''}`;
  });

  if (nodes.length > maxNodes) {
    summary.push(`... and ${nodes.length - maxNodes} more nodes`);
  }

  return summary.join('\n');
}

/**
 * Extract flat list of nodes from tree
 */
export function flattenNodes<T extends { children?: T[] }>(nodes: T[]): T[] {
  const result: T[] = [];

  function traverse(nodeList: T[]) {
    for (const node of nodeList) {
      result.push(node);
      if (node.children && Array.isArray(node.children)) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return result;
}
