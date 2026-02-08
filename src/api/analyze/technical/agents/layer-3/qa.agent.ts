/**
 * QA Agent
 *
 * Layer 3 Agent that performs final quality assurance and auto-fixes issues.
 * Ensures frontend-backend alignment and fixes identified problems.
 * Runs in iteration cycles (max 3) until approval or limit reached.
 */

import {
  BaseTechnicalAgent,
  getXMLElementContent,
  getXMLAttribute,
} from '../../core/base-technical-agent';
import {
  TechnicalAgentInput,
  QAAgentOutput,
  QAAgentOutputSchema,
} from '../../core/technical-agent.types';
import { TECHNICAL_AGENT_CONFIGS } from '../../core/technical-agent-config';

class QAAgent extends BaseTechnicalAgent<QAAgentOutput> {
  constructor() {
    super(TECHNICAL_AGENT_CONFIGS.qa, QAAgentOutputSchema);
  }

  /**
   * Build user prompt with all previous outputs and validation results
   */
  protected buildUserPrompt(input: TechnicalAgentInput): string {
    const { visualResults, previousOutputs } = input;

    // Extract iteration from previous QA output if exists
    const previousQA = previousOutputs?.validationResult || '';
    const iterationMatch = previousQA.match(/iteration="(\d+)"/);
    const currentIteration = iterationMatch ? parseInt(iterationMatch[1], 10) + 1 : 1;

    return `Perform QA review iteration ${currentIteration}/3 on the PRD.

## CRITICAL: Frontend-Backend Alignment Check

You MUST verify that the Visual/Frontend analysis aligns with the Backend architecture.

### Visual/Frontend Analysis (what the UI needs):
\`\`\`
${visualResults.finalPrompt.substring(0, 2000)}${visualResults.finalPrompt.length > 2000 ? '...' : ''}
\`\`\`

### Components Detected:
${visualResults.componentIdentification?.components?.map((c) => `- ${c.type}: ${c.count}`).join('\n') || 'No components listed'}

### Layout Sections:
${visualResults.layoutAnalysis?.sections?.map((s) => `- ${s.type} (${s.position})`).join('\n') || 'No sections listed'}

---

## Current PRD Components

### User Stories & Product Requirements:
\`\`\`xml
${previousOutputs?.userStories?.substring(0, 2500) || 'NOT PROVIDED'}${(previousOutputs?.userStories?.length || 0) > 2500 ? '...' : ''}
\`\`\`

### Database Schema:
\`\`\`xml
${previousOutputs?.databaseSchema?.substring(0, 1500) || 'NOT PROVIDED'}${(previousOutputs?.databaseSchema?.length || 0) > 1500 ? '...' : ''}
\`\`\`

### Backend Architecture:
\`\`\`xml
${previousOutputs?.backendArchitecture?.substring(0, 2000) || 'NOT PROVIDED'}${(previousOutputs?.backendArchitecture?.length || 0) > 2000 ? '...' : ''}
\`\`\`

### Validation Results:
\`\`\`xml
${previousOutputs?.validationResult?.substring(0, 1500) || 'NOT PROVIDED'}${(previousOutputs?.validationResult?.length || 0) > 1500 ? '...' : ''}
\`\`\`

${previousOutputs?.skepticReview ? `### Skeptic Review (Challenged Assumptions):
\`\`\`xml
${previousOutputs.skepticReview.substring(0, 1500)}${previousOutputs.skepticReview.length > 1500 ? '...' : ''}
\`\`\`

**IMPORTANT**: The Skeptic Agent has flagged potential issues above. You MUST verify that high-severity challenges have been addressed or have sufficient evidence to dismiss.
` : ''}
---

## QA Instructions

1. **Identify Critiques** by severity:
   - CRITICAL: Security vulnerabilities, missing core functionality
   - MAJOR: Inconsistencies, missing error handling
   - MINOR: Code style, documentation gaps

2. **Auto-Fix Issues**:
   - For each critique, provide a modification
   - Show original vs modified XML/content
   - Explain the reason for the fix

3. **CRITICAL - Frontend-Backend Alignment Checks**:

   a) **API endpoints match UI actions**:
      - Does each form have a corresponding POST/PUT endpoint?
      - Does each list have a GET endpoint?
      - Does each delete button have a DELETE endpoint?

   b) **Form fields match database schema**:
      - Do form fields map to entity fields?
      - Are field types compatible?

   c) **Auth flow matches login UI**:
      - If social login buttons shown, are OAuth endpoints defined?
      - If MFA UI shown, is MFA backend supported?

   d) **Data requirements satisfied by API**:
      - Does each component have data source endpoints?
      - Are filters/search supported by API?

   e) **Visual interactions have backend support**:
      - Like/favorite buttons → endpoint?
      - Comments → endpoint?
      - Real-time features → WebSocket/subscription?

4. **NEW - User Stories Alignment Checks**:

   a) **Personas match UI components**:
      - Do personas align with detected UI components?
      - If admin panel exists, is there an admin persona?
      - If payment forms exist, is there a buyer persona?
      - If dashboard UI exists, is there a manager/owner persona?

   b) **Stories cover all detected features**:
      - For each form in UI, is there a create/edit story?
      - For each list/table in UI, is there a view/search story?
      - For each action button, is there a corresponding story?

   c) **Functional requirements link to architecture**:
      - Do functional requirements reference real endpoints?
      - Do functional requirements reference real database entities?
      - Are Given/When/Then scenarios realistic?

   d) **Edge cases are comprehensive**:
      - Network errors covered?
      - Authorization failures covered?
      - Invalid data scenarios covered?
      - User mistakes (cancel, go back, refresh) covered?
      - System limits (rate limit, quota) covered?

   e) **Success metrics are measurable**:
      - Can we actually measure these metrics?
      - Are targets realistic (not "100% perfection")?
      - Are measurement methods defined?

   f) **Dependencies are valid**:
      - Do story dependencies reference real story IDs?
      - Are dependency chains logical (no circular deps)?

5. **Summary**:
   - Count total issues by severity
   - Count how many were fixed

6. **Decision**:
   - Set requiresAnotherPass=true if CRITICAL issues remain after fixes
   - Set finalApproval=true if:
     * No critical issues remain
     * No more than 2 major issues remain
     * Frontend-backend alignment is verified
     * User stories alignment is verified

Current iteration: ${currentIteration}/3
${currentIteration >= 3 ? 'THIS IS THE FINAL ITERATION - must provide finalApproval decision.' : ''}

Output complete QA XML following the format in the system prompt.`;
  }

  /**
   * Parse XML output to structured data
   */
  protected parseXMLOutput(xmlContent: string): QAAgentOutput {
    // Extract iteration
    const iterationMatch = xmlContent.match(/<qa\s+iteration="(\d+)"/);
    const iteration = iterationMatch ? parseInt(iterationMatch[1], 10) : 1;

    // Extract critiques
    const critiques: QAAgentOutput['critiques'] = [];
    const critiqueMatches = xmlContent.match(/<critique\s+section="([^"]+)"\s+severity="([^"]+)"[^>]*>[\s\S]*?<\/critique>/g) || [];

    for (const match of critiqueMatches) {
      const sectionMatch = match.match(/section="([^"]+)"/);
      const severityMatch = match.match(/severity="([^"]+)"/);
      const issueMatch = match.match(/<issue>([^<]*)<\/issue>/);
      const fixMatch = match.match(/<suggestedFix>([^<]*)<\/suggestedFix>/);

      if (sectionMatch && severityMatch) {
        // Normalize severity to lowercase to handle case variations from LLM
        const normalizedSeverity = severityMatch[1].toLowerCase().trim();

        // Validate severity is one of the allowed values
        const validSeverities = ['critical', 'major', 'minor'] as const;
        if (!validSeverities.includes(normalizedSeverity as any)) {
          console.warn(`[QAAgent] Invalid severity value: ${severityMatch[1]}, skipping critique`);
          continue;
        }

        critiques.push({
          section: sectionMatch[1],
          severity: normalizedSeverity as 'critical' | 'major' | 'minor',
          issue: issueMatch?.[1] || 'Issue identified',
          suggestedFix: fixMatch?.[1] || 'Fix suggested',
        });
      }
    }

    // Extract modifications
    const modifications: QAAgentOutput['modifications'] = [];
    const modMatches = xmlContent.match(/<modification\s+section="([^"]+)"[^>]*>[\s\S]*?<\/modification>/g) || [];

    for (const match of modMatches) {
      const sectionMatch = match.match(/section="([^"]+)"/);
      const originalMatch = match.match(/<original>([^<]*)<\/original>/);
      const modifiedContent = match.match(/<modified>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/modified>/)?.[1] ||
        match.match(/<modified>([^<]*)<\/modified>/)?.[1] || '';
      const reasonMatch = match.match(/<reason>([^<]*)<\/reason>/);

      if (sectionMatch) {
        modifications.push({
          section: sectionMatch[1],
          original: originalMatch?.[1] || '',
          modified: modifiedContent.trim(),
          reason: reasonMatch?.[1] || 'Improvement',
        });
      }
    }

    // Extract frontend-backend alignment checks
    const alignmentChecks: QAAgentOutput['frontendBackendAlignmentChecks'] = [];
    const checkMatches = xmlContent.match(/<check\s+name="([^"]+)"\s+status="([^"]+)"[^>]*>[\s\S]*?<\/check>/g) || [];

    for (const match of checkMatches) {
      const nameMatch = match.match(/name="([^"]+)"/);
      const statusMatch = match.match(/status="([^"]+)"/);
      const issueMatch = match.match(/<issue>([^<]*)<\/issue>/);
      const fixMatch = match.match(/<fix>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/fix>/)?.[1] ||
        match.match(/<fix>([^<]*)<\/fix>/)?.[1];

      if (nameMatch && statusMatch) {
        // Normalize status to lowercase to handle case variations from LLM
        const normalizedStatus = statusMatch[1].toLowerCase().trim();

        // Validate status is one of the allowed values
        const validStatuses = ['pass', 'warning', 'fail'] as const;
        if (!validStatuses.includes(normalizedStatus as any)) {
          console.warn(`[QAAgent] Invalid status value: ${statusMatch[1]}, skipping alignment check`);
          continue;
        }

        alignmentChecks.push({
          name: nameMatch[1],
          status: normalizedStatus as 'pass' | 'warning' | 'fail',
          issue: issueMatch?.[1],
          fix: fixMatch?.trim(),
        });
      }
    }

    // Also handle self-closing checks
    const selfClosingChecks = xmlContent.match(/<check\s+name="([^"]+)"\s+status="([^"]+)"[^/>]*\/>/g) || [];
    for (const match of selfClosingChecks) {
      const nameMatch = match.match(/name="([^"]+)"/);
      const statusMatch = match.match(/status="([^"]+)"/);

      if (nameMatch && statusMatch) {
        // Normalize status to lowercase to handle case variations from LLM
        const normalizedStatus = statusMatch[1].toLowerCase().trim();

        // Validate status is one of the allowed values
        const validStatuses = ['pass', 'warning', 'fail'] as const;
        if (!validStatuses.includes(normalizedStatus as any)) {
          console.warn(`[QAAgent] Invalid status value in self-closing check: ${statusMatch[1]}, skipping`);
          continue;
        }

        alignmentChecks.push({
          name: nameMatch[1],
          status: normalizedStatus as 'pass' | 'warning' | 'fail',
        });
      }
    }

    // Extract decisions
    const requiresAnotherPassMatch = xmlContent.match(/<requiresAnotherPass>([^<]*)<\/requiresAnotherPass>/);
    const finalApprovalMatch = xmlContent.match(/<finalApproval>([^<]*)<\/finalApproval>/);

    const requiresAnotherPass = requiresAnotherPassMatch?.[1]?.toLowerCase() === 'true';
    const finalApproval = finalApprovalMatch?.[1]?.toLowerCase() === 'true';

    return {
      xml: xmlContent,
      iteration,
      critiques,
      modifications,
      frontendBackendAlignmentChecks: alignmentChecks,
      requiresAnotherPass,
      finalApproval,
    };
  }
}

// Export singleton instance
export const qaAgent = new QAAgent();
export default qaAgent;
