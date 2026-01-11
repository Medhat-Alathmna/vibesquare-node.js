/**
 * LangGraph Orchestration Workflow
 *
 * Main workflow that orchestrates all agents in the multi-agent system.
 * Implements parallel execution for visual layer, sequential for dependencies.
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { GraphState, GraphStateType, createInitialGraphState, collectAllAmbiguities, hasCriticalAgentFailed, getCompletedAgents } from './state';
import { executeFallback, shouldTriggerFallback, createAgentError } from './fallback';
import { AgentExecutionError } from '../core/base-agent';
import { PipelineV2Result, AgentError, AgentInput } from '../core/agent.types';
import { RawParsedDOM, StructuralAnalysis } from '../../pipeline/ir.types';

// Import agents
import { layoutAnalyzerAgent } from '../visual/layout-analyzer.agent';
import { componentIdentifierAgent } from '../visual/component-identifier.agent';
import { designSystemExtractorAgent } from '../visual/design-system-extractor.agent';
import { conflictResolverAgent } from '../resolution/conflict-resolver.agent';
import { promptSynthesizerAgent } from '../synthesis/prompt-synthesizer.agent';
import { userQuestionCollectorAgent } from '../resolution/user-question-collector.agent';

// ============ Node Functions ============

/**
 * Layout Analyzer Node
 */
async function layoutAnalyzerNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  console.log('[Graph] Running Layout Analyzer...');

  try {
    const input: AgentInput = {
      parsedDOM: state.parsedDOM,
      structuralAnalysis: state.structuralAnalysis,
    };

    const result = await layoutAnalyzerAgent.executeWithRetry(input);

    return {
      layoutAnalysis: result,
      agentStatus: { layoutAnalyzer: 'completed' },
    };
  } catch (error) {
    const agentError = createAgentError(
      'layoutAnalyzer',
      error instanceof Error ? error : new Error('Unknown error'),
      false
    );

    return {
      errors: [agentError],
      agentStatus: { layoutAnalyzer: 'failed' },
    };
  }
}

/**
 * Component Identifier Node
 */
async function componentIdentifierNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  console.log('[Graph] Running Component Identifier...');

  try {
    const input: AgentInput = {
      parsedDOM: state.parsedDOM,
      structuralAnalysis: state.structuralAnalysis,
      previousOutputs: {
        layoutAnalysis: state.layoutAnalysis,
      },
    };

    const result = await componentIdentifierAgent.executeWithRetry(input);

    return {
      componentIdentification: result,
      agentStatus: { componentIdentifier: 'completed' },
    };
  } catch (error) {
    const agentError = createAgentError(
      'componentIdentifier',
      error instanceof Error ? error : new Error('Unknown error'),
      false
    );

    return {
      errors: [agentError],
      agentStatus: { componentIdentifier: 'failed' },
    };
  }
}

/**
 * Design System Extractor Node
 */
async function designSystemExtractorNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  console.log('[Graph] Running Design System Extractor...');

  try {
    const input: AgentInput = {
      parsedDOM: state.parsedDOM,
      structuralAnalysis: state.structuralAnalysis,
    };

    const result = await designSystemExtractorAgent.executeWithRetry(input);

    return {
      designSystem: result,
      agentStatus: { designSystemExtractor: 'completed' },
    };
  } catch (error) {
    const agentError = createAgentError(
      'designSystemExtractor',
      error instanceof Error ? error : new Error('Unknown error'),
      false
    );

    return {
      errors: [agentError],
      agentStatus: { designSystemExtractor: 'failed' },
    };
  }
}

/**
 * Conflict Resolver Node
 */
async function conflictResolverNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  console.log('[Graph] Running Conflict Resolver...');

  try {
    const allAmbiguities = collectAllAmbiguities(state);

    const input: AgentInput = {
      parsedDOM: state.parsedDOM,
      structuralAnalysis: state.structuralAnalysis,
      previousOutputs: {
        layoutAnalysis: state.layoutAnalysis,
        componentIdentification: state.componentIdentification,
        designSystem: state.designSystem,
        allAmbiguities,
      },
    };

    const result = await conflictResolverAgent.executeWithRetry(input);

    return {
      conflictResolution: result,
      agentStatus: { conflictResolver: 'completed' },
    };
  } catch (error) {
    const agentError = createAgentError(
      'conflictResolver',
      error instanceof Error ? error : new Error('Unknown error'),
      true // Critical
    );

    return {
      errors: [agentError],
      agentStatus: { conflictResolver: 'failed' },
    };
  }
}

/**
 * Prompt Synthesizer Node
 */
async function promptSynthesizerNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  console.log('[Graph] Running Prompt Synthesizer...');

  try {
    const input: AgentInput = {
      parsedDOM: state.parsedDOM,
      structuralAnalysis: state.structuralAnalysis,
      previousOutputs: {
        layoutAnalysis: state.layoutAnalysis,
        componentIdentification: state.componentIdentification,
        designSystem: state.designSystem,
        conflictResolution: state.conflictResolution,
      },
    };

    const result = await promptSynthesizerAgent.executeWithRetry(input);

    return {
      promptSynthesis: result,
      finalPrompt: result.data.finalPrompt,
      agentStatus: { promptSynthesizer: 'completed' },
    };
  } catch (error) {
    const agentError = createAgentError(
      'promptSynthesizer',
      error instanceof Error ? error : new Error('Unknown error'),
      true // Critical
    );

    return {
      errors: [agentError],
      agentStatus: { promptSynthesizer: 'failed' },
    };
  }
}

/**
 * User Question Collector Node
 */
async function userQuestionCollectorNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  console.log('[Graph] Running User Question Collector...');

  try {
    const allAmbiguities = collectAllAmbiguities(state);

    const input: AgentInput = {
      parsedDOM: state.parsedDOM,
      structuralAnalysis: state.structuralAnalysis,
      previousOutputs: {
        allAmbiguities,
        conflictResolution: state.conflictResolution,
      },
    };

    const result = await userQuestionCollectorAgent.executeWithRetry(input);

    // Combine critical and optional questions
    const questions = [
      ...result.data.criticalQuestions,
      ...result.data.optionalQuestions.slice(0, 3), // Limit optional to 3
    ];

    return {
      userQuestions: result,
      questionsForUser: questions.length > 0 ? questions : undefined,
      agentStatus: { userQuestionCollector: 'completed' },
    };
  } catch (error) {
    const agentError = createAgentError(
      'userQuestionCollector',
      error instanceof Error ? error : new Error('Unknown error'),
      false
    );

    return {
      errors: [agentError],
      agentStatus: { userQuestionCollector: 'failed' },
    };
  }
}

// ============ Conditional Edges ============

/**
 * Check if we should trigger fallback
 */
function shouldFallback(state: GraphStateType): 'fallback' | 'continue' {
  const { trigger } = shouldTriggerFallback(state.errors, state.startTime);
  if (trigger) {
    console.log('[Graph] Triggering fallback due to errors');
    return 'fallback';
  }
  return 'continue';
}

/**
 * Check if critical agents failed after visual layer
 */
function afterVisualLayer(state: GraphStateType): 'conflict_resolver' | 'fallback' {
  // Check if we have enough data to continue
  const hasLayout = state.layoutAnalysis !== undefined;
  const hasComponents = state.componentIdentification !== undefined;

  if (!hasLayout && !hasComponents) {
    console.log('[Graph] Both visual agents failed, triggering fallback');
    return 'fallback';
  }

  return 'conflict_resolver';
}

/**
 * Check after conflict resolution
 */
function afterConflictResolver(state: GraphStateType): 'prompt_synthesizer' | 'fallback' {
  if (state.agentStatus.conflictResolver === 'failed') {
    return 'fallback';
  }
  return 'prompt_synthesizer';
}

/**
 * Check after prompt synthesis
 */
function afterPromptSynthesizer(state: GraphStateType): 'user_questions' | 'end' | 'fallback' {
  if (state.agentStatus.promptSynthesizer === 'failed') {
    return 'fallback';
  }

  // Check if we have ambiguities to collect
  const ambiguities = collectAllAmbiguities(state);
  const unresolvedAmbiguities = state.conflictResolution?.data.unresolvedAmbiguities || [];

  if (ambiguities.length > 0 || unresolvedAmbiguities.length > 0) {
    return 'user_questions';
  }

  return 'end';
}

// ============ Build Graph ============

/**
 * Create the LangGraph workflow
 */
export function createAgentGraph() {
  const workflow = new StateGraph(GraphState)
    // Add nodes
    .addNode('layout_analyzer', layoutAnalyzerNode)
    .addNode('component_identifier', componentIdentifierNode)
    .addNode('design_system_extractor', designSystemExtractorNode)
    .addNode('conflict_resolver', conflictResolverNode)
    .addNode('prompt_synthesizer', promptSynthesizerNode)
    .addNode('user_question_collector', userQuestionCollectorNode)

    // Start: Run visual layer in parallel
    .addEdge(START, 'layout_analyzer')
    .addEdge(START, 'component_identifier')
    .addEdge(START, 'design_system_extractor')

    // After visual layer: Check and proceed to conflict resolver
    .addConditionalEdges('layout_analyzer', afterVisualLayer, {
      conflict_resolver: 'conflict_resolver',
      fallback: END,
    })
    .addEdge('component_identifier', 'conflict_resolver')
    .addEdge('design_system_extractor', 'conflict_resolver')

    // After conflict resolver: Proceed to prompt synthesizer
    .addConditionalEdges('conflict_resolver', afterConflictResolver, {
      prompt_synthesizer: 'prompt_synthesizer',
      fallback: END,
    })

    // After prompt synthesizer: Check for user questions
    .addConditionalEdges('prompt_synthesizer', afterPromptSynthesizer, {
      user_questions: 'user_question_collector',
      end: END,
      fallback: END,
    })

    // User questions lead to end
    .addEdge('user_question_collector', END);

  return workflow.compile();
}

// ============ Execute Pipeline ============

/**
 * Execute the multi-agent pipeline
 */
export async function executeAgentPipeline(
  parsedDOM: RawParsedDOM,
  structuralAnalysis: StructuralAnalysis
): Promise<PipelineV2Result> {
  const startTime = Date.now();
  console.log('[Pipeline V2] Starting multi-agent execution...');

  try {
    // Create initial state
    const initialState = createInitialGraphState(parsedDOM, structuralAnalysis);

    // Create and run the graph
    const graph = createAgentGraph();
    const finalState = await graph.invoke(initialState);

    // Check if fallback was triggered or critical failure
    if (hasCriticalAgentFailed(finalState)) {
      console.log('[Pipeline V2] Critical agent failed, executing fallback...');
      const fallbackResult = await executeFallback(
        parsedDOM,
        structuralAnalysis,
        finalState.errors,
        startTime
      );

      if (fallbackResult.success && fallbackResult.result) {
        return fallbackResult.result;
      }

      throw new Error(fallbackResult.error || 'Fallback failed');
    }

    // Build result
    const processingTimeMs = Date.now() - startTime;
    const completedAgents = getCompletedAgents(finalState);

    const result: PipelineV2Result = {
      finalPrompt: finalState.finalPrompt || '',
      userQuestions: finalState.questionsForUser,
      metadata: {
        sourceUrl: parsedDOM.metadata.title || 'Unknown',
        nodesFound: structuralAnalysis.nodeCount,
        layoutType: structuralAnalysis.layoutType,
        difficulty: structuralAnalysis.difficulty,
        language: parsedDOM.language,
        processingTimeMs,
        agentsUsed: completedAgents,
        fallbackTriggered: false,
      },
    };

    console.log(`[Pipeline V2] Completed in ${processingTimeMs}ms with ${completedAgents.length} agents`);

    return result;
  } catch (error) {
    console.error('[Pipeline V2] Pipeline failed:', error);

    // Execute fallback
    const fallbackResult = await executeFallback(
      parsedDOM,
      structuralAnalysis,
      [createAgentError('pipeline', error instanceof Error ? error : new Error('Unknown'), true)],
      startTime
    );

    if (fallbackResult.success && fallbackResult.result) {
      return fallbackResult.result;
    }

    throw new Error(fallbackResult.error || 'Pipeline and fallback both failed');
  }
}

// ============ Export ============

export const agentOrchestrator = {
  execute: executeAgentPipeline,
  createGraph: createAgentGraph,
};
