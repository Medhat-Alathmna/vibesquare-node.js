/**
 * Fallback Logic
 *
 * Handles fallback to single-LLM interpreter when multi-agent pipeline fails.
 */

import { interpreter } from '../../pipeline/interpreter';
import { RawParsedDOM, StructuralAnalysis, DesignPromptResult } from '../../pipeline/ir.types';
import { PipelineV2Result, AgentError } from '../core/agent.types';

// ============ Types ============

export interface FallbackResult {
  success: boolean;
  result?: PipelineV2Result;
  error?: string;
}

// ============ Fallback Handler ============

/**
 * Execute fallback to single-LLM interpreter
 */
export async function executeFallback(
  parsedDOM: RawParsedDOM,
  structuralAnalysis: StructuralAnalysis,
  errors: AgentError[],
  startTime: number
): Promise<FallbackResult> {
  console.warn('Multi-agent pipeline failed, falling back to single-LLM interpreter');
  console.warn('Errors:', errors.map((e) => `${e.agentName}: ${e.error}`).join(', '));

  try {
    // Use existing interpreter with default model
    const designPrompt = await interpreter.interpret(parsedDOM, structuralAnalysis);

    const processingTimeMs = Date.now() - startTime;

    const result: PipelineV2Result = {
      finalPrompt: designPrompt.finalPrompt,
      metadata: {
        sourceUrl: parsedDOM.metadata.title || 'Unknown',
        nodesFound: structuralAnalysis.nodeCount,
        layoutType: structuralAnalysis.layoutType,
        difficulty: structuralAnalysis.difficulty,
        language: parsedDOM.language,
        processingTimeMs,
        agentsUsed: ['fallback-single-llm'],
        fallbackTriggered: true,
      },
    };

    return {
      success: true,
      result,
    };
  } catch (fallbackError) {
    console.error('Fallback also failed:', fallbackError);
    return {
      success: false,
      error: fallbackError instanceof Error ? fallbackError.message : 'Fallback failed',
    };
  }
}

// ============ Fallback Trigger Conditions ============

/**
 * Check if fallback should be triggered
 */
export function shouldTriggerFallback(
  errors: AgentError[],
  startTime: number,
  maxDurationMs: number = 90000
): { trigger: boolean; reason: string } {
  // Check for critical agent failures
  const criticalFailures = errors.filter((e) => !e.recoverable);
  if (criticalFailures.length > 0) {
    return {
      trigger: true,
      reason: `Critical agent failure: ${criticalFailures[0].agentName}`,
    };
  }

  // Check for timeout
  const elapsed = Date.now() - startTime;
  if (elapsed > maxDurationMs) {
    return {
      trigger: true,
      reason: `Pipeline timeout: ${elapsed}ms > ${maxDurationMs}ms`,
    };
  }

  // Check for too many errors
  if (errors.length >= 3) {
    return {
      trigger: true,
      reason: `Too many errors: ${errors.length}`,
    };
  }

  return {
    trigger: false,
    reason: '',
  };
}

// ============ Error Recording ============

/**
 * Create an agent error record
 */
export function createAgentError(
  agentName: string,
  error: Error | string,
  isCritical: boolean
): AgentError {
  return {
    agentName,
    error: error instanceof Error ? error.message : error,
    timestamp: Date.now(),
    recoverable: !isCritical,
  };
}
