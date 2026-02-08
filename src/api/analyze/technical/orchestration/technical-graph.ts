/**
 * Technical Pipeline LangGraph Workflow
 *
 * Orchestrates all technical agents in the proper sequence:
 * Layer 0 (Identity) → Layer 1 (Database) → Layer 2 (Backend, Security, Testing, DevOps, User Story in parallel)
 * → Layer 3 (Validator, QA with iteration loop) → PRD Synthesizer
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import {
  TechnicalGraphState,
  TechnicalGraphStateType,
  createInitialTechnicalState,
  createTechnicalAgentError,
  hasCriticalTechnicalAgentFailed,
  getCompletedTechnicalAgents,
  isLayer0Complete,
  isLayer1Complete,
  isLayer2Complete,
  updateAgentConfidence,
  needsUserClarification,
  getConfidenceSummary,
} from './technical-state';
import {
  VisualPipelineResult,
  DetailLevel,
  APIStyle,
  TechnicalAgentInput,
  TechnicalPipelineResult,
  ClarificationQuestion,
  ClarificationResponse,
} from '../core/technical-agent.types';
import { formatClarificationsForPrompt } from './clarification-generator';
import { TechnicalAgentExecutionError } from '../core/base-technical-agent';

// Import agents
import { identityAgent } from '../agents/layer-0/identity.agent';
import { databaseAgent } from '../agents/layer-1/database.agent';
import { backendAgent } from '../agents/layer-2/backend.agent';
import { testingAgent } from '../agents/layer-2/testing.agent';
import { devopsAgent } from '../agents/layer-2/devops.agent';
import { userStoryAgent } from '../agents/layer-2/user-story.agent';
import { prdValidatorAgent } from '../agents/layer-3/prd-validator.agent';
import { skepticAgent } from '../agents/layer-3/skeptic.agent';
import { qaAgent } from '../agents/layer-3/qa.agent';

// ============ Node Functions ============

/**
 * Identity Agent Node (Layer 0)
 * Extracts product vision, problem statement, value proposition, and AI coder context
 */
async function identityAgentNode(state: TechnicalGraphStateType): Promise<Partial<TechnicalGraphStateType>> {
  console.log('[Technical Pipeline] Running Identity Agent (Layer 0)...');

  try {
    const input: TechnicalAgentInput = {
      visualResults: state.visualResults,
      detailLevel: state.detailLevel,
      clarificationsText: state.clarificationsText || undefined,
    };

    const result = await identityAgent.executeWithRetry(input);

    console.log(`[Technical Pipeline] Identity Agent completed with ${result.data.confidence}% confidence`);

    // Generate confidence breakdown with suggested questions for low confidence
    const confidenceBreakdown = identityAgent.generateConfidenceBreakdown(result.data);

    // Update confidence state
    const confidenceUpdate = updateAgentConfidence(state, confidenceBreakdown);

    // Log low confidence areas if any
    if (confidenceBreakdown.lowConfidenceAreas.length > 0) {
      console.log(`[Technical Pipeline] Low confidence areas: ${confidenceBreakdown.lowConfidenceAreas.join(', ')}`);
      console.log(`[Technical Pipeline] Suggested questions: ${confidenceBreakdown.suggestedQuestions.length}`);
    }

    return {
      identity: result.data.identity,
      identityXml: result.xml,
      identityConfidence: result.data.confidence,
      agentStatus: { identity: 'completed' },
      tokenUsage: result.tokenUsage,
      allInferences: result.inferences,
      ...confidenceUpdate,
    };
  } catch (error) {
    const agentError = createTechnicalAgentError(
      'identity',
      error instanceof Error ? error : new Error('Unknown error'),
      true // Identity is critical - provides foundational context
    );

    console.error('[Technical Pipeline] Identity Agent failed:', error);

    return {
      errors: [agentError],
      agentStatus: { identity: 'failed' },
    };
  }
}

/**
 * Database Agent Node (Layer 1)
 */
async function databaseAgentNode(state: TechnicalGraphStateType): Promise<Partial<TechnicalGraphStateType>> {
  console.log('[Technical Pipeline] Running Database Agent...');

  try {
    const input: TechnicalAgentInput = {
      visualResults: state.visualResults,
      detailLevel: state.detailLevel,
      productIdentity: state.identity,
      previousOutputs: {
        identity: state.identityXml,
      },
      clarificationsText: state.clarificationsText || undefined,
    };

    const result = await databaseAgent.executeWithRetry(input);

    return {
      databaseSchema: result.xml,
      agentStatus: { database: 'completed' },
      tokenUsage: result.tokenUsage,
      allInferences: result.inferences,
    };
  } catch (error) {
    const agentError = createTechnicalAgentError(
      'database',
      error instanceof Error ? error : new Error('Unknown error'),
      true // Database is critical
    );

    console.error('[Technical Pipeline] Database Agent failed:', error);

    return {
      errors: [agentError],
      agentStatus: { database: 'failed' },
    };
  }
}

/**
 * Backend Agent Node (Layer 2)
 */
async function backendAgentNode(state: TechnicalGraphStateType): Promise<Partial<TechnicalGraphStateType>> {
  console.log('[Technical Pipeline] Running Backend Agent...');

  try {
    const input: TechnicalAgentInput = {
      visualResults: state.visualResults,
      detailLevel: state.detailLevel,
      apiStyle: state.apiStyle,
      previousOutputs: {
        databaseSchema: state.databaseSchema,
      },
      clarificationsText: state.clarificationsText || undefined,
    };

    const result = await backendAgent.executeWithRetry(input);

    return {
      backendArchitecture: result.xml,
      agentStatus: { backend: 'completed' },
      tokenUsage: result.tokenUsage,
      allInferences: result.inferences,
    };
  } catch (error) {
    const agentError = createTechnicalAgentError(
      'backend',
      error instanceof Error ? error : new Error('Unknown error'),
      false
    );

    console.warn('[Technical Pipeline] Backend Agent failed, skipping:', error);

    return {
      errors: [agentError],
      agentStatus: { backend: 'failed' },
    };
  }
}

/**
 * Testing Agent Node (Layer 2)
 */
async function testingAgentNode(state: TechnicalGraphStateType): Promise<Partial<TechnicalGraphStateType>> {
  console.log('[Technical Pipeline] Running Testing Agent...');

  try {
    const input: TechnicalAgentInput = {
      visualResults: state.visualResults,
      detailLevel: state.detailLevel,
      apiStyle: state.apiStyle,
      previousOutputs: {
        databaseSchema: state.databaseSchema,
        backendArchitecture: state.backendArchitecture,
      },
      clarificationsText: state.clarificationsText || undefined,
    };

    const result = await testingAgent.executeWithRetry(input);

    return {
      testingStrategy: result.xml,
      agentStatus: { testing: 'completed' },
      tokenUsage: result.tokenUsage,
      allInferences: result.inferences,
    };
  } catch (error) {
    const agentError = createTechnicalAgentError(
      'testing',
      error instanceof Error ? error : new Error('Unknown error'),
      false
    );

    console.warn('[Technical Pipeline] Testing Agent failed, skipping:', error);

    return {
      errors: [agentError],
      agentStatus: { testing: 'failed' },
    };
  }
}

/**
 * DevOps Agent Node (Layer 2)
 */
async function devopsAgentNode(state: TechnicalGraphStateType): Promise<Partial<TechnicalGraphStateType>> {
  console.log('[Technical Pipeline] Running DevOps Agent...');

  try {
    const input: TechnicalAgentInput = {
      visualResults: state.visualResults,
      detailLevel: state.detailLevel,
      apiStyle: state.apiStyle,
      previousOutputs: {
        databaseSchema: state.databaseSchema,
      },
      clarificationsText: state.clarificationsText || undefined,
    };

    const result = await devopsAgent.executeWithRetry(input);

    return {
      devopsConfig: result.xml,
      agentStatus: { devops: 'completed' },
      tokenUsage: result.tokenUsage,
      allInferences: result.inferences,
    };
  } catch (error) {
    const agentError = createTechnicalAgentError(
      'devops',
      error instanceof Error ? error : new Error('Unknown error'),
      false
    );

    console.warn('[Technical Pipeline] DevOps Agent failed, skipping:', error);

    return {
      errors: [agentError],
      agentStatus: { devops: 'failed' },
    };
  }
}

/**
 * User Story Agent Node (Layer 2)
 */
async function userStoryAgentNode(state: TechnicalGraphStateType): Promise<Partial<TechnicalGraphStateType>> {
  console.log('[Technical Pipeline] Running User Story Agent...');

  try {
    const input: TechnicalAgentInput = {
      visualResults: state.visualResults,
      detailLevel: state.detailLevel,
      apiStyle: state.apiStyle,
      productIdentity: state.identity,
      previousOutputs: {
        identity: state.identityXml,
        databaseSchema: state.databaseSchema,
        backendArchitecture: state.backendArchitecture,
      },
      clarificationsText: state.clarificationsText || undefined,
    };

    const result = await userStoryAgent.executeWithRetry(input);

    return {
      userStories: result.xml,
      agentStatus: { userStory: 'completed' },
      tokenUsage: result.tokenUsage,
      allInferences: result.inferences,
    };
  } catch (error) {
    const agentError = createTechnicalAgentError(
      'userStory',
      error instanceof Error ? error : new Error('Unknown error'),
      false
    );

    console.warn('[Technical Pipeline] User Story Agent failed, skipping:', error);

    return {
      errors: [agentError],
      agentStatus: { userStory: 'failed' },
    };
  }
}

/**
 * PRD Validator Node (Layer 3)
 */
async function prdValidatorNode(state: TechnicalGraphStateType): Promise<Partial<TechnicalGraphStateType>> {
  console.log('[Technical Pipeline] Running PRD Validator...');

  try {
    const input: TechnicalAgentInput = {
      visualResults: state.visualResults,
      detailLevel: state.detailLevel,
      apiStyle: state.apiStyle,
      productIdentity: state.identity,
      previousOutputs: {
        identity: state.identityXml,
        databaseSchema: state.databaseSchema,
        backendArchitecture: state.backendArchitecture,
        testingStrategy: state.testingStrategy,
        devopsConfig: state.devopsConfig,
        userStories: state.userStories,
      },
      clarificationsText: state.clarificationsText || undefined,
    };

    const result = await prdValidatorAgent.executeWithRetry(input);

    return {
      validationResult: result.xml,
      agentStatus: { prdValidator: 'completed' },
      tokenUsage: result.tokenUsage,
    };
  } catch (error) {
    const agentError = createTechnicalAgentError(
      'prdValidator',
      error instanceof Error ? error : new Error('Unknown error'),
      true // Validator is critical
    );

    console.error('[Technical Pipeline] PRD Validator failed:', error);

    return {
      errors: [agentError],
      agentStatus: { prdValidator: 'failed' },
    };
  }
}

/**
 * Skeptic Agent Node (Layer 3)
 * Non-critical: failure is gracefully handled and pipeline continues to QA.
 */
async function skepticAgentNode(state: TechnicalGraphStateType): Promise<Partial<TechnicalGraphStateType>> {
  console.log('[Technical Pipeline] Running Skeptic Agent...');

  try {
    const input: TechnicalAgentInput = {
      visualResults: state.visualResults,
      detailLevel: state.detailLevel,
      apiStyle: state.apiStyle,
      productIdentity: state.identity, // Pass parsed identity object
      previousOutputs: {
        databaseSchema: state.databaseSchema,
        backendArchitecture: state.backendArchitecture,
        userStories: state.userStories,
        validationResult: state.validationResult,
      },
      clarificationsText: state.clarificationsText || undefined,
    };

    const result = await skepticAgent.executeWithRetry(input);

    console.log(`[Technical Pipeline] Skeptic Agent completed: ${result.data.challengedInferences.length} challenges, ${result.data.highRiskAssumptions.length} high-risk assumptions`);

    return {
      skepticReview: result.xml,
      agentStatus: { skeptic: 'completed' },
      tokenUsage: result.tokenUsage,
      allInferences: result.inferences,
    };
  } catch (error) {
    // Skeptic is non-critical — log and continue
    console.warn('[Technical Pipeline] Skeptic Agent failed (non-critical), continuing:', error);

    const agentError = createTechnicalAgentError(
      'skeptic',
      error instanceof Error ? error : new Error('Unknown error'),
      false // Non-critical
    );

    return {
      errors: [agentError],
      agentStatus: { skeptic: 'failed' },
    };
  }
}

/**
 * QA Agent Node (Layer 3)
 */
async function qaAgentNode(state: TechnicalGraphStateType): Promise<Partial<TechnicalGraphStateType>> {
  const iteration = state.qaIterations + 1;
  console.log(`[Technical Pipeline] Running QA Agent (iteration ${iteration}/3)...`);

  try {
    const input: TechnicalAgentInput = {
      visualResults: state.visualResults,
      detailLevel: state.detailLevel,
      apiStyle: state.apiStyle,
      previousOutputs: {
        databaseSchema: state.databaseSchema,
        backendArchitecture: state.backendArchitecture,
        testingStrategy: state.testingStrategy,
        devopsConfig: state.devopsConfig,
        userStories: state.userStories,
        validationResult: state.validationResult,
        skepticReview: state.skepticReview,
      },
      clarificationsText: state.clarificationsText || undefined,
    };

    const result = await qaAgent.executeWithRetry(input);

    // Parse QA result to check approval
    const finalApprovalMatch = result.xml.match(/<finalApproval>([^<]*)<\/finalApproval>/);
    const qaApproved = finalApprovalMatch?.[1]?.toLowerCase() === 'true';

    return {
      qaReview: result.xml,
      qaIterations: iteration,
      qaApproved,
      agentStatus: { qa: 'completed' },
      tokenUsage: result.tokenUsage,
    };
  } catch (error) {
    const agentError = createTechnicalAgentError(
      'qa',
      error instanceof Error ? error : new Error('Unknown error'),
      true // QA is critical
    );

    console.error('[Technical Pipeline] QA Agent failed:', error);

    return {
      errors: [agentError],
      qaIterations: iteration,
      agentStatus: { qa: 'failed' },
    };
  }
}

// ============ Conditional Edge Functions ============

/**
 * Check after identity agent
 */
function afterIdentity(state: TechnicalGraphStateType): 'database' | 'end' {
  if (state.agentStatus.identity === 'failed') {
    console.log('[Technical Pipeline] Identity Agent failed, ending pipeline');
    return 'end';
  }
  return 'database';
}

/**
 * Check after database agent
 */
function afterDatabase(state: TechnicalGraphStateType): 'layer2' | 'end' {
  if (state.agentStatus.database === 'failed') {
    console.log('[Technical Pipeline] Database failed, ending pipeline');
    return 'end';
  }
  return 'layer2';
}

/**
 * Check after layer 2 completes
 */
function afterLayer2(state: TechnicalGraphStateType): 'validator' | 'end' {
  // Need at least database schema to continue
  if (!state.databaseSchema) {
    return 'end';
  }

  // Can continue even if some layer 2 agents failed
  return 'validator';
}

/**
 * Check after validator
 */
function afterValidator(state: TechnicalGraphStateType): 'skeptic' | 'end' {
  if (state.agentStatus.prdValidator === 'failed') {
    console.log('[Technical Pipeline] Validator failed, ending pipeline');
    return 'end';
  }
  return 'skeptic';
}

/**
 * QA decision: another pass or synthesize
 */
function qaDecision(state: TechnicalGraphStateType): 'another_pass' | 'synthesize' {
  const maxIterations = 3;

  // If max iterations reached, synthesize
  if (state.qaIterations >= maxIterations) {
    console.log('[Technical Pipeline] Max QA iterations reached, synthesizing');
    return 'synthesize';
  }

  // If approved, synthesize
  if (state.qaApproved) {
    console.log('[Technical Pipeline] QA approved, synthesizing');
    return 'synthesize';
  }

  // Check if another pass needed
  const requiresAnotherPassMatch = state.qaReview?.match(/<requiresAnotherPass>([^<]*)<\/requiresAnotherPass>/);
  const requiresAnotherPass = requiresAnotherPassMatch?.[1]?.toLowerCase() === 'true';

  if (requiresAnotherPass) {
    console.log('[Technical Pipeline] QA requires another pass');
    return 'another_pass';
  }

  return 'synthesize';
}

// ============ Build Graph ============

/**
 * Create the Technical Pipeline LangGraph workflow
 */
export function createTechnicalGraph() {
  const workflow = new StateGraph(TechnicalGraphState)
    // Layer 0: Identity Agent
    .addNode('identity_agent', identityAgentNode)

    // Layer 1: Database Agent
    .addNode('database_agent', databaseAgentNode)

    // Layer 2: Parallel agents
    .addNode('backend_agent', backendAgentNode)
    .addNode('testing_agent', testingAgentNode)
    .addNode('devops_agent', devopsAgentNode)
    .addNode('user_story_agent', userStoryAgentNode)

    // Layer 3: Sequential validation
    .addNode('prd_validator', prdValidatorNode)
    .addNode('skeptic_agent', skepticAgentNode)
    .addNode('qa_agent', qaAgentNode)

    // Edges: Start with identity (Layer 0)
    .addEdge(START, 'identity_agent')

    // After identity: conditional to database (Layer 1)
    .addConditionalEdges('identity_agent', afterIdentity, {
      database: 'database_agent',
      end: END,
    })

    // After database: conditional to layer 2
    .addConditionalEdges('database_agent', afterDatabase, {
      layer2: 'backend_agent',
      end: END,
    })

    // Layer 2 runs in parallel after database
    .addEdge('database_agent', 'testing_agent')
    .addEdge('database_agent', 'devops_agent')
    .addEdge('database_agent', 'user_story_agent')

    // All layer 2 converge to validator
    .addEdge('backend_agent', 'prd_validator')
    .addEdge('testing_agent', 'prd_validator')
    .addEdge('devops_agent', 'prd_validator')
    .addEdge('user_story_agent', 'prd_validator')

    // Validator to Skeptic
    .addConditionalEdges('prd_validator', afterValidator, {
      skeptic: 'skeptic_agent',
      end: END,
    })

    // Skeptic to QA
    .addEdge('skeptic_agent', 'qa_agent')

    // QA conditional: loop back to validator or end
    .addConditionalEdges('qa_agent', qaDecision, {
      another_pass: 'prd_validator',
      synthesize: END,
    });

  return workflow.compile();
}

// ============ Execute Pipeline ============

/**
 * Execute the technical pipeline
 */
export async function executeTechnicalPipeline(
  visualResults: VisualPipelineResult,
  detailLevel: DetailLevel,
  apiStyle?: APIStyle,
  clarifications?: {
    questions: ClarificationQuestion[];
    responses: ClarificationResponse[];
  }
): Promise<TechnicalPipelineResult> {
  const startTime = Date.now();
  console.log('[Technical Pipeline] Starting execution...');

  // Validate input
  if (!visualResults) {
    throw new Error('visualResults parameter is required but was undefined or null');
  }

  console.log('[Technical Pipeline] Visual Results validation:', {
    hasFinalPrompt: !!visualResults.finalPrompt,
    hasMetadata: !!visualResults.metadata,
    hasComponentIdentification: !!visualResults.componentIdentification,
    hasLayoutAnalysis: !!visualResults.layoutAnalysis,
    hasDesignSystem: !!visualResults.designSystem,
  });

  try {
    // Format user clarifications into text for agent prompts
    const clarificationsText = clarifications
      ? formatClarificationsForPrompt(clarifications.questions, clarifications.responses)
      : '';

    if (clarificationsText) {
      console.log('[Technical Pipeline] User clarifications provided, injecting into agent prompts');
    }

    // Create initial state
    const initialState = createInitialTechnicalState(
      visualResults, detailLevel, apiStyle, undefined, clarificationsText
    );

    // Create and run the graph
    const graph = createTechnicalGraph();
    const finalState = await graph.invoke(initialState);

    // Check for critical failures
    if (hasCriticalTechnicalAgentFailed(finalState)) {
      // Build detailed error message
      const failedAgents: string[] = [];
      const criticalErrors: string[] = [];

      // Check Identity agent
      if (finalState.agentStatus.identity === 'failed') {
        failedAgents.push('Identity (Layer 0)');
      }

      // Check Database agent
      if (finalState.agentStatus.database === 'failed') {
        failedAgents.push('Database (Layer 1)');
      }

      // Collect critical errors
      finalState.errors.forEach((err) => {
        if (err.isCritical) {
          criticalErrors.push(`${err.agentName}: ${err.message} (type: ${err.type})`);
        }
      });

      const errorDetails = [
        failedAgents.length > 0 ? `Failed agents: ${failedAgents.join(', ')}` : null,
        criticalErrors.length > 0 ? `Critical errors: ${criticalErrors.join('; ')}` : null,
      ]
        .filter((x) => x !== null)
        .join(' | ');

      const errorMessage = `Technical pipeline failed: ${errorDetails || 'critical agent error'}`;
      console.error(`[Technical Pipeline] ${errorMessage}`);
      console.error('[Technical Pipeline] Agent statuses:', JSON.stringify(finalState.agentStatus, null, 2));
      console.error('[Technical Pipeline] All errors:', JSON.stringify(finalState.errors, null, 2));

      throw new Error(errorMessage);
    }

    const processingTimeMs = Date.now() - startTime;
    const completedAgents = getCompletedTechnicalAgents(finalState);

    console.log(`[Technical Pipeline] Completed in ${processingTimeMs}ms with ${completedAgents.length} agents`);

    // Build confidence summary
    const confidenceSummary = getConfidenceSummary(finalState);

    // Build agent score map
    const agentScores: Record<string, number> = {};
    for (const [name, conf] of Object.entries(finalState.confidenceState.agentConfidences)) {
      agentScores[name] = conf.overallScore;
    }

    // Build result
    const result: TechnicalPipelineResult = {
      identity: finalState.identity,
      identityConfidence: finalState.identityConfidence,
      databaseSchema: finalState.databaseSchema || '',
      backendArchitecture: finalState.backendArchitecture || '',
      testingStrategy: finalState.testingStrategy || '',
      devopsConfig: finalState.devopsConfig || '',
      userStories: finalState.userStories || '',
      validationResult: finalState.validationResult || '',
      skepticReview: finalState.skepticReview || undefined,
      qaReview: finalState.qaReview || '',
      summaries: {
        identity: {
          xml: finalState.identityXml || '',
          identity: finalState.identity!,
          confidence: finalState.identityConfidence,
        },
        database: { xml: finalState.databaseSchema || '', entities: [], relations: [], enums: [] },
        backend: { xml: finalState.backendArchitecture || '', endpoints: [], techStack: { framework: 'Express', runtime: 'Node.js', apiStyle: 'REST' } },
        testing: { xml: finalState.testingStrategy || '', testSuites: [], coverageTarget: 80 },
        devops: { xml: finalState.devopsConfig || '', services: [], hostingRecommendations: [] },
        userStory: {
          xml: finalState.userStories || '',
          productContext: {
            background: { description: '', isNewFeature: false },
            problemStatement: { problem: '', affectedUsers: [], currentWorkarounds: [], impactIfNotSolved: '' },
            goalsAndNonGoals: { goals: [], nonGoals: [], successMetrics: [] },
          },
          personas: [],
          epics: [],
          allFeatures: [],
          allStories: [],
          summary: { totalEpics: 0, totalFeatures: 0, totalStories: 0, totalPersonas: 0, estimatedComplexity: 'medium', estimatedDuration: 'Unknown' },
        },
        validation: { xml: finalState.validationResult || '', scores: { completeness: 0, consistency: 0, security: 0, implementability: 0, acceptanceCriteria: 0, nonGoals: 0, tradeoffs: 0, overall: 0 }, issues: [], nonGoalsIdentified: [], tradeoffsIdentified: [], approved: false },
        qa: {
          xml: finalState.qaReview || '',
          iteration: finalState.qaIterations,
          critiques: [],
          modifications: [],
          frontendBackendAlignmentChecks: [],
          requiresAnotherPass: false,
          finalApproval: finalState.qaApproved,
        },
      },
      prdMarkdown: '', // Will be filled by PRD synthesizer
      confidence: {
        overallScore: confidenceSummary.overall,
        agentScores,
        lowConfidenceAreas: confidenceSummary.lowConfidenceAreas,
        clarificationNeeded: finalState.confidenceState.needsClarification,
        inferences: finalState.allInferences,
      },
      metadata: {
        processingTimeMs,
        agentsUsed: completedAgents,
        qaIterations: finalState.qaIterations,
        overallScore: 0, // Will be extracted from validation
        detailLevel,
      },
    };

    return result;
  } catch (error) {
    console.error('[Technical Pipeline] Pipeline execution failed:', error);
    throw error;
  }
}

// ============ Export ============

export const technicalOrchestrator = {
  execute: executeTechnicalPipeline,
  createGraph: createTechnicalGraph,
};
