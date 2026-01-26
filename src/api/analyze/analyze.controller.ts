import { Request, Response } from 'express';
import { analyzeService } from './analyze.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { compressJSON, getCompressionStats } from '../../shared/utils/toon-compression';
import { LLMModel } from './pipeline';
import { PipelineType, DetailLevel } from './technical/core/technical-agent.types';

/**
 * V1 Analyze URL - Single LLM
 */
export const analyzeUrl = asyncHandler(async (req: Request, res: Response) => {
  const { url, model, tier } = req.body;

  const result = await analyzeService.analyzeUrl({
    url,
    model: model as LLMModel,
    tier,
  });

  // Compress debug data using Toon if present
  let debugData = undefined;

  if (result.debug) {
    try {
      const compressed = compressJSON(result.debug);
      const compressionStats = getCompressionStats(result.debug, compressed);

      console.log('[Toon Compression] V1 Pipeline Debug compressed:', compressionStats);

      debugData = {
        compressed: true,
        data: compressed,
        compressionStats,
      };
    } catch (error) {
      console.error('[Toon Compression] Failed to compress debug data, sending uncompressed:', error);
      debugData = {
        compressed: false,
        data: result.debug,
      };
    }
  }

  res.json(new ApiResponse(200, {
    prompt: result.prompt,
    metadata: result.metadata,
    debug: debugData,
  }, 'Analysis completed successfully'));
});

/**
 * V2 Analyze URL - Multi-Agent Orchestration
 *
 * Uses LangGraph with specialized agents for better analysis:
 * - Layout Analyzer
 * - Component Identifier
 * - Design System Extractor
 * - Conflict Resolver
 * - Prompt Synthesizer
 *
 * Returns finalPrompt + optional userQuestions for ambiguities
 */
export const analyzeUrlV2 = asyncHandler(async (req: Request, res: Response) => {
  const { url, tier, includeDebug } = req.body;

  const result = await analyzeService.analyzeUrlV2({
    url,
    tier,
    includeDebug: includeDebug ?? false,
  });

  // Compress debug data using Toon if present
  let debugData = undefined;

  if (includeDebug && result.debug) {
    try {
      const compressed = compressJSON(result.debug);
      const compressionStats = getCompressionStats(result.debug, compressed);

      console.log('[Toon Compression] V2 Pipeline Debug compressed:', compressionStats);

      debugData = {
        compressed: true,
        data: compressed,
        compressionStats,
      };
    } catch (error) {
      console.error('[Toon Compression] Failed to compress debug data, sending uncompressed:', error);
      debugData = {
        compressed: false,
        data: result.debug,
      };
    }
  }

  res.json(new ApiResponse(200, {
    finalPrompt: result.finalPrompt,
    userQuestions: result.userQuestions,
    metadata: result.metadata,
    debug: debugData,
  }, 'V2 Analysis completed successfully'));
});

/**
 * V2.5 Analyze URL - Visual + Technical Architecture Pipeline
 *
 * Generates comprehensive PRD including:
 * - Visual Design (from V2 pipeline)
 * - Database Schema (XML)
 * - Backend Architecture (XML)
 * - Security Recommendations (XML)
 * - Testing Strategy (XML)
 * - DevOps Configuration (XML)
 *
 * Returns complete PRD in markdown format
 */
export const analyzeUrlV25 = asyncHandler(async (req: Request, res: Response) => {
  const { url, pipelineType, detailLevel, apiStyle, tier, includeDebug } = req.body;
  const userId = (req as any).user?.id; // Optional: from auth middleware

  const result = await analyzeService.analyzeUrlV25({
    url,
    pipelineType: pipelineType as PipelineType,
    detailLevel: detailLevel as DetailLevel,
    apiStyle: apiStyle || 'REST',
    tier,
    userId,
    includeDebug: includeDebug ?? false,
  });

  // Compress debug data using Toon if present
  let debugData = undefined;
  let compressionStats = undefined;

  if (includeDebug && result.debug) {
    try {
      const compressed = compressJSON(result.debug);
      compressionStats = getCompressionStats(result.debug, compressed);

      console.log('[Toon Compression] Visual Pipeline Debug compressed:', compressionStats);

      debugData = {
        compressed: true,
        data: compressed,
        compressionStats,
      };
    } catch (error) {
      console.error('[Toon Compression] Failed to compress debug data, sending uncompressed:', error);
      debugData = {
        compressed: false,
        data: result.debug,
      };
    }
  }

  res.json(new ApiResponse(200, {
    prdId: result.prdId,
    prdMarkdown: result.prdMarkdown,
    metadata: result.metadata,
    debug: debugData,
  }, 'V2.5 Analysis completed successfully'));
});
