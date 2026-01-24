/**
 * Technical Architecture Pipeline Module
 *
 * Main entry point for the V2.5 Technical Pipeline.
 * Provides orchestration for generating PRDs from Visual Pipeline results.
 */

// Core exports
export * from './core';

// Agent exports
export * from './agents';

// Orchestration exports
export * from './orchestration';

// Synthesis exports
export * from './synthesis';

// Main execution function
import { executeTechnicalPipeline as executeRawTechnicalPipeline } from './orchestration';
import { synthesizePRD } from './synthesis';
import {
  VisualPipelineResult,
  DetailLevel,
  PipelineType,
  TechnicalPipelineResult,
} from './core/technical-agent.types';

/**
 * Options for executing the technical pipeline
 */
export interface TechnicalPipelineOptions {
  visualResults: VisualPipelineResult;
  detailLevel?: DetailLevel;
  pipelineType?: PipelineType;
  enableWebSearch?: boolean;
}

/**
 * Execute the complete Technical Pipeline and generate PRD
 *
 * This is the main entry point for the V2.5 pipeline.
 * It runs all technical agents and synthesizes the final PRD.
 */
export async function executeTechnicalPipeline(
  options: TechnicalPipelineOptions
): Promise<TechnicalPipelineResult> {
  const { visualResults, detailLevel = 'detailed' } = options;

  // Execute the technical pipeline
  const result = await executeRawTechnicalPipeline(visualResults, detailLevel);

  // Synthesize the final PRD
  result.prdMarkdown = synthesizePRD(result, visualResults, detailLevel);

  return result;
}

/**
 * Execute the complete Technical Pipeline and generate PRD
 * @deprecated Use executeTechnicalPipeline with options object instead
 */
export async function runTechnicalPipeline(
  visualResults: VisualPipelineResult,
  detailLevel: DetailLevel = 'detailed'
): Promise<TechnicalPipelineResult> {
  return executeTechnicalPipeline({ visualResults, detailLevel });
}

export default {
  runTechnicalPipeline,
  executeTechnicalPipeline,
  synthesizePRD,
};
