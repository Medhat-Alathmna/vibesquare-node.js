/**
 * Technical Pipeline State
 *
 * State management for the Technical Architecture LangGraph workflow.
 * Uses LangGraph Annotation for state definition with proper reducers.
 */

import { Annotation } from '@langchain/langgraph';
import {
  VisualPipelineResult,
  DetailLevel,
  APIStyle,
  TechnicalAgentStatusMap,
  TechnicalAgentError,
  TechnicalAgentStatus,
} from '../core/technical-agent.types';

// ============ State Annotations ============

/**
 * Technical Pipeline Graph State
 */
export const TechnicalGraphState = Annotation.Root({
  // Input from Visual Pipeline
  visualResults: Annotation<VisualPipelineResult>({
    reducer: (_, next) => next,
    default: () => ({
      finalPrompt: '',
      metadata: {
        sourceUrl: '',
        nodesFound: 0,
        layoutType: '',
        difficulty: '',
        language: '',
        processingTimeMs: 0,
        agentsUsed: [],
        fallbackTriggered: false,
      },
    }),
  }),

  // User options
  detailLevel: Annotation<DetailLevel>({
    reducer: (_, next) => next,
    default: () => 'detailed',
  }),

  apiStyle: Annotation<APIStyle>({
    reducer: (_, next) => next,
    default: () => 'REST',
  }),

  // Pipeline start time
  startTime: Annotation<number>({
    reducer: (_, next) => next,
    default: () => Date.now(),
  }),

  // Layer 1 outputs
  databaseSchema: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Layer 2 outputs
  backendArchitecture: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  securityRecommendations: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  testingStrategy: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  devopsConfig: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  userStories: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Layer 3 outputs
  validationResult: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  qaReview: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // QA iteration tracking
  qaIterations: Annotation<number>({
    reducer: (current, next) => next,
    default: () => 0,
  }),

  // QA approval status
  qaApproved: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // Final PRD output
  finalPRD: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Errors (accumulative)
  errors: Annotation<TechnicalAgentError[]>({
    reducer: (current, next) => [...current, ...next],
    default: () => [],
  }),

  // Agent status tracking
  agentStatus: Annotation<Partial<TechnicalAgentStatusMap>>({
    reducer: (current, next) => ({ ...current, ...next }),
    default: () => ({
      database: 'pending',
      backend: 'pending',
      security: 'pending',
      testing: 'pending',
      devops: 'pending',
      userStory: 'pending',
      prdValidator: 'pending',
      qa: 'pending',
      prdSynthesizer: 'pending',
    }),
  }),

  // Processing metadata
  tokenUsage: Annotation<number>({
    reducer: (current, next) => current + next,
    default: () => 0,
  }),
});

// Type export for state
export type TechnicalGraphStateType = typeof TechnicalGraphState.State;

// ============ Helper Functions ============

/**
 * Create initial state for the technical pipeline
 */
export function createInitialTechnicalState(
  visualResults: VisualPipelineResult,
  detailLevel: DetailLevel,
  apiStyle?: APIStyle
): TechnicalGraphStateType {
  return {
    visualResults,
    detailLevel,
    apiStyle: apiStyle || 'REST',
    startTime: Date.now(),
    databaseSchema: undefined,
    backendArchitecture: undefined,
    securityRecommendations: undefined,
    testingStrategy: undefined,
    devopsConfig: undefined,
    userStories: undefined,
    validationResult: undefined,
    qaReview: undefined,
    qaIterations: 0,
    qaApproved: false,
    finalPRD: undefined,
    errors: [],
    agentStatus: {
      database: 'pending',
      backend: 'pending',
      security: 'pending',
      testing: 'pending',
      devops: 'pending',
      userStory: 'pending',
      prdValidator: 'pending',
      qa: 'pending',
      prdSynthesizer: 'pending',
    },
    tokenUsage: 0,
  };
}

/**
 * Check if a critical agent has failed
 */
export function hasCriticalTechnicalAgentFailed(state: TechnicalGraphStateType): boolean {
  // Database is critical - without it, we can't proceed
  if (state.agentStatus.database === 'failed') {
    return true;
  }

  // Check for critical errors
  return state.errors.some((e) => e.isCritical);
}

/**
 * Get list of completed agents
 */
export function getCompletedTechnicalAgents(state: TechnicalGraphStateType): string[] {
  const completed: string[] = [];

  if (state.agentStatus.database === 'completed') completed.push('database');
  if (state.agentStatus.backend === 'completed') completed.push('backend');
  if (state.agentStatus.security === 'completed') completed.push('security');
  if (state.agentStatus.testing === 'completed') completed.push('testing');
  if (state.agentStatus.devops === 'completed') completed.push('devops');
  if (state.agentStatus.userStory === 'completed') completed.push('userStory');
  if (state.agentStatus.prdValidator === 'completed') completed.push('prdValidator');
  if (state.agentStatus.qa === 'completed') completed.push('qa');
  if (state.agentStatus.prdSynthesizer === 'completed') completed.push('prdSynthesizer');

  return completed;
}

/**
 * Check if Layer 2 is complete
 */
export function isLayer2Complete(state: TechnicalGraphStateType): boolean {
  const layer2Agents = ['backend', 'security', 'testing', 'devops', 'userStory'] as const;

  // At least backend must complete (it's the most important)
  if (state.agentStatus.backend !== 'completed' && state.agentStatus.backend !== 'skipped') {
    return false;
  }

  // Check that all agents are either completed, failed, or skipped
  return layer2Agents.every((agent) =>
    ['completed', 'failed', 'skipped'].includes(state.agentStatus[agent] || 'pending')
  );
}

/**
 * Create error object for agent
 */
export function createTechnicalAgentError(
  agentName: string,
  error: Error,
  isCritical: boolean
): TechnicalAgentError {
  return {
    agentName,
    message: error.message,
    type: 'unknown',
    isCritical,
    timestamp: new Date(),
  };
}
