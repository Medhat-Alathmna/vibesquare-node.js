/**
 * Design System Extractor Agent
 *
 * Extracts visual design system from ParsedDOM.
 * Focuses on colors, fonts, spacing, and visual identity.
 */

import { z } from 'zod';
import { BaseAgent } from '../core/base-agent';
import { AGENT_CONFIGS } from '../core/agent-config';
import { AgentInput, DesignSystemOutput } from '../core/agent.types';

// ============ Output Schema ============

const DesignSystemOutputSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string().nullable().optional(),
    accent: z.string().nullable().optional(),
    background: z.string().nullable().optional(),
    text: z.string().nullable().optional(),
  }),
  fonts: z.object({
    heading: z
      .object({
        family: z.string(),
        source: z.enum(['google', 'system', 'custom']),
      })
      .nullable()
      .optional(),
    body: z
      .object({
        family: z.string(),
        source: z.enum(['google', 'system', 'custom']),
      })
      .nullable()
      .optional(),
  }),
  spacing: z.object({
    system: z.enum(['consistent', 'mixed']),
    baseUnit: z.string().nullable().optional(),
  }),
  visualIdentity: z.object({
    tone: z.enum(['corporate', 'modern', 'playful', 'minimal', 'bold', 'retro', 'unknown']),
    density: z.enum(['compact', 'balanced', 'spacious']),
    contrast: z.enum(['low', 'medium', 'high']),
  }),
  confidence: z.number().min(0).max(1).optional(),
  ambiguities: z.array(z.string()).optional(),
});

// ============ Design System Extractor Agent ============

export class DesignSystemExtractorAgent extends BaseAgent<DesignSystemOutput> {
  constructor() {
    super(AGENT_CONFIGS.designSystemExtractor, DesignSystemOutputSchema);
  }

  /**
   * Extract relevant data for design system extraction
   */
  protected extractRelevantData(input: AgentInput): unknown {
    const { parsedDOM } = input;

    // Sort colors by frequency
    const sortedColors = [...parsedDOM.colors].sort((a, b) => b.frequency - a.frequency);

    // Group colors by property
    const backgroundColors = sortedColors.filter((c) => c.property === 'background-color');
    const textColors = sortedColors.filter((c) => c.property === 'color');
    const borderColors = sortedColors.filter((c) => c.property === 'border-color');

    return {
      // Colors
      colors: {
        all: sortedColors.slice(0, 20),
        backgrounds: backgroundColors.slice(0, 10),
        texts: textColors.slice(0, 10),
        borders: borderColors.slice(0, 5),
      },
      // Fonts
      fonts: parsedDOM.fonts,
      // CSS classes for spacing analysis
      cssClasses: parsedDOM.cssInfo.classes.slice(0, 30).map((cls) => ({
        className: cls.className,
        properties: this.extractSpacingProps(cls.properties),
      })),
      // Breakpoints for density analysis
      breakpoints: parsedDOM.cssInfo.breakpoints,
      // Metadata for context
      metadata: {
        title: parsedDOM.metadata.title,
        description: parsedDOM.metadata.description,
      },
    };
  }

  /**
   * Extract spacing-related CSS properties
   */
  private extractSpacingProps(props: Record<string, string>): Record<string, string> {
    const spacingProps = [
      'padding',
      'padding-top',
      'padding-bottom',
      'padding-left',
      'padding-right',
      'margin',
      'margin-top',
      'margin-bottom',
      'margin-left',
      'margin-right',
      'gap',
      'row-gap',
      'column-gap',
    ];

    const result: Record<string, string> = {};
    for (const prop of spacingProps) {
      if (props[prop]) {
        result[prop] = props[prop];
      }
    }
    return result;
  }

  /**
   * Build user prompt for design system extraction
   */
  protected buildUserPrompt(input: AgentInput): string {
    const data = this.extractRelevantData(input);

    return `Extract the visual design system from this ParsedDOM data.

## Design Data:
${JSON.stringify(data, null, 2)}

## Your Task:
1. Identify primary, secondary, and accent colors
   - Primary: Most prominent/branded color
   - Secondary: Supporting color
   - Accent: Highlight/CTA color
   - Default to #000000 if no clear primary

2. Identify font families
   - Heading font (used for titles, headings)
   - Body font (used for paragraphs, content)

3. Analyze spacing patterns
   - Is there a consistent base unit (4px, 8px, etc.)?
   - Or is spacing mixed/inconsistent?

4. Infer visual identity
   - Tone: corporate, modern, playful, minimal, bold, retro
   - Density: compact, balanced, spacious
   - Contrast: low, medium, high

Return your analysis as a JSON object following the specified schema.`;
  }

  /**
   * Custom confidence calculation
   */
  protected calculateConfidence(output: DesignSystemOutput): number {
    let confidence = 0.7;

    // Clear primary color
    if (output.colors.primary && output.colors.primary !== '#000000') {
      confidence += 0.1;
    }

    // Fonts identified
    if (output.fonts.heading || output.fonts.body) {
      confidence += 0.1;
    }

    // Consistent spacing system
    if (output.spacing.system === 'consistent' && output.spacing.baseUnit) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }
}

// ============ Export Singleton ============

export const designSystemExtractorAgent = new DesignSystemExtractorAgent();
