/**
 * OpenRouter Client
 *
 * Provides a unified interface to call multiple LLM providers via OpenRouter.
 * Supports OpenAI, Anthropic, Google, and other models through a single API.
 */

import OpenAI from 'openai';
import { env } from '../../../../config/env';

// ============ Types ============

export interface ModelCallOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface ModelCallResult {
  content: string;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  latencyMs: number;
}

// ============ Model Configurations ============

export const AGENT_MODELS = {
  layoutAnalyzer: 'openai/gpt-4o-mini',
  componentIdentifier: 'openai/gpt-4o',
  designSystemExtractor: 'anthropic/claude-3-5-sonnet',
  interactionAnalyzer: 'google/gemini-2.0-flash-exp',
  responsiveBehavior: 'openai/gpt-4o-mini',
  conflictResolver: 'anthropic/claude-3-5-sonnet',
  promptSynthesizer: 'anthropic/claude-3-5-sonnet',
  userQuestionCollector: 'openai/gpt-4o-mini',
} as const;

export type AgentName = keyof typeof AGENT_MODELS;

// ============ OpenRouter Client ============

class OpenRouterClient {
  private client: OpenAI | null = null;
  private isConfigured: boolean = false;

  /**
   * Initialize the OpenRouter client
   */
  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = env.OPENROUTER_API_KEY;

      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not configured');
      }

      this.client = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://vibesquare.com',
          'X-Title': 'VibeSquare Analysis',
        },
      });

      this.isConfigured = true;
    }

    return this.client;
  }

  /**
   * Check if OpenRouter is configured
   */
  isAvailable(): boolean {
    return !!env.OPENROUTER_API_KEY;
  }

  /**
   * Call a model via OpenRouter
   */
  async call(options: ModelCallOptions): Promise<ModelCallResult> {
    const {
      model,
      systemPrompt,
      userPrompt,
      maxTokens = 2048,
      temperature = 0.6,
      timeout = 30000,
    } = options;

    const client = this.getClient();
    const startTime = Date.now();

    try {
      const response = await Promise.race([
        client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model call timed out after ${timeout}ms`)), timeout)
        ),
      ]);

      const latencyMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content || '';

      return {
        content,
        tokenUsage: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
        model,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error) {
        // Handle specific OpenRouter errors
        if (error.message.includes('rate') || error.message.includes('429')) {
          throw new OpenRouterError('Rate limit exceeded', 'RATE_LIMIT', model);
        }
        if (error.message.includes('API key') || error.message.includes('401')) {
          throw new OpenRouterError('Invalid API key', 'AUTH_ERROR', model);
        }
        if (error.message.includes('timed out')) {
          throw new OpenRouterError(`Request timed out after ${latencyMs}ms`, 'TIMEOUT', model);
        }

        throw new OpenRouterError(error.message, 'UNKNOWN', model);
      }

      throw new OpenRouterError('Unknown error occurred', 'UNKNOWN', model);
    }
  }

  /**
   * Call a specific agent's model
   */
  async callAgent(
    agentName: AgentName,
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<Omit<ModelCallOptions, 'model' | 'systemPrompt' | 'userPrompt'>>
  ): Promise<ModelCallResult> {
    const model = AGENT_MODELS[agentName];

    return this.call({
      model,
      systemPrompt,
      userPrompt,
      ...options,
    });
  }

  /**
   * Parse JSON from model response
   */
  parseJsonResponse<T>(content: string): T {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    try {
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      // Try to find JSON object in the response
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]) as T;
      }

      throw new Error(`Failed to parse JSON response: ${content.slice(0, 100)}...`);
    }
  }
}

// ============ Custom Error ============

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public code: 'RATE_LIMIT' | 'AUTH_ERROR' | 'TIMEOUT' | 'UNKNOWN',
    public model: string
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

// ============ Export Singleton ============

export const openrouter = new OpenRouterClient();

// ============ Direct Call Function ============

export async function callModel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2048
): Promise<string> {
  const result = await openrouter.call({
    model,
    systemPrompt,
    userPrompt,
    maxTokens,
  });

  return result.content;
}
