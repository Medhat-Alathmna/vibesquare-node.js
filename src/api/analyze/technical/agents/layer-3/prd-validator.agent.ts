/**
 * PRD Validator Agent
 *
 * Layer 3 Agent that validates PRD completeness, consistency, and quality.
 * Outputs XML with validation scores and identified issues.
 */

import {
  BaseTechnicalAgent,
  getXMLElementContent,
  getXMLAttribute,
} from '../../core/base-technical-agent';
import {
  TechnicalAgentInput,
  PRDValidatorOutput,
  PRDValidatorOutputSchema,
} from '../../core/technical-agent.types';
import { TECHNICAL_AGENT_CONFIGS } from '../../core/technical-agent-config';

class PRDValidatorAgent extends BaseTechnicalAgent<PRDValidatorOutput> {
  constructor() {
    super(TECHNICAL_AGENT_CONFIGS.prdValidator, PRDValidatorOutputSchema);
  }

  /**
   * Build user prompt with all previous outputs for validation
   */
  protected buildUserPrompt(input: TechnicalAgentInput): string {
    const { visualResults, previousOutputs } = input;

    return `Validate the following PRD components for completeness, consistency, security, and implementability.

## 1. Visual/Frontend Analysis
\`\`\`
${visualResults.finalPrompt.substring(0, 1500)}${visualResults.finalPrompt.length > 1500 ? '...' : ''}
\`\`\`

## 2. Database Schema
\`\`\`xml
${previousOutputs?.databaseSchema?.substring(0, 2000) || 'NOT PROVIDED'}${(previousOutputs?.databaseSchema?.length || 0) > 2000 ? '...' : ''}
\`\`\`

## 3. Backend Architecture
\`\`\`xml
${previousOutputs?.backendArchitecture?.substring(0, 2000) || 'NOT PROVIDED'}${(previousOutputs?.backendArchitecture?.length || 0) > 2000 ? '...' : ''}
\`\`\`

## 4. Security Recommendations
\`\`\`xml
${previousOutputs?.securityRecommendations?.substring(0, 1500) || 'NOT PROVIDED'}${(previousOutputs?.securityRecommendations?.length || 0) > 1500 ? '...' : ''}
\`\`\`

## 5. Testing Strategy
\`\`\`xml
${previousOutputs?.testingStrategy?.substring(0, 1500) || 'NOT PROVIDED'}${(previousOutputs?.testingStrategy?.length || 0) > 1500 ? '...' : ''}
\`\`\`

## 6. DevOps Configuration
\`\`\`xml
${previousOutputs?.devopsConfig?.substring(0, 1500) || 'NOT PROVIDED'}${(previousOutputs?.devopsConfig?.length || 0) > 1500 ? '...' : ''}
\`\`\`

## Validation Instructions

1. **COMPLETENESS** (0-100):
   - Check if all required sections are present
   - Check if sections have sufficient detail
   - Identify missing items

2. **CONSISTENCY** (0-100):
   - Verify database entities match API endpoints
   - Verify auth roles match permission checks
   - Verify test cases cover endpoints
   - Check for conflicts between sections

3. **SECURITY** (0-100):
   - Verify auth is required where needed
   - Check for missing security measures
   - Identify potential vulnerabilities

4. **IMPLEMENTABILITY** (0-100):
   - Can an AI code generator implement this?
   - Are specifications clear and unambiguous?
   - Is the scope reasonable?

5. **OVERALL SCORE**: Average of above scores

6. **APPROVAL**:
   - approved=true if overall >= 70 and no critical issues
   - approved=false otherwise

Output complete validation XML following the format in the system prompt.`;
  }

  /**
   * Parse XML output to structured data
   */
  protected parseXMLOutput(xmlContent: string): PRDValidatorOutput {
    // Extract scores
    const completenessMatch = xmlContent.match(/<completeness\s+score="(\d+)"/);
    const consistencyMatch = xmlContent.match(/<consistency\s+score="(\d+)"/);
    const securityMatch = xmlContent.match(/<security\s+score="(\d+)"/);
    const implementabilityMatch = xmlContent.match(/<implementability\s+score="(\d+)"/);
    const overallMatch = xmlContent.match(/<overall\s+score="(\d+)"/);
    const approvedMatch = xmlContent.match(/<overall[^>]+approved="([^"]+)"/);

    const scores = {
      completeness: completenessMatch ? parseInt(completenessMatch[1], 10) : 0,
      consistency: consistencyMatch ? parseInt(consistencyMatch[1], 10) : 0,
      security: securityMatch ? parseInt(securityMatch[1], 10) : 0,
      implementability: implementabilityMatch ? parseInt(implementabilityMatch[1], 10) : 0,
      overall: overallMatch ? parseInt(overallMatch[1], 10) : 0,
    };

    // Extract issues
    const issues: Array<{ section: string; severity: 'low' | 'medium' | 'high'; description: string }> = [];

    // From missing items
    const missingMatches = xmlContent.match(/<item\s+section="([^"]+)"\s+severity="([^"]+)"[^>]*>([^<]*)<\/item>/g) || [];
    for (const match of missingMatches) {
      const sectionMatch = match.match(/section="([^"]+)"/);
      const severityMatch = match.match(/severity="([^"]+)"/);
      const descMatch = match.match(/>([^<]*)<\/item>/);

      if (sectionMatch && severityMatch && descMatch) {
        issues.push({
          section: sectionMatch[1],
          severity: severityMatch[1] as 'low' | 'medium' | 'high',
          description: descMatch[1].trim(),
        });
      }
    }

    // From conflicts
    const conflictMatches = xmlContent.match(/<conflict\s+severity="([^"]+)"[^>]*>[\s\S]*?<\/conflict>/g) || [];
    for (const match of conflictMatches) {
      const severityMatch = match.match(/severity="([^"]+)"/);
      const source1 = match.match(/<source1>([^<]*)<\/source1>/)?.[1] || '';
      const source2 = match.match(/<source2>([^<]*)<\/source2>/)?.[1] || '';

      if (severityMatch) {
        issues.push({
          section: 'Consistency',
          severity: severityMatch[1] as 'low' | 'medium' | 'high',
          description: `${source1} vs ${source2}`,
        });
      }
    }

    // From gaps
    const gapMatches = xmlContent.match(/<gap\s+area="([^"]+)"\s+severity="([^"]+)"[^>]*>[\s\S]*?<\/gap>/g) || [];
    for (const match of gapMatches) {
      const areaMatch = match.match(/area="([^"]+)"/);
      const severityMatch = match.match(/severity="([^"]+)"/);
      const descMatch = match.match(/<description>([^<]*)<\/description>/);

      if (areaMatch && severityMatch) {
        issues.push({
          section: areaMatch[1],
          severity: severityMatch[1] as 'low' | 'medium' | 'high',
          description: descMatch?.[1] || 'Security gap identified',
        });
      }
    }

    const approved = approvedMatch?.[1] === 'true' || scores.overall >= 70;

    return {
      xml: xmlContent,
      scores,
      issues,
      approved,
    };
  }
}

// Export singleton instance
export const prdValidatorAgent = new PRDValidatorAgent();
export default prdValidatorAgent;
