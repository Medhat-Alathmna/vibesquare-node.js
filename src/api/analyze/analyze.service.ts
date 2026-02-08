import { executePipeline, executePipelineV2, LLMModel, PipelineResult, UserTier, PipelineV2Result } from './pipeline';
import { executeTechnicalPipeline } from './technical';
import { generateClarificationQuestions } from './technical/orchestration/clarification-generator';
import {
  PipelineType, DetailLevel, APIStyle, TechnicalPipelineResult, VisualPipelineResult,
  ClarificationQuestion, ClarificationResponse, PreflightResult,
} from './technical/core/technical-agent.types';
import { getPRDRepository, CreatePRDDTO, getVisualPipelineCacheRepository, VisualPipelineCacheData } from '../../shared/repositories';
import { normalizeUrl } from '../../shared/utils/url-normalizer';
import { pipelineQueueService } from './services/pipeline-queue.service';

export interface AnalyzeOptions {
  url: string;
  model?: LLMModel;
  tier?: UserTier;
}

export interface AnalyzeV2Options {
  url: string;
  tier?: UserTier;
  includeDebug?: boolean;
  forceRefresh?: boolean; // Force bypass cache and re-execute pipeline
}

export interface PreflightV25Options {
  url: string;
  tier?: UserTier;
  forceRefresh?: boolean;
}

export interface PreflightV25Result {
  preflight: PreflightResult;
  metadata: {
    sourceUrl: string;
    processingTimeMs: number;
    cached: boolean;
  };
}

export interface AnalyzeV25Options {
  url: string;
  pipelineType?: PipelineType;
  detailLevel?: DetailLevel;
  apiStyle?: APIStyle;
  tier?: UserTier;
  userId?: string;
  includeDebug?: boolean;
  forceRefresh?: boolean; // Force bypass cache and re-execute pipeline
  clarificationResponses?: Array<{
    questionId: string;
    selectedValues: string[];
    customAnswer?: string;
  }>;
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
    cached?: boolean; // Whether visual pipeline result was from cache
    cachedAt?: Date; // When the cached result was originally created
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
   * Includes caching:
   * - Global cache (shared across all users)
   * - 7-day TTL
   * - URL normalization (http/https same, www/non-www same)
   * - Request queuing to prevent duplicate executions
   *
   * @param options - V2 Analysis options
   * @returns Pipeline result with prompt, user questions, and metadata
   */
  async analyzeUrlV2(options: AnalyzeV2Options): Promise<PipelineV2Result> {
    const { url, tier, includeDebug = false, forceRefresh = false } = options;

    // Normalize URL for cache lookup
    const normalizedUrl = normalizeUrl(url);
    console.log(`[analyzeUrlV2] Original URL: ${url}`);
    console.log(`[analyzeUrlV2] Normalized URL: ${normalizedUrl}`);

    let result: PipelineV2Result;
    let fromCache = false;
    let cachedAt: Date | undefined;

    // Step 1: Check cache (unless forceRefresh)
    if (!forceRefresh) {
      const cached = await this.getFromCache(normalizedUrl);
      if (cached) {
        result = this.reconstructPipelineResult(cached);
        fromCache = true;
        cachedAt = cached.cachedAt;

        // Increment hit count asynchronously (don't wait)
        this.incrementCacheHit(cached.id).catch((err) =>
          console.error('[analyzeUrlV2] Failed to increment cache hit:', err)
        );

        console.log(`[analyzeUrlV2] Returning cached result from ${cachedAt?.toISOString()}`);

        // Add cache metadata to result
        return {
          ...result,
          metadata: {
            ...result.metadata,
            cached: true,
            cachedAt,
          } as any,
        };
      } else {
        console.log(`[analyzeUrlV2] Cache MISS for: ${normalizedUrl}`);
      }
    } else {
      console.log(`[analyzeUrlV2] Force refresh requested - bypassing cache`);
    }

    // Step 2: Execute pipeline with queue management
    console.log(`[analyzeUrlV2] Executing visual pipeline...`);
    result = await pipelineQueueService.execute(normalizedUrl, async () => {
      const pipelineResult = await executePipelineV2({
        url,
        tier,
        includeDebug,
      });

      // Step 3: Save to cache immediately after execution
      await this.saveToCache(normalizedUrl, url, pipelineResult);

      return pipelineResult;
    });

    // Add cache metadata to result (not cached)
    return {
      ...result,
      metadata: {
        ...result.metadata,
        cached: false,
      } as any,
    };
  }

  /**
   * V2.5 Preflight: Run visual pipeline and return clarification questions
   *
   * This runs BEFORE the full technical pipeline to gather user preferences.
   * No LLM-powered technical agents are run - only visual analysis + rule-based questions.
   */
  async preflightV25(options: PreflightV25Options): Promise<PreflightV25Result> {
    const startTime = Date.now();
    const { url, tier, forceRefresh = false } = options;

    console.log(`[Preflight V2.5] Starting preflight for: ${url}`);

    const normalizedUrl = normalizeUrl(url);
    let visualResult: PipelineV2Result;
    let fromCache = false;

    // Step 1: Run or fetch cached visual pipeline
    if (!forceRefresh) {
      const cached = await this.getFromCache(normalizedUrl);
      if (cached) {
        visualResult = this.reconstructPipelineResult(cached);
        fromCache = true;
        this.incrementCacheHit(cached.id).catch((err) =>
          console.error('[Preflight V2.5] Failed to increment cache hit:', err)
        );
        console.log(`[Preflight V2.5] Using cached visual result`);
      } else {
        console.log(`[Preflight V2.5] Cache MISS, running visual pipeline`);
        visualResult = await pipelineQueueService.execute(normalizedUrl, async () => {
          const pipelineResult = await executePipelineV2({ url, tier });
          await this.saveToCache(normalizedUrl, url, pipelineResult);
          return pipelineResult;
        });
      }
    } else {
      console.log(`[Preflight V2.5] Force refresh - running visual pipeline`);
      visualResult = await pipelineQueueService.execute(normalizedUrl, async () => {
        const pipelineResult = await executePipelineV2({ url, tier });
        await this.saveToCache(normalizedUrl, url, pipelineResult);
        return pipelineResult;
      });
    }

    // Step 2: Convert to VisualPipelineResult format
    const visualPipelineInput: VisualPipelineResult = {
      finalPrompt: visualResult.finalPrompt,
      metadata: visualResult.metadata,
      layoutAnalysis: visualResult.debug?.agentOutputs?.layoutAnalysis?.data as any,
      componentIdentification: visualResult.debug?.agentOutputs?.componentIdentification?.data as any,
      designSystem: visualResult.debug?.agentOutputs?.designSystem?.data as any,
    };

    // Step 3: Generate clarification questions (rule-based, no LLM)
    const preflight = generateClarificationQuestions(visualPipelineInput);

    const processingTimeMs = Date.now() - startTime;
    console.log(`[Preflight V2.5] Generated ${preflight.questions.length} questions in ${processingTimeMs}ms`);

    return {
      preflight,
      metadata: {
        sourceUrl: url,
        processingTimeMs,
        cached: fromCache,
      },
    };
  }

  /**
   * V2.5: Analyze a URL using Visual + Technical Architecture Pipeline
   *
   * Combines Visual Pipeline (V2) with Technical Architecture Pipeline:
   *
   * Visual Pipeline:
   * - Layout Analyzer, Component Identifier, Design System Extractor
   * - Includes global cache with 7-day TTL
   * - URL normalization and request queuing
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
      apiStyle = 'REST',
      tier,
      userId,
      includeDebug = false,
      forceRefresh = false,
      clarificationResponses,
    } = options;

    console.log(`[Pipeline V2.5] Starting analysis for: ${url}`);
    console.log(`[Pipeline V2.5] Pipeline type: ${pipelineType}, Detail level: ${detailLevel}`);

    // Normalize URL for cache lookup
    const normalizedUrl = normalizeUrl(url);
    console.log(`[Pipeline V2.5] Original URL: ${url}`);
    console.log(`[Pipeline V2.5] Normalized URL: ${normalizedUrl}`);

    let visualResult: PipelineV2Result | undefined;
    let technicalResult: TechnicalPipelineResult | undefined;
    let fromCache = false;
    let cachedAt: Date | undefined;

    // Step 1: Run Visual Pipeline (if needed)
    if (pipelineType === 'visual' || pipelineType === 'both') {
      console.log('[Pipeline V2.5] Running Visual Pipeline...');

      // Check cache first (unless forceRefresh)
      if (!forceRefresh) {
        const cached = await this.getFromCache(normalizedUrl);
        if (cached) {
          visualResult = this.reconstructPipelineResult(cached);
          fromCache = true;
          cachedAt = cached.cachedAt;

          // Increment hit count asynchronously
          this.incrementCacheHit(cached.id).catch((err) =>
            console.error('[Pipeline V2.5] Failed to increment cache hit:', err)
          );

          console.log(`[Pipeline V2.5] Using cached visual result from ${cachedAt?.toISOString()}`);
        } else {
          console.log(`[Pipeline V2.5] Cache MISS for: ${normalizedUrl}`);
        }
      } else {
        console.log(`[Pipeline V2.5] Force refresh requested - bypassing cache`);
      }

      // Execute pipeline if not cached
      if (!visualResult) {
        visualResult = await pipelineQueueService.execute(normalizedUrl, async () => {
          const pipelineResult = await executePipelineV2({
            url,
            tier,
            includeDebug,
          });

          // Save to cache immediately after execution
          await this.saveToCache(normalizedUrl, url, pipelineResult);

          return pipelineResult;
        });

        fromCache = false;
      }

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

      console.log('[Pipeline V2.5] Visual Pipeline Input prepared:', {
        hasVisualResult: !!visualResult,
        hasFinalPrompt: !!visualPipelineInput.finalPrompt,
        hasMetadata: !!visualPipelineInput.metadata,
        hasComponentIdentification: !!visualPipelineInput.componentIdentification,
        hasLayoutAnalysis: !!visualPipelineInput.layoutAnalysis,
        hasDesignSystem: !!visualPipelineInput.designSystem,
      });

      // Build clarifications if user provided responses
      let clarifications: { questions: ClarificationQuestion[]; responses: ClarificationResponse[] } | undefined;
      if (clarificationResponses && clarificationResponses.length > 0) {
        // Re-generate questions to pair with responses
        const preflight = generateClarificationQuestions(visualPipelineInput);
        clarifications = {
          questions: preflight.questions,
          responses: clarificationResponses.map((r) => ({
            questionId: r.questionId,
            selectedValues: r.selectedValues,
            customAnswer: r.customAnswer,
            timestamp: new Date(),
          })),
        };
        console.log(`[Pipeline V2.5] User provided ${clarificationResponses.length} clarification responses`);
      }

      technicalResult = await executeTechnicalPipeline({
        visualResults: visualPipelineInput,
        detailLevel,
        apiStyle,
        clarifications,
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
        cached: fromCache, // Whether visual pipeline result was from cache
        cachedAt: cachedAt, // When the cached result was originally created
      },
      debug: includeDebug
        ? {
            visualDebug: visualResult?.debug,
            technicalDebug: technicalResult,
          }
        : undefined,
    };
  }

  /**
   * Get visual pipeline result from cache
   *
   * @param normalizedUrl - Normalized URL
   * @returns Cached data or null if not found/expired
   */
  private async getFromCache(normalizedUrl: string): Promise<VisualPipelineCacheData | null> {
    try {
      const repo = getVisualPipelineCacheRepository();
      const cached = await repo.findByUrl(normalizedUrl);

      if (cached) {
        console.log(`[Cache HIT] Found cached visual result for: ${normalizedUrl}`);
        console.log(`[Cache] Hit count: ${cached.hitCount}, Cached at: ${cached.cachedAt.toISOString()}`);
      }

      return cached;
    } catch (error) {
      console.error('[Cache] Failed to retrieve from cache:', error);
      return null; // Graceful degradation - don't break pipeline if cache fails
    }
  }

  /**
   * Save visual pipeline result to cache
   *
   * @param normalizedUrl - Normalized URL
   * @param originalUrl - Original URL from request
   * @param result - Visual pipeline result
   */
  private async saveToCache(
    normalizedUrl: string,
    originalUrl: string,
    result: PipelineV2Result
  ): Promise<void> {
    try {
      const repo = getVisualPipelineCacheRepository();
      await repo.create({
        normalizedUrl,
        originalUrl,
        finalPrompt: result.finalPrompt,
        userQuestions: result.userQuestions,
        metadata: result.metadata,
        layoutAnalysis: result.debug?.agentOutputs?.layoutAnalysis?.data,
        componentIdentification: result.debug?.agentOutputs?.componentIdentification?.data,
        designSystem: result.debug?.agentOutputs?.designSystem?.data,
        ttlDays: 7,
      });
      console.log(`[Cache] Saved visual pipeline result for: ${normalizedUrl}`);
    } catch (error) {
      console.error('[Cache] Failed to save to cache:', error);
      // Don't throw - caching failure shouldn't break the pipeline flow
    }
  }

  /**
   * Increment cache hit count asynchronously
   *
   * @param cacheId - Cache entry ID
   */
  private async incrementCacheHit(cacheId: string): Promise<void> {
    try {
      const repo = getVisualPipelineCacheRepository();
      await repo.incrementHitCount(cacheId);
    } catch (error) {
      console.error('[Cache] Failed to increment cache hit:', error);
      // Silent failure - not critical
    }
  }

  /**
   * Reconstruct PipelineV2Result from cached data
   *
   * @param cached - Cached visual pipeline data
   * @returns Reconstructed pipeline result
   */
  private reconstructPipelineResult(cached: VisualPipelineCacheData): PipelineV2Result {
    return {
      finalPrompt: cached.finalPrompt,
      userQuestions: cached.userQuestions,
      metadata: cached.metadata,
      debug: {
        compressed: false,
        agentOutputs: {
          layoutAnalysis: cached.layoutAnalysis ? { data: cached.layoutAnalysis } : undefined,
          componentIdentification: cached.componentIdentification ? { data: cached.componentIdentification } : undefined,
          designSystem: cached.designSystem ? { data: cached.designSystem } : undefined,
        },
      },
    };
  }
}

export const analyzeService = new AnalyzeService();
