/**
 * Agents Module Index
 *
 * Exports all agents, orchestration, and utilities for the multi-agent system.
 */

// Core types and utilities
export * from './core/agent.types';
export { BaseAgent, AgentExecutionError } from './core/base-agent';
export { AGENT_CONFIGS, getAgentConfig, SYSTEM_PROMPTS } from './core/agent-config';

// Providers
export { openrouter, callModel, AGENT_MODELS, OpenRouterError } from './providers/openrouter.client';
export { redisState, createSession, getOrCreateState } from './providers/redis.client';

// Visual layer agents
export { layoutAnalyzerAgent } from './visual/layout-analyzer.agent';
export { componentIdentifierAgent } from './visual/component-identifier.agent';
export { designSystemExtractorAgent } from './visual/design-system-extractor.agent';

// Resolution layer agents
export { conflictResolverAgent } from './resolution/conflict-resolver.agent';
export { userQuestionCollectorAgent } from './resolution/user-question-collector.agent';

// Synthesis layer agents
export { promptSynthesizerAgent } from './synthesis/prompt-synthesizer.agent';

// Orchestration
export { executeAgentPipeline, createAgentGraph, agentOrchestrator } from './orchestration/graph';
export { GraphState, createInitialGraphState } from './orchestration/state';
export { executeFallback, shouldTriggerFallback, createAgentError } from './orchestration/fallback';
