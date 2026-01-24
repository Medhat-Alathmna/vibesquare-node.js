/**
 * Base Technical Agent
 *
 * Extended base class for all Technical Architecture Pipeline agents.
 * Adds XML output handling and web search capabilities.
 */

import { z, ZodSchema } from 'zod';
import { llmProvider, LLMProviderError } from '../../agents/providers/llm-provider';
import { AgentExecutionError } from '../../agents/core/base-agent';
import {
  TechnicalAgentConfig,
  TechnicalAgentInput,
  TechnicalAgentError,
  DetailLevel,
} from './technical-agent.types';

// ============ Base Technical Agent Abstract Class ============

export abstract class BaseTechnicalAgent<TOutput> {
  protected config: TechnicalAgentConfig;
  protected outputSchema?: ZodSchema<TOutput>;

  constructor(config: TechnicalAgentConfig, outputSchema?: ZodSchema<TOutput>) {
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
   * Get agent layer
   */
  get layer(): number {
    return this.config.layer;
  }

  /**
   * Get dependencies
   */
  get dependencies(): string[] {
    return this.config.dependencies;
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
  protected abstract buildUserPrompt(input: TechnicalAgentInput): string;

  /**
   * Abstract method to parse XML output and extract structured data
   * Must be implemented by each agent
   */
  protected abstract parseXMLOutput(xmlContent: string): TOutput;

  /**
   * Get detail level specific instructions
   */
  protected getDetailLevelInstructions(level: DetailLevel): string {
    switch (level) {
      case 'basic':
        return `
DETAIL LEVEL: BASIC
- Include only essential elements
- Minimal descriptions
- Focus on core functionality only
- Skip advanced features and optimizations`;

      case 'detailed':
        return `
DETAIL LEVEL: DETAILED
- Include all standard elements
- Moderate descriptions with context
- Cover main use cases
- Include common best practices`;

      case 'comprehensive':
        return `
DETAIL LEVEL: COMPREHENSIVE
- Include all possible elements
- Detailed descriptions with examples
- Cover edge cases and advanced scenarios
- Include performance optimizations
- Add security hardening details
- Consider scalability aspects`;

      default:
        return '';
    }
  }

  /**
   * Execute the agent
   */
  async execute(input: TechnicalAgentInput): Promise<{
    data: TOutput;
    xml: string;
    processingTimeMs: number;
    tokenUsage: number;
  }> {
    const startTime = Date.now();

    try {
      // Build the prompt with detail level instructions
      const detailInstructions = this.getDetailLevelInstructions(input.detailLevel);
      const userPrompt = this.buildUserPrompt(input);
      const fullPrompt = `${detailInstructions}\n\n${userPrompt}`;

      // Call the LLM
      const result = await llmProvider.call({
        agentName: this.config.name,
        systemPrompt: this.config.systemPrompt,
        userPrompt: fullPrompt,
        maxTokens: this.config.maxTokens,
        timeout: this.config.timeout,
      });

      // Extract XML from response
      const xmlContent = this.extractXML(result.content);

      // Parse XML to structured data
      const parsed = this.parseXMLOutput(xmlContent);

      // Validate if schema provided
      const validated = this.validateOutput(parsed);

      const processingTimeMs = Date.now() - startTime;

      return {
        data: validated,
        xml: xmlContent,
        processingTimeMs,
        tokenUsage: result.tokenUsage.total,
      };
    } catch (error: unknown) {
      const processingTimeMs = Date.now() - startTime;

      if (error instanceof LLMProviderError) {
        throw new TechnicalAgentExecutionError(
          this.config.name,
          `LLM call failed: ${error.message}`,
          error.code === 'TIMEOUT' ? 'timeout' : 'llm_error',
          this.isCritical
        );
      }

      if (error instanceof TechnicalAgentExecutionError) {
        throw error;
      }

      throw new TechnicalAgentExecutionError(
        this.config.name,
        error instanceof Error ? error.message : 'Unknown error',
        'unknown',
        this.isCritical
      );
    }
  }

  /**
   * Extract XML content from LLM response
   */
  protected extractXML(content: string): string {
    // Try to find XML block in markdown code fence
    const xmlBlockMatch = content.match(/```xml\s*([\s\S]*?)\s*```/);
    if (xmlBlockMatch) {
      return xmlBlockMatch[1].trim();
    }

    // Try to find XML without code fence (starts with <)
    const xmlMatch = content.match(/<[\w-]+[\s\S]*<\/[\w-]+>/);
    if (xmlMatch) {
      return xmlMatch[0].trim();
    }

    // If no XML found, throw error
    throw new TechnicalAgentExecutionError(
      this.config.name,
      'No valid XML found in response',
      'xml_parse_error',
      this.isCritical
    );
  }

  /**
   * Validate output against schema if provided
   */
  protected validateOutput(data: TOutput): TOutput {
    if (this.outputSchema) {
      const result = this.outputSchema.safeParse(data);
      if (!result.success) {
        throw new TechnicalAgentExecutionError(
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
   * Retry logic for failed executions
   */
  async executeWithRetry(
    input: TechnicalAgentInput,
    maxRetries: number = this.config.retryCount
  ): Promise<{
    data: TOutput;
    xml: string;
    processingTimeMs: number;
    tokenUsage: number;
  }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on validation errors
        if (
          error instanceof TechnicalAgentExecutionError &&
          error.type === 'validation_error'
        ) {
          throw error;
        }

        console.log(
          `[${this.config.name}] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}`
        );

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }
}

// ============ Technical Agent Execution Error ============

export class TechnicalAgentExecutionError extends Error {
  constructor(
    public agentName: string,
    message: string,
    public type: 'timeout' | 'llm_error' | 'validation_error' | 'xml_parse_error' | 'unknown',
    public isCritical: boolean
  ) {
    super(message);
    this.name = 'TechnicalAgentExecutionError';
  }

  toAgentError(): TechnicalAgentError {
    return {
      agentName: this.agentName,
      message: this.message,
      type: this.type,
      isCritical: this.isCritical,
      timestamp: new Date(),
    };
  }
}

// ============ XML Helper Functions ============

/**
 * Extract attribute value from XML element
 */
export function getXMLAttribute(
  xml: string,
  tagName: string,
  attributeName: string
): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*\\s${attributeName}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Extract all elements of a given tag name
 */
export function getXMLElements(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const matches = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

/**
 * Extract element content by tag name (first match)
 */
export function getXMLElementContent(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract self-closing element attributes
 */
export function getSelfClosingElementAttributes(
  xml: string,
  tagName: string
): Array<Record<string, string>> {
  const regex = new RegExp(`<${tagName}\\s+([^/>]*)/>`, 'gi');
  const results: Array<Record<string, string>> = [];
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(match[1])) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }

    results.push(attrs);
  }

  return results;
}

/**
 * Extract CDATA content
 */
export function getCDATAContent(xml: string): string | undefined {
  const match = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return match ? match[1] : undefined;
}
