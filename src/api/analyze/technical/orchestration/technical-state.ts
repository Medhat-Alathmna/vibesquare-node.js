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
  ProductIdentity,
  PipelineConfidenceState,
  ClarificationQuestion,
  ClarificationResponse,
  AgentConfidenceScore,
  InferenceConfidence,
  CONFIDENCE_THRESHOLDS,
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

  // Layer 0 outputs (Identity)
  identity: Annotation<ProductIdentity | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  identityXml: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  identityConfidence: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
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

  skepticReview: Annotation<string | undefined>({
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

  // Per-inference confidence (accumulative from all agents)
  allInferences: Annotation<InferenceConfidence[]>({
    reducer: (current, next) => [...current, ...next],
    default: () => [],
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
      identity: 'pending',
      database: 'pending',
      backend: 'pending',
      testing: 'pending',
      devops: 'pending',
      userStory: 'pending',
      prdValidator: 'pending',
      skeptic: 'pending',
      qa: 'pending',
      prdSynthesizer: 'pending',
    }),
  }),

  // Processing metadata
  tokenUsage: Annotation<number>({
    reducer: (current, next) => current + next,
    default: () => 0,
  }),

  // Confidence Scoring System
  confidenceState: Annotation<PipelineConfidenceState>({
    reducer: (current, next) => ({
      ...current,
      ...next,
      agentConfidences: { ...current.agentConfidences, ...next.agentConfidences },
      pendingQuestions: [...(next.pendingQuestions || current.pendingQuestions)],
      resolvedQuestions: [...current.resolvedQuestions, ...(next.resolvedQuestions || [])],
    }),
    default: () => ({
      overallConfidence: 0,
      agentConfidences: {},
      needsClarification: false,
      pendingQuestions: [],
      resolvedQuestions: [],
      confidenceThreshold: CONFIDENCE_THRESHOLDS.REQUIRE_CLARIFICATION,
    }),
  }),

  // Flag to pause for user clarification
  awaitingClarification: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // User-provided clarifications
  userClarifications: Annotation<ClarificationResponse[]>({
    reducer: (current, next) => [...current, ...next],
    default: () => [],
  }),

  // Pre-formatted clarifications text for agent prompts
  clarificationsText: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
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
  apiStyle?: APIStyle,
  confidenceThreshold?: number,
  clarificationsText?: string
): TechnicalGraphStateType {
  return {
    visualResults,
    detailLevel,
    apiStyle: apiStyle || 'REST',
    startTime: Date.now(),
    identity: undefined,
    identityXml: undefined,
    identityConfidence: 0,
    databaseSchema: undefined,
    backendArchitecture: undefined,
    testingStrategy: undefined,
    devopsConfig: undefined,
    userStories: undefined,
    validationResult: undefined,
    skepticReview: undefined,
    qaReview: undefined,
    qaIterations: 0,
    qaApproved: false,
    finalPRD: undefined,
    allInferences: [],
    errors: [],
    agentStatus: {
      identity: 'pending',
      database: 'pending',
      backend: 'pending',
      testing: 'pending',
      devops: 'pending',
      userStory: 'pending',
      prdValidator: 'pending',
      skeptic: 'pending',
      qa: 'pending',
      prdSynthesizer: 'pending',
    },
    tokenUsage: 0,
    confidenceState: {
      overallConfidence: 0,
      agentConfidences: {},
      needsClarification: false,
      pendingQuestions: [],
      resolvedQuestions: [],
      confidenceThreshold: confidenceThreshold || CONFIDENCE_THRESHOLDS.REQUIRE_CLARIFICATION,
    },
    awaitingClarification: false,
    userClarifications: [],
    clarificationsText: clarificationsText || '',
  };
}

/**
 * Check if a critical agent has failed
 */
export function hasCriticalTechnicalAgentFailed(state: TechnicalGraphStateType): boolean {
  // Identity is critical - it provides foundational context
  if (state.agentStatus.identity === 'failed') {
    return true;
  }

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

  if (state.agentStatus.identity === 'completed') completed.push('identity');
  if (state.agentStatus.database === 'completed') completed.push('database');
  if (state.agentStatus.backend === 'completed') completed.push('backend');
  if (state.agentStatus.testing === 'completed') completed.push('testing');
  if (state.agentStatus.devops === 'completed') completed.push('devops');
  if (state.agentStatus.userStory === 'completed') completed.push('userStory');
  if (state.agentStatus.prdValidator === 'completed') completed.push('prdValidator');
  if (state.agentStatus.skeptic === 'completed') completed.push('skeptic');
  if (state.agentStatus.qa === 'completed') completed.push('qa');
  if (state.agentStatus.prdSynthesizer === 'completed') completed.push('prdSynthesizer');

  return completed;
}

/**
 * Check if Layer 0 is complete (Identity)
 */
export function isLayer0Complete(state: TechnicalGraphStateType): boolean {
  return (
    state.agentStatus.identity === 'completed' ||
    state.agentStatus.identity === 'failed' ||
    state.agentStatus.identity === 'skipped'
  );
}

/**
 * Check if Layer 1 is complete (Database)
 */
export function isLayer1Complete(state: TechnicalGraphStateType): boolean {
  return (
    state.agentStatus.database === 'completed' ||
    state.agentStatus.database === 'failed' ||
    state.agentStatus.database === 'skipped'
  );
}

/**
 * Check if Layer 2 is complete
 */
export function isLayer2Complete(state: TechnicalGraphStateType): boolean {
  const layer2Agents = ['backend', 'testing', 'devops', 'userStory'] as const;

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

// ============ Confidence Scoring Helpers ============

/**
 * Check if any critical agent has low confidence that needs clarification
 */
export function needsUserClarification(state: TechnicalGraphStateType): boolean {
  const { confidenceState } = state;

  // Check if already awaiting clarification
  if (state.awaitingClarification) {
    return true;
  }

  // Check identity confidence (most critical)
  if (state.identityConfidence > 0 && state.identityConfidence < confidenceState.confidenceThreshold) {
    return true;
  }

  // Check all agent confidences
  for (const [agentName, confidence] of Object.entries(confidenceState.agentConfidences)) {
    if (confidence.overallScore < confidenceState.confidenceThreshold) {
      return true;
    }
  }

  return false;
}

/**
 * Update agent confidence in state
 */
export function updateAgentConfidence(
  state: TechnicalGraphStateType,
  agentConfidence: AgentConfidenceScore
): Partial<TechnicalGraphStateType> {
  const newAgentConfidences = {
    ...state.confidenceState.agentConfidences,
    [agentConfidence.agentName]: agentConfidence,
  };

  // Calculate overall confidence (weighted average, identity has 2x weight)
  const weights: Record<string, number> = {
    identity: 2,
    database: 1.5,
    userStory: 1.5,
    backend: 1,
    security: 1,
    testing: 0.5,
    devops: 0.5,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [name, confidence] of Object.entries(newAgentConfidences)) {
    const weight = weights[name] || 1;
    totalWeight += weight;
    weightedSum += confidence.overallScore * weight;
  }

  const overallConfidence = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // Collect all pending questions from low confidence agents
  const pendingQuestions: ClarificationQuestion[] = [];
  for (const [name, confidence] of Object.entries(newAgentConfidences)) {
    if (confidence.overallScore < state.confidenceState.confidenceThreshold) {
      confidence.suggestedQuestions.forEach((q, idx) => {
        pendingQuestions.push({
          id: `${name}-q${idx}`,
          question: q,
          context: confidence.lowConfidenceAreas[idx] || 'Needs clarification',
          agentName: name,
          options: [],
          allowMultiple: false,
          allowCustom: true,
          priority: confidence.overallScore < 50 ? 'critical' : 'important',
        });
      });
    }
  }

  return {
    confidenceState: {
      ...state.confidenceState,
      agentConfidences: newAgentConfidences,
      overallConfidence,
      needsClarification: overallConfidence < state.confidenceState.confidenceThreshold,
      pendingQuestions,
    },
  };
}

/**
 * Get summary of confidence scores for display
 */
export function getConfidenceSummary(state: TechnicalGraphStateType): {
  overall: number;
  agents: Array<{ name: string; score: number; level: string }>;
  lowConfidenceAreas: string[];
} {
  const { confidenceState } = state;

  const agents = Object.entries(confidenceState.agentConfidences).map(([name, conf]) => ({
    name,
    score: conf.overallScore,
    level: conf.level,
  }));

  const lowConfidenceAreas: string[] = [];
  for (const conf of Object.values(confidenceState.agentConfidences)) {
    lowConfidenceAreas.push(...conf.lowConfidenceAreas);
  }

  return {
    overall: confidenceState.overallConfidence,
    agents,
    lowConfidenceAreas,
  };
}
