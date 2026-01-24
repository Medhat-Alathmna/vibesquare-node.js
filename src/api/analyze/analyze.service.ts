import { executePipeline, executePipelineV2, LLMModel, PipelineResult, UserTier, PipelineV2Result } from './pipeline';
import { executeTechnicalPipeline } from './technical';
import { PipelineType, DetailLevel, TechnicalPipelineResult, VisualPipelineResult } from './technical/core/technical-agent.types';
import { getPRDRepository, CreatePRDDTO } from '../../shared/repositories';

export interface AnalyzeOptions {
  url: string;
  model?: LLMModel;
  tier?: UserTier;
}

export interface AnalyzeV2Options {
  url: string;
  tier?: UserTier;
  includeDebug?: boolean;
}

export interface AnalyzeV25Options {
  url: string;
  pipelineType?: PipelineType;
  detailLevel?: DetailLevel;
  tier?: UserTier;
  userId?: string;
  includeDebug?: boolean;
}

export interface AnalyzeV25Result {
  prdId: string;
  prdMarkdown: string;
  visualAnalysis?: PipelineV2Result;
  technicalAnalysis?: TechnicalPipelineResult;
  metadata: {
    sourceUrl: string;
    pipelineType: PipelineType;
    detailLevel: DetailLevel;
    processingTimeMs: number;
    validationScore?: number;
    qaIterations?: number;
    qaApproved?: boolean;
  };
  debug?: any;
}

export class AnalyzeService {
  /**
   * V1: Analyze a URL using single LLM
   *
   * @param options - Analysis options
   * @returns Pipeline result with prompt and metadata
   */
  async analyzeUrl(options: AnalyzeOptions): Promise<PipelineResult> {
    return executePipeline({
      url: options.url,
      model: options.model,
      tier: options.tier,
    });
  }

  /**
   * V2: Analyze a URL using multi-agent orchestration
   *
   * Uses LangGraph with specialized agents:
   * - Layout Analyzer
   * - Component Identifier
   * - Design System Extractor
   * - Conflict Resolver
   * - Prompt Synthesizer
   *
   * Falls back to single-LLM on critical failures.
   *
   * @param options - V2 Analysis options
   * @returns Pipeline result with prompt, user questions, and metadata
   */
  async analyzeUrlV2(options: AnalyzeV2Options): Promise<PipelineV2Result> {
    return executePipelineV2({
      url: options.url,
      tier: options.tier,
      includeDebug: options.includeDebug,
    });
  }

  /**
   * V2.5: Analyze a URL using Visual + Technical Architecture Pipeline
   *
   * Combines Visual Pipeline (V2) with Technical Architecture Pipeline:
   *
   * Visual Pipeline:
   * - Layout Analyzer, Component Identifier, Design System Extractor
   *
   * Technical Pipeline:
   * - Database Agent (XML schema)
   * - Backend Agent (REST/GraphQL endpoints)
   * - Security Agent (OWASP, auth, data protection)
   * - Testing Agent (unit/API tests)
   * - DevOps Agent (Docker, CI/CD, hosting)
   * - PRD Validator (consistency checks)
   * - QA Agent (frontend-backend alignment)
   *
   * @param options - V2.5 Analysis options
   * @returns Complete PRD with visual and technical specifications
   */
  async analyzeUrlV25(options: AnalyzeV25Options): Promise<AnalyzeV25Result> {
    const startTime = Date.now();
    const {
      url,
      pipelineType = 'both',
      detailLevel = 'detailed',
      tier,
      userId,
      includeDebug = false,
    } = options;

    console.log(`[Pipeline V2.5] Starting analysis for: ${url}`);
    console.log(`[Pipeline V2.5] Pipeline type: ${pipelineType}, Detail level: ${detailLevel}`);

    let visualResult: PipelineV2Result | undefined;
    let technicalResult: TechnicalPipelineResult | undefined;

    // Step 1: Run Visual Pipeline (if needed)
    if (pipelineType === 'visual' || pipelineType === 'both') {
      console.log('[Pipeline V2.5] Running Visual Pipeline...');
      visualResult = await executePipelineV2({
        url,
        tier,
        includeDebug,
      });
      console.log(`[Pipeline V2.5] Visual Pipeline completed in ${visualResult.metadata.processingTimeMs}ms`);
    }

    // Step 2: Run Technical Pipeline (if needed)
    if (pipelineType === 'technical' || pipelineType === 'both') {
      console.log('[Pipeline V2.5] Running Technical Pipeline...');

      // Convert visual result to VisualPipelineResult format
      const visualPipelineInput: VisualPipelineResult = visualResult
        ? {
            finalPrompt: visualResult.finalPrompt,
            userQuestions: visualResult.userQuestions?.map((q) => q.question),
            metadata: visualResult.metadata,
            // Extract structured data from agent outputs if available
            layoutAnalysis: visualResult.debug?.agentOutputs?.layoutAnalysis?.data as any,
            componentIdentification: visualResult.debug?.agentOutputs?.componentIdentification?.data as any,
            designSystem: visualResult.debug?.agentOutputs?.designSystem?.data as any,
          }
        : {
            finalPrompt: `Analyze the website at ${url} and generate technical architecture.`,
            metadata: {
              sourceUrl: url,
              nodesFound: 0,
              layoutType: 'unknown',
              difficulty: 'unknown',
              language: 'en',
              processingTimeMs: 0,
              agentsUsed: [],
              fallbackTriggered: false,
            },
          };

      technicalResult = await executeTechnicalPipeline({
        visualResults: visualPipelineInput,
        detailLevel,
        pipelineType,
        enableWebSearch: true,
      });
      console.log(`[Pipeline V2.5] Technical Pipeline completed in ${technicalResult.metadata.processingTimeMs}ms`);
    }

    // Step 3: Save to database
    const prdRepository = getPRDRepository();

    const createData: CreatePRDDTO = {
      userId,
      sourceUrl: url,
      pipelineType,
      detailLevel,
      visualAnalysis: visualResult
        ? {
            finalPrompt: visualResult.finalPrompt,
            userQuestions: visualResult.userQuestions,
            metadata: visualResult.metadata,
          }
        : undefined,
      databaseSchema: technicalResult?.databaseSchema,
      backendArchitecture: technicalResult?.backendArchitecture,
      securityRecommendations: technicalResult?.securityRecommendations,
      testingStrategy: technicalResult?.testingStrategy,
      devopsConfig: technicalResult?.devopsConfig,
      validationResult: technicalResult?.validationResult,
      validationScore: technicalResult?.summaries.validation.scores.overall,
      qaReview: technicalResult?.qaReview,
      qaIterations: technicalResult?.metadata.qaIterations,
      qaApproved: technicalResult?.summaries.qa.finalApproval,
      prdMarkdown: technicalResult?.prdMarkdown || visualResult?.finalPrompt || '',
    };

    const savedPrd = await prdRepository.create(createData);
    console.log(`[Pipeline V2.5] PRD saved with ID: ${savedPrd.id}`);

    const totalProcessingTime = Date.now() - startTime;
    console.log(`[Pipeline V2.5] Total processing time: ${totalProcessingTime}ms`);

    return {
      prdId: savedPrd.id,
      prdMarkdown: savedPrd.prdMarkdown,
      visualAnalysis: pipelineType !== 'technical' ? visualResult : undefined,
      technicalAnalysis: pipelineType !== 'visual' ? technicalResult : undefined,
      metadata: {
        sourceUrl: url,
        pipelineType,
        detailLevel,
        processingTimeMs: totalProcessingTime,
        validationScore: technicalResult?.summaries.validation.scores.overall,
        qaIterations: technicalResult?.metadata.qaIterations,
        qaApproved: technicalResult?.summaries.qa.finalApproval,
      },
      debug: includeDebug
        ? {
            visualDebug: visualResult?.debug,
            technicalDebug: technicalResult,
          }
        : undefined,
    };
  }
}

export const analyzeService = new AnalyzeService();
