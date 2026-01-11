/**
 * Prompt Synthesizer Agent
 *
 * Synthesizes a production-ready prompt from all agent outputs.
 * Critical agent - pipeline fails if this agent fails.
 */

import { z } from 'zod';
import { BaseAgent } from '../core/base-agent';
import { AGENT_CONFIGS } from '../core/agent-config';
import {
  AgentInput,
  AgentOutput,
  PromptSynthesizerOutput,
  LayoutAnalysisOutput,
  ComponentIdentificationOutput,
  DesignSystemOutput,
  InteractionAnalysisOutput,
  ResponsiveBehaviorOutput,
  ConflictResolverOutput,
} from '../core/agent.types';

// ============ Output Schema ============

const PromptSynthesizerOutputSchema = z.object({
  finalPrompt: z.string(),
  sectionsIncluded: z.array(z.string()),
  imagesReferenced: z.number(),
  decisionsApplied: z.number(),
  confidence: z.number().min(0).max(1).optional(),
});

// ============ Input Types ============

interface SynthesizerInput {
  layoutAnalysis?: AgentOutput<LayoutAnalysisOutput>;
  componentIdentification?: AgentOutput<ComponentIdentificationOutput>;
  designSystem?: AgentOutput<DesignSystemOutput>;
  interactionAnalysis?: AgentOutput<InteractionAnalysisOutput>;
  responsiveBehavior?: AgentOutput<ResponsiveBehaviorOutput>;
  conflictResolution?: AgentOutput<ConflictResolverOutput>;
}

// ============ Prompt Synthesizer Agent ============

export class PromptSynthesizerAgent extends BaseAgent<PromptSynthesizerOutput> {
  constructor() {
    super(AGENT_CONFIGS.promptSynthesizer, PromptSynthesizerOutputSchema);
  }

  /**
   * Extract relevant data for prompt synthesis
   */
  protected extractRelevantData(input: AgentInput): unknown {
    const agentOutputs = input.previousOutputs as SynthesizerInput | undefined;
    const { parsedDOM } = input;

    // Collect all findings
    const synthesis: Record<string, unknown> = {};

    // Layout info
    if (agentOutputs?.layoutAnalysis) {
      synthesis.layout = {
        sections: agentOutputs.layoutAnalysis.data.sections,
        patterns: agentOutputs.layoutAnalysis.data.layoutPatterns,
      };
    }

    // Components
    if (agentOutputs?.componentIdentification) {
      synthesis.components = agentOutputs.componentIdentification.data.components;
      synthesis.forms = agentOutputs.componentIdentification.data.forms;
      synthesis.navigation = agentOutputs.componentIdentification.data.navigation;
    }

    // Design system
    if (agentOutputs?.designSystem) {
      synthesis.designSystem = agentOutputs.designSystem.data;
    }

    // Interactions
    if (agentOutputs?.interactionAnalysis) {
      synthesis.interactions = agentOutputs.interactionAnalysis.data.interactions;
      synthesis.hoverEffects = agentOutputs.interactionAnalysis.data.hoverEffects;
    }

    // Responsive
    if (agentOutputs?.responsiveBehavior) {
      synthesis.responsive = {
        breakpoints: agentOutputs.responsiveBehavior.data.breakpoints,
        mobilePatterns: agentOutputs.responsiveBehavior.data.mobilePatterns,
      };
    }

    // Conflict resolutions
    if (agentOutputs?.conflictResolution) {
      synthesis.resolvedDecisions = agentOutputs.conflictResolution.data.resolvedDecisions;
      synthesis.unresolvedAmbiguities = agentOutputs.conflictResolution.data.unresolvedAmbiguities;
    }

    // Images from ParsedDOM
    synthesis.images = parsedDOM.allImages.map((img) => ({
      url: img.url,
      alt: img.alt,
    }));

    // Metadata
    synthesis.metadata = {
      title: parsedDOM.metadata.title,
      description: parsedDOM.metadata.description,
      language: parsedDOM.language,
    };

    return synthesis;
  }

  /**
   * Build user prompt for synthesis
   */
  protected buildUserPrompt(input: AgentInput): string {
    const data = this.extractRelevantData(input);

    return `Synthesize a production-ready prompt from these agent findings.

## Agent Findings:
${JSON.stringify(data, null, 2)}

## Your Task:
Create a comprehensive, professional prompt for an AI Code Generator.

## Required Sections in finalPrompt:

### 1. VISUAL IDENTITY
- Primary color: [hex]
- Secondary color: [hex]
- Accent color: [hex]
- Typography: Heading font, Body font
- Visual tone: [modern/minimal/bold/etc.]

### 2. LAYOUT STRUCTURE
- Overall layout: [single-column/grid/etc.]
- Grid columns: [number]
- Responsive behavior: [breakpoints and changes]

### 3. SECTIONS (in order)
For each section (header, hero, body sections, footer):
- Purpose and role
- Key elements
- Layout within section
- Any specific behaviors

### 4. COMPONENTS
For each identified component:
- Type (cards, testimonials, etc.)
- Visual characteristics
- Behavior (hover, click, animations)
- Responsive changes

### 5. INTERACTIONS
- Page load animations
- Scroll effects
- Hover states
- Click behaviors

### 6. IMAGES
List all image URLs with their context:
- [URL] - used in [section] for [purpose]

### 7. CLARIFICATIONS NEEDED (if any)
List any unresolved ambiguities as user questions.

## Rules:
- Be descriptive but concise
- Include exact hex colors
- Include exact font names
- Reference image URLs exactly as provided
- Include all resolved decisions
- Note any assumptions made

Return your synthesis as a JSON object with finalPrompt as a complete, formatted string.`;
  }

  /**
   * Custom confidence calculation
   */
  protected calculateConfidence(output: PromptSynthesizerOutput): number {
    // Base confidence on completeness
    let confidence = 0.6;

    // More sections = more complete
    if (output.sectionsIncluded.length >= 3) confidence += 0.1;
    if (output.sectionsIncluded.length >= 5) confidence += 0.1;

    // Decisions applied
    if (output.decisionsApplied > 0) confidence += 0.1;

    // Images referenced
    if (output.imagesReferenced > 0) confidence += 0.1;

    return Math.min(confidence, 1);
  }
}

// ============ Export Singleton ============

export const promptSynthesizerAgent = new PromptSynthesizerAgent();
