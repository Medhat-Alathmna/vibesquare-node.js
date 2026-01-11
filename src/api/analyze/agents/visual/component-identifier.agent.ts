/**
 * Component Identifier Agent
 *
 * Identifies UI components and patterns in ParsedDOM.
 * Uses layout analysis to focus on specific sections.
 */

import { z } from 'zod';
import { BaseAgent, flattenNodes, truncateText } from '../core/base-agent';
import { AGENT_CONFIGS } from '../core/agent-config';
import {
  AgentInput,
  ComponentIdentificationOutput,
  IdentifiedComponent,
  LayoutAnalysisOutput,
} from '../core/agent.types';
import { RawDOMNode } from '../../pipeline/ir.types';

// ============ Output Schema ============

const IdentifiedComponentSchema = z.object({
  type: z.enum([
    'card-grid',
    'testimonial-slider',
    'pricing-table',
    'feature-list',
    'hero-section',
    'navigation',
    'footer',
    'form',
    'cta-section',
    'gallery',
    'accordion',
    'tabs',
    'unknown',
  ]),
  nodeIds: z.array(z.number()),
  pattern: z.enum(['masonry', 'regular-grid', 'list', 'slider']).nullable().optional(),
  columns: z.number().nullable().optional(),
  repeatCount: z.number().nullable().optional(),
  visualCharacteristics: z.string(),
});

const ComponentIdentificationOutputSchema = z.object({
  components: z.array(IdentifiedComponentSchema),
  forms: z.array(
    z.object({
      nodeId: z.number(),
      purpose: z.enum(['contact', 'newsletter', 'login', 'search', 'checkout', 'unknown']),
      fieldCount: z.number(),
    })
  ),
  navigation: z
    .object({
      nodeId: z.number(),
      itemCount: z.number(),
      hasMobileMenu: z.boolean(),
    })
    .nullable(),
  confidence: z.number().min(0).max(1).optional(),
  ambiguities: z.array(z.string()).optional(),
});

// ============ Component Identifier Agent ============

export class ComponentIdentifierAgent extends BaseAgent<ComponentIdentificationOutput> {
  constructor() {
    super(AGENT_CONFIGS.componentIdentifier, ComponentIdentificationOutputSchema);
  }

  /**
   * Extract relevant data for component identification
   */
  protected extractRelevantData(input: AgentInput): unknown {
    const { parsedDOM } = input;
    const layoutAnalysis = input.previousOutputs?.layoutAnalysis as LayoutAnalysisOutput | undefined;

    // Flatten nodes
    const flatNodes = flattenNodes(parsedDOM.rootNodes as RawDOMNode[]);

    // Find repeated/deduplicated nodes (potential components)
    const repeatedNodes = flatNodes.filter((node: RawDOMNode) => node.repeatCount && node.repeatCount > 1);

    return {
      totalNodes: parsedDOM.totalNodes,
      // Navigation info
      navigation: parsedDOM.navigation,
      // Forms info
      forms: parsedDOM.allForms,
      // CTAs
      ctas: parsedDOM.ctas,
      // Footer
      footer: parsedDOM.footer,
      // CSS info for grid detection
      cssInfo: {
        gridColumns: parsedDOM.cssInfo.gridColumns,
        flexColumns: parsedDOM.cssInfo.flexColumns,
      },
      // Layout sections from previous agent (if available)
      layoutSections: layoutAnalysis?.sections,
      // Repeated nodes (likely components)
      repeatedNodes: repeatedNodes.slice(0, 20).map((node: RawDOMNode) => ({
        order: node.order,
        tag: node.tag,
        repeatCount: node.repeatCount,
        depth: node.depth,
        childCount: node.children?.length || 0,
        css: this.extractComponentCSS(node.cssProperties),
        text: node.textContent ? truncateText(node.textContent.trim(), 50) : '',
        hasImages: node.images && node.images.length > 0,
      })),
      // Sample of container nodes
      containers: flatNodes
        .filter((node: RawDOMNode) => node.isContainer && node.depth <= 3)
        .slice(0, 30)
        .map((node: RawDOMNode) => ({
          order: node.order,
          tag: node.tag,
          depth: node.depth,
          childCount: node.children?.length || 0,
          css: this.extractComponentCSS(node.cssProperties),
        })),
    };
  }

  /**
   * Extract component-relevant CSS properties
   */
  private extractComponentCSS(css?: Record<string, string>): Record<string, string> {
    if (!css) return {};

    const componentProps = [
      'display',
      'grid-template-columns',
      'gap',
      'border',
      'border-radius',
      'box-shadow',
      'background-color',
      'padding',
    ];

    const result: Record<string, string> = {};
    for (const prop of componentProps) {
      if (css[prop]) {
        result[prop] = css[prop];
      }
    }
    return result;
  }

  /**
   * Build user prompt for component identification
   */
  protected buildUserPrompt(input: AgentInput): string {
    const data = this.extractRelevantData(input);

    return `Identify UI components and patterns in this ParsedDOM structure.

## DOM Data:
${JSON.stringify(data, null, 2)}

## Your Task:
1. Identify repeated components (cards, testimonials, pricing tables, etc.)
2. Detect component patterns (grid, masonry, slider, list)
3. Identify forms and their purposes
4. Detect navigation structure
5. Note any ambiguities about component behavior

Look for:
- Repeated DOM structures (nodes with repeatCount > 1)
- Grid/flex containers with multiple similar children
- Form elements (input, textarea, button)
- Navigation patterns (lists of links)

Return your analysis as a JSON object following the specified schema.`;
  }

  /**
   * Custom confidence calculation
   */
  protected calculateConfidence(output: ComponentIdentificationOutput): number {
    let confidence = 0.6;

    // More components = higher confidence in analysis
    if (output.components.length > 0) confidence += 0.1;
    if (output.components.length > 3) confidence += 0.1;

    // Navigation detected
    if (output.navigation) confidence += 0.1;

    // Forms identified
    if (output.forms.length > 0) confidence += 0.1;

    return Math.min(confidence, 1);
  }
}

// ============ Export Singleton ============

export const componentIdentifierAgent = new ComponentIdentifierAgent();
