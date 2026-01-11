/**
 * Google Gemini Client
 *
 * Provides a unified interface to call Google Gemini API directly.
 * Supports Gemini 2.0, Gemini 1.5 Pro, and Gemini 1.5 Flash models.
 */

import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';
import { env } from '../../../../config/env';

// ============ Types ============

export interface GeminiCallOptions {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
}

export interface GeminiCallResult {
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

/**
 * Available Gemini models with their capabilities
 * - gemini-3-flash-preview: The latest frontier-class flash model, extremely fast with agentic capabilities.
 * - gemini-3-pro-preview: The most capable model for complex reasoning and large context.
 */
export const GEMINI_MODELS = {
    // Primary models for different agent types using Gemini 3
    layoutAnalyzer: 'gemini-3-flash-preview',
    componentIdentifier: 'gemini-3-flash-preview',
    designSystemExtractor: 'gemini-3-pro-preview',
    interactionAnalyzer: 'gemini-3-flash-preview',
    responsiveBehavior: 'gemini-3-flash-preview',
    conflictResolver: 'gemini-3-pro-preview',
    promptSynthesizer: 'gemini-3-pro-preview',
    userQuestionCollector: 'gemini-3-flash-preview',
} as const;

export type GeminiAgentName = keyof typeof GEMINI_MODELS;

// ============ Gemini Client ============

class GeminiClient {
    private client: GoogleGenerativeAI | null = null;
    private modelCache: Map<string, GenerativeModel> = new Map();

    /**
     * Initialize the Gemini client
     */
    private getClient(): GoogleGenerativeAI {
        if (!this.client) {
            const apiKey = env.GOOGLE_AI_KEY;

            if (!apiKey) {
                throw new Error('GOOGLE_AI_KEY is not configured');
            }

            this.client = new GoogleGenerativeAI(apiKey);
        }

        return this.client;
    }

    /**
     * Get or create a GenerativeModel instance
     */
    private getModel(modelName: string): GenerativeModel {
        if (!this.modelCache.has(modelName)) {
            const client = this.getClient();
            const model = client.getGenerativeModel({ model: modelName });
            this.modelCache.set(modelName, model);
        }

        return this.modelCache.get(modelName)!;
    }

    /**
     * Check if Gemini is configured
     */
    isAvailable(): boolean {
        return !!env.GOOGLE_AI_KEY;
    }

    /**
     * Call a model via Gemini API
     */
    async call(options: GeminiCallOptions): Promise<GeminiCallResult> {
        const {
            model: modelName,
            systemPrompt,
            userPrompt,
            maxTokens = 2048,
            temperature = 0.6,
            timeout = 30000,
        } = options;

        const startTime = Date.now();

        try {
            const model = this.getModel(modelName);

            // Configure generation parameters
            const generationConfig: GenerationConfig = {
                maxOutputTokens: maxTokens,
                temperature,
            };

            // Create the chat with system instruction
            const chat = model.startChat({
                generationConfig,
                history: [],
                // System instruction for Gemini
            });

            // Combine system prompt with user prompt for Gemini's format
            const fullPrompt = `${systemPrompt}\n\n---\n\nUser Request:\n${userPrompt}`;

            // Make the request with timeout
            const responsePromise = chat.sendMessage(fullPrompt);

            const response = await Promise.race([
                responsePromise,
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`Model call timed out after ${timeout}ms`)), timeout)
                ),
            ]);

            const latencyMs = Date.now() - startTime;
            const content = response.response.text();

            // Get token usage from response metadata
            const usageMetadata = response.response.usageMetadata;

            return {
                content,
                tokenUsage: {
                    prompt: usageMetadata?.promptTokenCount || 0,
                    completion: usageMetadata?.candidatesTokenCount || 0,
                    total: usageMetadata?.totalTokenCount || 0,
                },
                model: modelName,
                latencyMs,
            };
        } catch (error) {
            const latencyMs = Date.now() - startTime;

            if (error instanceof Error) {
                // Handle specific Gemini errors
                if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429')) {
                    throw new GeminiError('Rate limit exceeded', 'RATE_LIMIT', modelName);
                }
                if (error.message.includes('API_KEY') || error.message.includes('401') || error.message.includes('PERMISSION_DENIED')) {
                    throw new GeminiError('Invalid API key', 'AUTH_ERROR', modelName);
                }
                if (error.message.includes('timed out')) {
                    throw new GeminiError(`Request timed out after ${latencyMs}ms`, 'TIMEOUT', modelName);
                }
                if (error.message.includes('SAFETY')) {
                    throw new GeminiError('Content blocked by safety filters', 'SAFETY_BLOCK', modelName);
                }

                throw new GeminiError(error.message, 'UNKNOWN', modelName);
            }

            throw new GeminiError('Unknown error occurred', 'UNKNOWN', modelName);
        }
    }

    /**
     * Call a specific agent's model
     */
    async callAgent(
        agentName: GeminiAgentName,
        systemPrompt: string,
        userPrompt: string,
        options?: Partial<Omit<GeminiCallOptions, 'model' | 'systemPrompt' | 'userPrompt'>>
    ): Promise<GeminiCallResult> {
        const model = GEMINI_MODELS[agentName];

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

export class GeminiError extends Error {
    constructor(
        message: string,
        public code: 'RATE_LIMIT' | 'AUTH_ERROR' | 'TIMEOUT' | 'SAFETY_BLOCK' | 'UNKNOWN',
        public model: string
    ) {
        super(message);
        this.name = 'GeminiError';
    }
}

// ============ Export Singleton ============

export const gemini = new GeminiClient();

// ============ Direct Call Function ============

export async function callGeminiModel(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 2048
): Promise<string> {
    const result = await gemini.call({
        model,
        systemPrompt,
        userPrompt,
        maxTokens,
    });

    return result.content;
}
