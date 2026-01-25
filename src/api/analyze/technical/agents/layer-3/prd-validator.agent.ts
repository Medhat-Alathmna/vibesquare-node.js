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

## 2. User Stories & Product Requirements
\`\`\`xml
${previousOutputs?.userStories?.substring(0, 3000) || 'NOT PROVIDED'}${(previousOutputs?.userStories?.length || 0) > 3000 ? '...' : ''}
\`\`\`

## 3. Database Schema
\`\`\`xml
${previousOutputs?.databaseSchema?.substring(0, 2000) || 'NOT PROVIDED'}${(previousOutputs?.databaseSchema?.length || 0) > 2000 ? '...' : ''}
\`\`\`

## 4. Backend Architecture
\`\`\`xml
${previousOutputs?.backendArchitecture?.substring(0, 2000) || 'NOT PROVIDED'}${(previousOutputs?.backendArchitecture?.length || 0) > 2000 ? '...' : ''}
\`\`\`

## 5. Security Recommendations
\`\`\`xml
${previousOutputs?.securityRecommendations?.substring(0, 1500) || 'NOT PROVIDED'}${(previousOutputs?.securityRecommendations?.length || 0) > 1500 ? '...' : ''}
\`\`\`

## 6. Testing Strategy
\`\`\`xml
${previousOutputs?.testingStrategy?.substring(0, 1500) || 'NOT PROVIDED'}${(previousOutputs?.testingStrategy?.length || 0) > 1500 ? '...' : ''}
\`\`\`

## 7. DevOps Configuration
\`\`\`xml
${previousOutputs?.devopsConfig?.substring(0, 1500) || 'NOT PROVIDED'}${(previousOutputs?.devopsConfig?.length || 0) > 1500 ? '...' : ''}
\`\`\`

## Validation Instructions

1. **COMPLETENESS** (0-100):
   - Check if all required sections are present
   - Check if sections have sufficient detail
   - Verify personas are defined (2-4 personas expected)
   - Verify epics have business objectives
   - Verify features have business value statements
   - Verify stories have acceptance criteria AND edge cases
   - Identify missing items

2. **CONSISTENCY** (0-100):
   - Verify database entities match API endpoints
   - Verify auth roles match permission checks
   - Verify test cases cover endpoints
   - Verify personas match UI components (admin panel → admin persona)
   - Verify stories link to correct database entities
   - Verify stories link to correct API endpoints
   - Verify functional requirements reference real endpoints
   - Verify success metrics are measurable
   - Check for conflicts between sections

3. **SECURITY** (0-100):
   - Verify auth is required where needed
   - Check for missing security measures
   - Identify potential vulnerabilities

4. **IMPLEMENTABILITY** (0-100):
   - Can an AI code generator implement this?
   - Are specifications clear and unambiguous?
   - Is the scope reasonable?

5. **ACCEPTANCE CRITERIA QUALITY** (0-100):
   - Are acceptance criteria specific and testable?
   - Do criteria cover functional, UI, security, performance?
   - Are edge cases realistic and comprehensive?
   - Is error handling specified?

6. **NON-GOALS CLARITY** (0-100):
   - Are non-goals explicitly stated?
   - Do non-goals prevent scope creep?
   - Are reasons for non-goals clear?

7. **TRADEOFFS IDENTIFICATION** (0-100):
   - Are technical tradeoffs acknowledged?
   - Are business tradeoffs explained?
   - Are alternative approaches considered?

8. **OVERALL SCORE**: Weighted average of above scores

9. **APPROVAL**:
   - approved=true if overall >= 70 AND acceptanceCriteria >= 60 AND nonGoals >= 50
   - approved=false otherwise

Output complete validation XML with:
- <completeness score="X">...</completeness>
- <consistency score="X">...</consistency>
- <security score="X">...</security>
- <implementability score="X">...</implementability>
- <acceptanceCriteria score="X">...</acceptanceCriteria>
- <nonGoals score="X">...</nonGoals>
- <tradeoffs score="X">...</tradeoffs>
- <overall score="X" approved="true/false"/>
- <identifiedNonGoal>...</identifiedNonGoal> for each non-goal found
- <identifiedTradeoff>...</identifiedTradeoff> for each tradeoff found`;
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

    // Extract new user stories validation scores
    const acceptanceCriteriaMatch = xmlContent.match(/<acceptanceCriteria\s+score="(\d+)"/);
    const nonGoalsMatch = xmlContent.match(/<nonGoals\s+score="(\d+)"/);
    const tradeoffsMatch = xmlContent.match(/<tradeoffs\s+score="(\d+)"/);

    const scores = {
      completeness: completenessMatch ? parseInt(completenessMatch[1], 10) : 0,
      consistency: consistencyMatch ? parseInt(consistencyMatch[1], 10) : 0,
      security: securityMatch ? parseInt(securityMatch[1], 10) : 0,
      implementability: implementabilityMatch ? parseInt(implementabilityMatch[1], 10) : 0,
      acceptanceCriteria: acceptanceCriteriaMatch ? parseInt(acceptanceCriteriaMatch[1], 10) : 0,
      nonGoals: nonGoalsMatch ? parseInt(nonGoalsMatch[1], 10) : 0,
      tradeoffs: tradeoffsMatch ? parseInt(tradeoffsMatch[1], 10) : 0,
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
        // Normalize severity to lowercase to handle case variations from LLM
        const normalizedSeverity = severityMatch[1].toLowerCase().trim();

        // Validate severity is one of the allowed values
        const validSeverities = ['low', 'medium', 'high'] as const;
        if (!validSeverities.includes(normalizedSeverity as any)) {
          console.warn(`[PRDValidatorAgent] Invalid severity value: ${severityMatch[1]}, skipping issue`);
          continue;
        }

        issues.push({
          section: sectionMatch[1],
          severity: normalizedSeverity as 'low' | 'medium' | 'high',
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
        // Normalize severity to lowercase to handle case variations from LLM
        const normalizedSeverity = severityMatch[1].toLowerCase().trim();

        // Validate severity is one of the allowed values
        const validSeverities = ['low', 'medium', 'high'] as const;
        if (!validSeverities.includes(normalizedSeverity as any)) {
          console.warn(`[PRDValidatorAgent] Invalid severity value in conflict: ${severityMatch[1]}, skipping`);
          continue;
        }

        issues.push({
          section: 'Consistency',
          severity: normalizedSeverity as 'low' | 'medium' | 'high',
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
        // Normalize severity to lowercase to handle case variations from LLM
        const normalizedSeverity = severityMatch[1].toLowerCase().trim();

        // Validate severity is one of the allowed values
        const validSeverities = ['low', 'medium', 'high'] as const;
        if (!validSeverities.includes(normalizedSeverity as any)) {
          console.warn(`[PRDValidatorAgent] Invalid severity value in gap: ${severityMatch[1]}, skipping`);
          continue;
        }

        issues.push({
          section: areaMatch[1],
          severity: normalizedSeverity as 'low' | 'medium' | 'high',
          description: descMatch?.[1] || 'Security gap identified',
        });
      }
    }

    // Extract non-goals and tradeoffs identified
    const nonGoalsIdentified = this.extractListFromXML(xmlContent, 'identifiedNonGoal');
    const tradeoffsIdentified = this.extractListFromXML(xmlContent, 'identifiedTradeoff');

    // Approval requires overall >= 70, acceptanceCriteria >= 60, and nonGoals >= 50
    const approved = approvedMatch?.[1] === 'true' ||
      (scores.overall >= 70 && scores.acceptanceCriteria >= 60 && scores.nonGoals >= 50);

    return {
      xml: xmlContent,
      scores,
      issues,
      nonGoalsIdentified,
      tradeoffsIdentified,
      approved,
    };
  }

  /**
   * Extract list items from XML by tag name
   */
  private extractListFromXML(xmlContent: string, tagName: string): string[] {
    const items: string[] = [];
    const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'g');
    let match;

    while ((match = regex.exec(xmlContent)) !== null) {
      const text = match[1]?.trim();
      if (text) {
        items.push(text);
      }
    }

    return items;
  }
}

// Export singleton instance
export const prdValidatorAgent = new PRDValidatorAgent();
export default prdValidatorAgent;
