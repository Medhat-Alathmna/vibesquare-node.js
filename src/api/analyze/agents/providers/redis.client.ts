/**
 * Redis State Client
 *
 * Provides state management for the multi-agent pipeline.
 * Uses Redis for persistent state storage with in-memory fallback.
 */

import Redis from 'ioredis';
import { env } from '../../../../config/env';
import { AgentState, AgentStatus, AgentError } from '../core/agent.types';

// ============ Types ============

export interface StateOptions {
  ttlSeconds?: number;
  prefix?: string;
}

// ============ Default State ============

export function createInitialState(
  parsedDOM: AgentState['parsedDOM'],
  structuralAnalysis: AgentState['structuralAnalysis']
): AgentState {
  return {
    parsedDOM,
    structuralAnalysis,
    errors: [],
    agentStatus: {
      layoutAnalyzer: 'pending',
      componentIdentifier: 'pending',
      designSystemExtractor: 'pending',
      interactionAnalyzer: 'pending',
      responsiveBehavior: 'pending',
      conflictResolver: 'pending',
      promptSynthesizer: 'pending',
      userQuestionCollector: 'pending',
    },
    fallbackTriggered: false,
    startTime: Date.now(),
  };
}

// ============ Redis State Client ============

class RedisStateClient {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private inMemoryStore: Map<string, string> = new Map();
  private defaultTTL: number = 3600; // 1 hour
  private keyPrefix: string = 'vibesquare:agent:';

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<boolean> {
    if (this.isConnected && this.client) {
      return true;
    }

    const redisUrl = env.REDIS_URL;

    if (!redisUrl) {
      console.warn('REDIS_URL not configured, using in-memory state');
      return false;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('Redis connection failed, falling back to in-memory');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true,
      });

      await this.client.connect();
      this.isConnected = true;
      console.log('Redis connected successfully');
      return true;
    } catch (error) {
      console.warn('Failed to connect to Redis, using in-memory state:', error);
      this.client = null;
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Get the full key with prefix
   */
  private getKey(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  /**
   * Save state to Redis or in-memory
   */
  async saveState(sessionId: string, state: AgentState, ttlSeconds?: number): Promise<void> {
    const key = this.getKey(sessionId);
    const serialized = JSON.stringify(state);
    const ttl = ttlSeconds || this.defaultTTL;

    if (this.client && this.isConnected) {
      try {
        await this.client.setex(key, ttl, serialized);
        return;
      } catch (error) {
        console.warn('Redis save failed, using in-memory:', error);
      }
    }

    // Fallback to in-memory
    this.inMemoryStore.set(key, serialized);

    // Auto-cleanup after TTL
    setTimeout(() => {
      this.inMemoryStore.delete(key);
    }, ttl * 1000);
  }

  /**
   * Load state from Redis or in-memory
   */
  async loadState(sessionId: string): Promise<AgentState | null> {
    const key = this.getKey(sessionId);

    if (this.client && this.isConnected) {
      try {
        const data = await this.client.get(key);
        if (data) {
          return JSON.parse(data) as AgentState;
        }
      } catch (error) {
        console.warn('Redis load failed, trying in-memory:', error);
      }
    }

    // Fallback to in-memory
    const data = this.inMemoryStore.get(key);
    if (data) {
      return JSON.parse(data) as AgentState;
    }

    return null;
  }

  /**
   * Update agent status in state
   */
  async updateAgentStatus(
    sessionId: string,
    agentName: string,
    status: AgentStatus
  ): Promise<void> {
    const state = await this.loadState(sessionId);
    if (!state) {
      throw new Error(`State not found for session: ${sessionId}`);
    }

    state.agentStatus[agentName] = status;
    await this.saveState(sessionId, state);
  }

  /**
   * Add an error to state
   */
  async addError(
    sessionId: string,
    error: AgentError
  ): Promise<void> {
    const state = await this.loadState(sessionId);
    if (!state) {
      throw new Error(`State not found for session: ${sessionId}`);
    }

    state.errors.push(error);
    await this.saveState(sessionId, state);
  }

  /**
   * Update a specific field in state
   */
  async updateField<K extends keyof AgentState>(
    sessionId: string,
    field: K,
    value: AgentState[K]
  ): Promise<void> {
    const state = await this.loadState(sessionId);
    if (!state) {
      throw new Error(`State not found for session: ${sessionId}`);
    }

    state[field] = value;
    await this.saveState(sessionId, state);
  }

  /**
   * Delete state
   */
  async deleteState(sessionId: string): Promise<void> {
    const key = this.getKey(sessionId);

    if (this.client && this.isConnected) {
      try {
        await this.client.del(key);
      } catch (error) {
        console.warn('Redis delete failed:', error);
      }
    }

    this.inMemoryStore.delete(key);
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; mode: 'redis' | 'memory' } {
    return {
      connected: this.isConnected,
      mode: this.isConnected ? 'redis' : 'memory',
    };
  }
}

// ============ Export Singleton ============

export const redisState = new RedisStateClient();

// ============ Helper Functions ============

/**
 * Create a new session with initial state
 */
export async function createSession(
  parsedDOM: AgentState['parsedDOM'],
  structuralAnalysis: AgentState['structuralAnalysis']
): Promise<{ sessionId: string; state: AgentState }> {
  const sessionId = redisState.generateSessionId();
  const state = createInitialState(parsedDOM, structuralAnalysis);

  await redisState.saveState(sessionId, state);

  return { sessionId, state };
}

/**
 * Get or create state for a session
 */
export async function getOrCreateState(
  sessionId: string | undefined,
  parsedDOM: AgentState['parsedDOM'],
  structuralAnalysis: AgentState['structuralAnalysis']
): Promise<{ sessionId: string; state: AgentState }> {
  if (sessionId) {
    const existingState = await redisState.loadState(sessionId);
    if (existingState) {
      return { sessionId, state: existingState };
    }
  }

  return createSession(parsedDOM, structuralAnalysis);
}
