/**
 * Layout Analyzer Agent
 *
 * Analyzes ParsedDOM to identify visual sections and layout patterns.
 * First agent in the visual layer - runs in parallel with other visual agents.
 */

import { z } from 'zod';
import { BaseAgent, flattenNodes, truncateText } from '../core/base-agent';
import { AGENT_CONFIGS } from '../core/agent-config';
import {
  AgentInput,
  LayoutAnalysisOutput,
  SectionInfo,
  LayoutPatternInfo,
  SectionVisualRole,
  LayoutPattern,
} from '../core/agent.types';
import { RawDOMNode } from '../../pipeline/ir.types';

// ============ Output Schema ============

const SectionInfoSchema = z.object({
  nodeIds: z.array(z.number()),
  visualRole: z.enum(['navigation', 'branding', 'impact', 'content', 'footer', 'sidebar', 'unknown']),
  confidence: z.number().min(0).max(1),
});

const LayoutAnalysisOutputSchema = z.object({
  sections: z.object({
    header: SectionInfoSchema.optional(),
    hero: SectionInfoSchema.optional(),
    body: z.array(SectionInfoSchema).optional(),
    sidebar: SectionInfoSchema.optional(),
    footer: SectionInfoSchema.optional(),
  }),
  layoutPatterns: z.object({
    primary: z.enum(['single-column', 'two-column', 'three-column', 'grid', 'masonry', 'mixed']),
    gridColumns: z.number().nullable().optional(),
    breakpoints: z.array(z.string()),
  }),
  visualHierarchy: z.object({
    depth: z.number(),
    mainContentPath: z.array(z.number()),
  }),
  confidence: z.number().min(0).max(1).optional(),
  ambiguities: z.array(z.string()).optional(),
});

// ============ Layout Analyzer Agent ============

export class LayoutAnalyzerAgent extends BaseAgent<LayoutAnalysisOutput> {
  constructor() {
    super(AGENT_CONFIGS.layoutAnalyzer, LayoutAnalysisOutputSchema);
  }

  /**
   * Extract relevant data from ParsedDOM for layout analysis
   */
  protected extractRelevantData(input: AgentInput): unknown {
    const { parsedDOM, structuralAnalysis } = input;

    // Flatten nodes for analysis
    const flatNodes = flattenNodes(parsedDOM.rootNodes as RawDOMNode[]);

    // Extract key layout information
    return {
      totalNodes: structuralAnalysis.nodeCount,
      maxDepth: structuralAnalysis.maxDepth,
      layoutType: structuralAnalysis.layoutType,
      hasNavigation: structuralAnalysis.hasNavigation,
      hasFooter: structuralAnalysis.hasFooter,
      rootNodeCount: parsedDOM.rootNodes.length,
      cssInfo: {
        gridColumns: parsedDOM.cssInfo.gridColumns,
        flexColumns: parsedDOM.cssInfo.flexColumns,
        breakpoints: parsedDOM.cssInfo.breakpoints,
        hasResponsiveGrid: parsedDOM.cssInfo.hasResponsiveGrid,
      },
      // Summarize nodes with layout-relevant CSS
      nodes: flatNodes.slice(0, 100).map((node: RawDOMNode) => ({
        order: node.order,
        tag: node.tag,
        depth: node.depth,
        isContainer: node.isContainer,
        childCount: node.children?.length || 0,
        text: node.textContent ? truncateText(node.textContent.trim(), 30) : '',
        css: this.extractLayoutCSS(node.cssProperties),
      })),
    };
  }

  /**
   * Extract only layout-relevant CSS properties
   */
  private extractLayoutCSS(css?: Record<string, string>): Record<string, string> {
    if (!css) return {};

    const layoutProps = [
      'display',
      'position',
      'flex-direction',
      'flex-wrap',
      'grid-template-columns',
      'grid-template-rows',
      'gap',
      'width',
      'max-width',
      'height',
      'min-height',
      'padding',
      'margin',
      'z-index',
    ];

    const result: Record<string, string> = {};
    for (const prop of layoutProps) {
      if (css[prop]) {
        result[prop] = css[prop];
      }
    }
    return result;
  }

  /**
   * Build user prompt for layout analysis
   */
  protected buildUserPrompt(input: AgentInput): string {
    const data = this.extractRelevantData(input);

    return `Analyze this ParsedDOM structure and identify visual sections and layout patterns.

## DOM Structure Summary:
${JSON.stringify(data, null, 2)}

## Your Task:
1. Identify the major visual sections (header, hero, body sections, sidebar, footer)
2. Detect the primary layout pattern (single-column, grid, etc.)
3. Note any breakpoints for responsive design
4. Determine the visual hierarchy depth
5. List any ambiguities that need clarification

Return your analysis as a JSON object following the specified schema.`;
  }

  /**
   * Custom confidence calculation based on section detection
   */
  protected calculateConfidence(output: LayoutAnalysisOutput): number {
    let confidence = 0.5;

    // Increase confidence for each detected section
    if (output.sections.header) confidence += 0.1;
    if (output.sections.hero) confidence += 0.1;
    if (output.sections.body && output.sections.body.length > 0) confidence += 0.1;
    if (output.sections.footer) confidence += 0.1;

    // Increase for clear layout pattern
    if (output.layoutPatterns.primary !== 'mixed') confidence += 0.1;

    return Math.min(confidence, 1);
  }
}

// ============ Export Singleton ============

export const layoutAnalyzerAgent = new LayoutAnalyzerAgent();
