/**
 * LLM Provider - Unified Interface
 *
 * Provides a unified interface for calling different LLM providers.
 * Supports dynamic provider selection and model configuration per agent.
 * Default provider: Google Gemini
 */

import { env } from '../../../../config/env';
import { gemini, GeminiError, GEMINI_MODELS, GeminiCallResult } from './gemini.client';
import { openrouter, OpenRouterError, AGENT_MODELS, ModelCallResult } from './openrouter.client';

// ============ Types ============

export type LLMProvider = 'gemini' | 'openrouter';

export interface LLMCallOptions {
    model?: string;
    agentName?: string;
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    provider?: LLMProvider;
}

export interface LLMCallResult {
    content: string;
    tokenUsage: {
        prompt: number;
        completion: number;
        total: number;
    };
    model: string;
    latencyMs: number;
    provider: LLMProvider;
}

// ============ Agent Model Configuration ============

/**
 * Model configuration per agent with provider flexibility
 * Allows overriding the default model for specific agents
 */
export interface AgentModelConfig {
    gemini: string;
    openrouter: string;
}

/**
 * All agents now use Gemini 3 models for both providers:
 * - Gemini: Direct API
 * - OpenRouter: Gemini 3 Flash via OpenRouter proxy
 *
 * Gemini 3 Flash advantages:
 * - Faster inference speed
 * - Better reasoning capabilities
 * - 1M token context window
 * - Multimodal support
 */
export const AGENT_MODEL_CONFIGS: Record<string, AgentModelConfig> = {
    layoutAnalyzer: {
        gemini: GEMINI_MODELS.layoutAnalyzer,
        openrouter: AGENT_MODELS.layoutAnalyzer,
    },
    componentIdentifier: {
        gemini: GEMINI_MODELS.componentIdentifier,
        openrouter: AGENT_MODELS.componentIdentifier,
    },
    designSystemExtractor: {
        gemini: GEMINI_MODELS.designSystemExtractor,
        openrouter: AGENT_MODELS.designSystemExtractor,
    },
    interactionAnalyzer: {
        gemini: GEMINI_MODELS.interactionAnalyzer,
        openrouter: AGENT_MODELS.interactionAnalyzer,
    },
    responsiveBehavior: {
        gemini: GEMINI_MODELS.responsiveBehavior,
        openrouter: AGENT_MODELS.responsiveBehavior,
    },
    conflictResolver: {
        gemini: GEMINI_MODELS.conflictResolver,
        openrouter: AGENT_MODELS.conflictResolver,
    },
    promptSynthesizer: {
        gemini: GEMINI_MODELS.promptSynthesizer,
        openrouter: AGENT_MODELS.promptSynthesizer,
    },
    userQuestionCollector: {
        gemini: GEMINI_MODELS.userQuestionCollector,
        openrouter: AGENT_MODELS.userQuestionCollector,
    },
};

// ============ Provider Utilities ============

/**
 * Get the default LLM provider from environment
 * Default: gemini
 */
export function getDefaultProvider(): LLMProvider {
    return env.DEFAULT_LLM_PROVIDER || 'gemini';
}

/**
 * Check if a specific provider is available (has API key configured)
 */
export function isProviderAvailable(provider: LLMProvider): boolean {
    switch (provider) {
        case 'gemini':
            return gemini.isAvailable();
        case 'openrouter':
            return openrouter.isAvailable();
        default:
            return false;
    }
}

/**
 * Get the best available provider
 * Priority: configured default > gemini > openrouter
 */
export function getBestAvailableProvider(): LLMProvider | null {
    const defaultProvider = getDefaultProvider();

    // Try default provider first
    if (isProviderAvailable(defaultProvider)) {
        return defaultProvider;
    }

    // Fallback to other provider
    if (defaultProvider === 'gemini' && isProviderAvailable('openrouter')) {
        console.log('[LLM Provider] Gemini not available, falling back to OpenRouter');
        return 'openrouter';
    }

    if (defaultProvider === 'openrouter' && isProviderAvailable('gemini')) {
        console.log('[LLM Provider] OpenRouter not available, falling back to Gemini');
        return 'gemini';
    }

    return null;
}

/**
 * Get model for a specific agent and provider
 */
export function getModelForAgent(agentName: string, provider: LLMProvider): string {
    const config = AGENT_MODEL_CONFIGS[agentName];
    if (!config) {
        // Default models if agent not configured
        return provider === 'gemini' ? 'gemini-2.0-flash-exp' : 'openai/gpt-4o-mini';
    }
    return config[provider];
}

// ============ Unified LLM Client ============

class LLMProviderClient {
    /**
     * Call an LLM model with unified interface
     */
    async call(options: LLMCallOptions): Promise<LLMCallResult> {
        const {
            model,
            agentName,
            systemPrompt,
            userPrompt,
            maxTokens = 2048,
            temperature = 0.6,
            timeout = 30000,
            provider: requestedProvider,
        } = options;

        // Determine provider
        const provider = requestedProvider || getBestAvailableProvider();

        if (!provider) {
            throw new LLMProviderError(
                'No LLM provider available. Please configure GOOGLE_AI_KEY or OPENROUTER_API_KEY.',
                'NO_PROVIDER'
            );
        }

        // Determine model
        const modelToUse = model || (agentName ? getModelForAgent(agentName, provider) :
            (provider === 'gemini' ? 'gemini-2.0-flash-exp' : 'openai/gpt-4o-mini'));

        console.log(`[LLM Provider] Using ${provider} with model ${modelToUse}${agentName ? ` for agent ${agentName}` : ''}`);

        try {
            let result: GeminiCallResult | ModelCallResult;

            if (provider === 'gemini') {
                result = await gemini.call({
                    model: modelToUse,
                    systemPrompt,
                    userPrompt,
                    maxTokens,
                    temperature,
                    timeout,
                });
            } else {
                result = await openrouter.call({
                    model: modelToUse,
                    systemPrompt,
                    userPrompt,
                    maxTokens,
                    temperature,
                    timeout,
                });
            }

            return {
                content: result.content,
                tokenUsage: result.tokenUsage,
                model: result.model,
                latencyMs: result.latencyMs,
                provider,
            };
        } catch (error) {
            // Wrap provider-specific errors
            if (error instanceof GeminiError) {
                throw new LLMProviderError(
                    error.message,
                    error.code,
                    'gemini',
                    error.model
                );
            }
            if (error instanceof OpenRouterError) {
                throw new LLMProviderError(
                    error.message,
                    error.code,
                    'openrouter',
                    error.model
                );
            }
            throw error;
        }
    }

    /**
     * Call a specific agent's model
     */
    async callAgent(
        agentName: string,
        systemPrompt: string,
        userPrompt: string,
        options?: Partial<Omit<LLMCallOptions, 'agentName' | 'systemPrompt' | 'userPrompt'>>
    ): Promise<LLMCallResult> {
        return this.call({
            agentName,
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

    /**
     * Check if any provider is available
     */
    isAvailable(): boolean {
        return getBestAvailableProvider() !== null;
    }

    /**
     * Get current default provider
     */
    getDefaultProvider(): LLMProvider {
        return getDefaultProvider();
    }
}

// ============ Custom Error ============

export class LLMProviderError extends Error {
    constructor(
        message: string,
        public code: 'RATE_LIMIT' | 'AUTH_ERROR' | 'TIMEOUT' | 'SAFETY_BLOCK' | 'UNKNOWN' | 'NO_PROVIDER',
        public provider?: LLMProvider,
        public model?: string
    ) {
        super(message);
        this.name = 'LLMProviderError';
    }
}

// ============ Export Singleton ============

export const llmProvider = new LLMProviderClient();

// ============ Direct Call Function ============

export async function callLLM(
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<Omit<LLMCallOptions, 'systemPrompt' | 'userPrompt'>>
): Promise<string> {
    const result = await llmProvider.call({
        systemPrompt,
        userPrompt,
        ...options,
    });

    return result.content;
}
