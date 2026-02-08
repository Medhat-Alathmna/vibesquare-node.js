/**
 * Skeptic Agent
 *
 * Layer 3 Agent that challenges assumptions, flags over-confidence,
 * and identifies unsupported inferences across the pipeline.
 * Non-critical: failure doesn't block the pipeline.
 */

import {
  BaseTechnicalAgent,
  getXMLElements,
  getXMLElementContent,
  getXMLAttribute,
} from '../../core/base-technical-agent';
import {
  TechnicalAgentInput,
  SkepticAgentOutput,
  SkepticAgentOutputSchema,
} from '../../core/technical-agent.types';
import { TECHNICAL_AGENT_CONFIGS } from '../../core/technical-agent-config';

class SkepticAgent extends BaseTechnicalAgent<SkepticAgentOutput> {
  constructor() {
    super(TECHNICAL_AGENT_CONFIGS.skeptic, SkepticAgentOutputSchema);
  }

  /**
   * Build user prompt with all previous outputs for skeptical review
   */
  protected buildUserPrompt(input: TechnicalAgentInput): string {
    const { visualResults, previousOutputs, productIdentity } = input;

    // Handle identity - could be string (XML) or object (ProductIdentity)
    let identityContent = 'NOT PROVIDED';
    if (productIdentity) {
      // Use productIdentity object if available
      identityContent = JSON.stringify(productIdentity, null, 2);
    } else if (typeof previousOutputs?.identity === 'string') {
      identityContent = previousOutputs.identity;
    } else if (previousOutputs?.identity && typeof previousOutputs.identity === 'object') {
      identityContent = JSON.stringify(previousOutputs.identity, null, 2);
    }
    const identityTruncated = identityContent.substring(0, 1500);
    const identityEllipsis = identityContent.length > 1500 ? '...' : '';

    return `Review the following PRD pipeline outputs and challenge unsupported assumptions.

## 1. Visual Analysis (Ground Truth)
\`\`\`
${visualResults.finalPrompt.substring(0, 2000)}${visualResults.finalPrompt.length > 2000 ? '...' : ''}
\`\`\`

## 2. Identity Analysis
\`\`\`json
${identityTruncated}${identityEllipsis}
\`\`\`

## 3. Database Schema
\`\`\`xml
${previousOutputs?.databaseSchema?.substring(0, 2000) || 'NOT PROVIDED'}${(previousOutputs?.databaseSchema?.length || 0) > 2000 ? '...' : ''}
\`\`\`

## 4. Backend Architecture
\`\`\`xml
${previousOutputs?.backendArchitecture?.substring(0, 2000) || 'NOT PROVIDED'}${(previousOutputs?.backendArchitecture?.length || 0) > 2000 ? '...' : ''}
\`\`\`

## 5. User Stories
\`\`\`xml
${previousOutputs?.userStories?.substring(0, 2000) || 'NOT PROVIDED'}${(previousOutputs?.userStories?.length || 0) > 2000 ? '...' : ''}
\`\`\`

## 6. Validation Result
\`\`\`xml
${previousOutputs?.validationResult?.substring(0, 1500) || 'NOT PROVIDED'}${(previousOutputs?.validationResult?.length || 0) > 1500 ? '...' : ''}
\`\`\`

## Review Instructions

Cross-reference ALL agent outputs against the Visual Analysis (Section 1). The visual analysis is the closest thing to ground truth we have.

1. For each database entity: Is there a visible UI element that implies this entity?
2. For each API endpoint: Is there a user action in the UI that would trigger this?
3. For each user story: Does the UI actually show this workflow?
4. For identity claims: Are product type, vision, and problem backed by visual signals?

Flag anything that appears to be:
- **Hallucinated**: No visual evidence at all
- **Over-specified**: Reasonable inference taken too far
- **Assumption cascade**: Built on another uncertain inference
- **Over-confident**: Reported high confidence without strong evidence

Output complete XML following the format in the system prompt.`;
  }

  /**
   * Parse XML output to structured data
   */
  protected parseXMLOutput(xmlContent: string): SkepticAgentOutput {
    // Extract challenged inferences
    const challengeElements = xmlContent.match(/<challenge\s+severity="([^"]+)">([\s\S]*?)<\/challenge>/g) || [];
    const challengedInferences: SkepticAgentOutput['challengedInferences'] = [];

    for (const elem of challengeElements) {
      const severityMatch = elem.match(/severity="([^"]+)"/);
      const inference = getXMLElementContent(elem, 'inference') || '';
      const reason = getXMLElementContent(elem, 'reason') || '';
      const altInterp = getXMLElementContent(elem, 'alternativeInterpretation');

      const rawSeverity = (severityMatch?.[1] || 'medium').toLowerCase();
      const severity = (['high', 'medium', 'low'] as const).includes(rawSeverity as any)
        ? (rawSeverity as 'high' | 'medium' | 'low')
        : 'medium';

      if (inference || reason) {
        challengedInferences.push({
          inference,
          challenge: reason,
          severity,
          alternativeInterpretation: altInterp || undefined,
        });
      }
    }

    // Extract over-confidence flags
    const flagElements = getXMLElements(xmlContent, 'flag');
    const overConfidenceFlags: SkepticAgentOutput['overConfidenceFlags'] = [];

    for (const flag of flagElements) {
      const area = getXMLElementContent(flag, 'area') || '';
      const currentConfidence = getXMLElementContent(flag, 'currentConfidence') || '';
      const justification = getXMLElementContent(flag, 'justification') || '';

      if (area || justification) {
        overConfidenceFlags.push({ area, currentConfidence, justification });
      }
    }

    // Extract high-risk assumptions
    const highRiskAssumptions = getXMLElements(xmlContent, 'assumption');

    // Extract summary
    const summary = getXMLElementContent(xmlContent, 'summary') || 'No summary provided.';

    return {
      xml: xmlContent,
      challengedInferences,
      overConfidenceFlags,
      highRiskAssumptions,
      summary,
    };
  }
}

// Export singleton instance
export const skepticAgent = new SkepticAgent();
export default skepticAgent;
