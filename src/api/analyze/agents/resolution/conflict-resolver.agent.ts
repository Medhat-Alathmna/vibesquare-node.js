/**
 * Conflict Resolver Agent
 *
 * Resolves conflicts between agent outputs using evidence and confidence scores.
 * Critical agent - pipeline fails if this agent fails.
 */

import { z } from 'zod';
import { BaseAgent } from '../core/base-agent';
import { AGENT_CONFIGS } from '../core/agent-config';
import {
  AgentInput,
  AgentOutput,
  ConflictResolverOutput,
  ResolvedDecision,
  Ambiguity,
  LayoutAnalysisOutput,
  ComponentIdentificationOutput,
  DesignSystemOutput,
  InteractionAnalysisOutput,
  ResponsiveBehaviorOutput,
} from '../core/agent.types';

// ============ Output Schema ============

const ResolvedDecisionSchema = z.object({
  conflict: z.string(),
  resolution: z.string(),
  reason: z.string(),
  evidence: z.string().nullable().optional(),
  agentSources: z.array(z.string()),
});

const AmbiguitySchema = z.object({
  section: z.string(),
  question: z.string(),
  reason: z.string(),
  criticality: z.enum(['high', 'medium', 'low']),
});

const ConflictResolverOutputSchema = z.object({
  resolvedDecisions: z.array(ResolvedDecisionSchema),
  unresolvedAmbiguities: z.array(AmbiguitySchema),
  confidence: z.number().min(0).max(1).optional(),
});

// ============ Input Types ============

interface ConflictResolverInput {
  layoutAnalysis?: AgentOutput<LayoutAnalysisOutput>;
  componentIdentification?: AgentOutput<ComponentIdentificationOutput>;
  designSystem?: AgentOutput<DesignSystemOutput>;
  interactionAnalysis?: AgentOutput<InteractionAnalysisOutput>;
  responsiveBehavior?: AgentOutput<ResponsiveBehaviorOutput>;
}

// ============ Conflict Resolver Agent ============

export class ConflictResolverAgent extends BaseAgent<ConflictResolverOutput> {
  constructor() {
    super(AGENT_CONFIGS.conflictResolver, ConflictResolverOutputSchema);
  }

  /**
   * Extract relevant data for conflict resolution
   */
  protected extractRelevantData(input: AgentInput): unknown {
    const agentOutputs = input.previousOutputs as ConflictResolverInput | undefined;

    if (!agentOutputs) {
      return { error: 'No agent outputs provided' };
    }

    // Collect all agent outputs with their confidence scores
    const outputs: Record<string, { data: unknown; confidence: number; ambiguities: Ambiguity[] }> = {};

    if (agentOutputs.layoutAnalysis) {
      outputs.layoutAnalysis = {
        data: agentOutputs.layoutAnalysis.data,
        confidence: agentOutputs.layoutAnalysis.confidence,
        ambiguities: agentOutputs.layoutAnalysis.ambiguities,
      };
    }

    if (agentOutputs.componentIdentification) {
      outputs.componentIdentification = {
        data: agentOutputs.componentIdentification.data,
        confidence: agentOutputs.componentIdentification.confidence,
        ambiguities: agentOutputs.componentIdentification.ambiguities,
      };
    }

    if (agentOutputs.designSystem) {
      outputs.designSystem = {
        data: agentOutputs.designSystem.data,
        confidence: agentOutputs.designSystem.confidence,
        ambiguities: agentOutputs.designSystem.ambiguities,
      };
    }

    if (agentOutputs.interactionAnalysis) {
      outputs.interactionAnalysis = {
        data: agentOutputs.interactionAnalysis.data,
        confidence: agentOutputs.interactionAnalysis.confidence,
        ambiguities: agentOutputs.interactionAnalysis.ambiguities,
      };
    }

    if (agentOutputs.responsiveBehavior) {
      outputs.responsiveBehavior = {
        data: agentOutputs.responsiveBehavior.data,
        confidence: agentOutputs.responsiveBehavior.confidence,
        ambiguities: agentOutputs.responsiveBehavior.ambiguities,
      };
    }

    // Extract key CSS evidence from ParsedDOM for resolution
    const cssEvidence = {
      gridColumns: input.parsedDOM.cssInfo.gridColumns,
      flexColumns: input.parsedDOM.cssInfo.flexColumns,
      hasResponsiveGrid: input.parsedDOM.cssInfo.hasResponsiveGrid,
      breakpoints: input.parsedDOM.cssInfo.breakpoints,
      topColors: input.parsedDOM.colors.slice(0, 5),
    };

    return {
      agentOutputs: outputs,
      cssEvidence,
      structuralInfo: {
        layoutType: input.structuralAnalysis.layoutType,
        hasNavigation: input.structuralAnalysis.hasNavigation,
        hasFooter: input.structuralAnalysis.hasFooter,
      },
    };
  }

  /**
   * Build user prompt for conflict resolution
   */
  protected buildUserPrompt(input: AgentInput): string {
    const data = this.extractRelevantData(input);

    return `Analyze these agent outputs and resolve any conflicts between them.

## Agent Outputs and Evidence:
${JSON.stringify(data, null, 2)}

## Your Task:
1. Detect conflicts between agent outputs
   - Layout vs Component disagreements
   - Design system inconsistencies
   - Interaction vs Responsive conflicts

2. Resolve conflicts using priority order:
   - Hard evidence in CSS (highest priority)
   - Higher confidence score
   - More specific agent wins (Component > Layout)
   - Design for visual, Layout for structure

3. Collect unresolved ambiguities
   - Section is critical (header, hero, navigation)
   - Multiple agents disagree with similar confidence
   - No hard evidence available
   - Decision significantly impacts UX

## Resolution Guidelines:
- If gridColumns exists in CSS, trust that over inferred values
- If position:fixed exists, header is fixed (not static)
- If agents agree, no conflict to resolve
- If only one agent speaks to a topic, accept it

Return your analysis as a JSON object following the specified schema.`;
  }

  /**
   * Custom confidence calculation
   */
  protected calculateConfidence(output: ConflictResolverOutput): number {
    // High confidence if few unresolved ambiguities
    const ambiguityPenalty = output.unresolvedAmbiguities.length * 0.1;
    const resolutionBonus = Math.min(output.resolvedDecisions.length * 0.05, 0.3);

    return Math.max(0.5, Math.min(1, 0.8 + resolutionBonus - ambiguityPenalty));
  }
}

// ============ Export Singleton ============

export const conflictResolverAgent = new ConflictResolverAgent();
