/**
 * Agent State Management
 *
 * Defines the state schema and reducers for the LangGraph workflow.
 */

import { Annotation } from '@langchain/langgraph';
import {
  AgentState,
  AgentStatus,
  AgentError,
  AgentOutput,
  LayoutAnalysisOutput,
  ComponentIdentificationOutput,
  DesignSystemOutput,
  InteractionAnalysisOutput,
  ResponsiveBehaviorOutput,
  ConflictResolverOutput,
  PromptSynthesizerOutput,
  UserQuestionCollectorOutput,
  Ambiguity,
  UserQuestion,
} from '../core/agent.types';
import { RawParsedDOM, StructuralAnalysis } from '../../pipeline/ir.types';

// ============ State Annotation ============

/**
 * LangGraph State Annotation
 * Defines the state schema with proper reducers for parallel execution
 */
export const GraphState = Annotation.Root({
  // Input data (immutable)
  parsedDOM: Annotation<RawParsedDOM>({
    reducer: (_, next) => next,
    default: () => ({} as RawParsedDOM),
  }),

  structuralAnalysis: Annotation<StructuralAnalysis>({
    reducer: (_, next) => next,
    default: () => ({} as StructuralAnalysis),
  }),

  // Visual layer outputs
  layoutAnalysis: Annotation<AgentOutput<LayoutAnalysisOutput> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  componentIdentification: Annotation<AgentOutput<ComponentIdentificationOutput> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  designSystem: Annotation<AgentOutput<DesignSystemOutput> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Behavioral layer outputs
  interactionAnalysis: Annotation<AgentOutput<InteractionAnalysisOutput> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  responsiveBehavior: Annotation<AgentOutput<ResponsiveBehaviorOutput> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Resolution layer outputs
  conflictResolution: Annotation<AgentOutput<ConflictResolverOutput> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Synthesis layer outputs
  promptSynthesis: Annotation<AgentOutput<PromptSynthesizerOutput> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  userQuestions: Annotation<AgentOutput<UserQuestionCollectorOutput> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Meta state
  errors: Annotation<AgentError[]>({
    reducer: (current, next) => [...current, ...next],
    default: () => [],
  }),

  agentStatus: Annotation<Record<string, AgentStatus>>({
    reducer: (current, next) => ({ ...current, ...next }),
    default: () => ({
      layoutAnalyzer: 'pending',
      componentIdentifier: 'pending',
      designSystemExtractor: 'pending',
      interactionAnalyzer: 'pending',
      responsiveBehavior: 'pending',
      conflictResolver: 'pending',
      promptSynthesizer: 'pending',
      userQuestionCollector: 'pending',
    }),
  }),

  fallbackTriggered: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  startTime: Annotation<number>({
    reducer: (current, next) => current || next,
    default: () => Date.now(),
  }),

  // Final outputs
  finalPrompt: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  questionsForUser: Annotation<UserQuestion[] | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

// ============ Type Exports ============

export type GraphStateType = typeof GraphState.State;

// ============ State Helpers ============

/**
 * Create initial state from input
 */
export function createInitialGraphState(
  parsedDOM: RawParsedDOM,
  structuralAnalysis: StructuralAnalysis
): Partial<GraphStateType> {
  return {
    parsedDOM,
    structuralAnalysis,
    startTime: Date.now(),
  };
}

/**
 * Check if critical agents have completed
 */
export function areCriticalAgentsComplete(state: GraphStateType): boolean {
  const criticalAgents = ['layoutAnalyzer', 'componentIdentifier', 'conflictResolver', 'promptSynthesizer'];
  return criticalAgents.every(
    (agent) => state.agentStatus[agent] === 'completed' || state.agentStatus[agent] === 'failed'
  );
}

/**
 * Check if any critical agent has failed
 */
export function hasCriticalAgentFailed(state: GraphStateType): boolean {
  const criticalAgents = ['conflictResolver', 'promptSynthesizer'];
  return criticalAgents.some((agent) => state.agentStatus[agent] === 'failed');
}

/**
 * Collect all ambiguities from agent outputs
 */
export function collectAllAmbiguities(state: GraphStateType): Ambiguity[] {
  const ambiguities: Ambiguity[] = [];

  if (state.layoutAnalysis?.ambiguities) {
    ambiguities.push(...state.layoutAnalysis.ambiguities);
  }
  if (state.componentIdentification?.ambiguities) {
    ambiguities.push(...state.componentIdentification.ambiguities);
  }
  if (state.designSystem?.ambiguities) {
    ambiguities.push(...state.designSystem.ambiguities);
  }
  if (state.interactionAnalysis?.ambiguities) {
    ambiguities.push(...state.interactionAnalysis.ambiguities);
  }
  if (state.responsiveBehavior?.ambiguities) {
    ambiguities.push(...state.responsiveBehavior.ambiguities);
  }

  return ambiguities;
}

/**
 * Calculate total token usage
 */
export function calculateTotalTokenUsage(state: GraphStateType): number {
  let total = 0;

  if (state.layoutAnalysis?.tokenUsage) total += state.layoutAnalysis.tokenUsage;
  if (state.componentIdentification?.tokenUsage) total += state.componentIdentification.tokenUsage;
  if (state.designSystem?.tokenUsage) total += state.designSystem.tokenUsage;
  if (state.interactionAnalysis?.tokenUsage) total += state.interactionAnalysis.tokenUsage;
  if (state.responsiveBehavior?.tokenUsage) total += state.responsiveBehavior.tokenUsage;
  if (state.conflictResolution?.tokenUsage) total += state.conflictResolution.tokenUsage;
  if (state.promptSynthesis?.tokenUsage) total += state.promptSynthesis.tokenUsage;
  if (state.userQuestions?.tokenUsage) total += state.userQuestions.tokenUsage;

  return total;
}

/**
 * Get list of completed agents
 */
export function getCompletedAgents(state: GraphStateType): string[] {
  return Object.entries(state.agentStatus)
    .filter(([_, status]) => status === 'completed')
    .map(([name]) => name);
}
