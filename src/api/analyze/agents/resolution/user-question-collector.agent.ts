/**
 * User Question Collector Agent
 *
 * Aggregates and prioritizes user questions from all agent ambiguities.
 */

import { z } from 'zod';
import { BaseAgent } from '../core/base-agent';
import { AGENT_CONFIGS } from '../core/agent-config';
import {
  AgentInput,
  AgentOutput,
  UserQuestionCollectorOutput,
  UserQuestion,
  Ambiguity,
  ConflictResolverOutput,
} from '../core/agent.types';

// ============ Output Schema ============

const UserQuestionSchema = z.object({
  section: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  defaultSuggestion: z.string(),
  criticality: z.enum(['high', 'medium', 'low']),
});

const UserQuestionCollectorOutputSchema = z.object({
  criticalQuestions: z.array(UserQuestionSchema),
  optionalQuestions: z.array(UserQuestionSchema),
  totalAmbiguities: z.number(),
  confidence: z.number().min(0).max(1).optional(),
});

// ============ Input Types ============

interface CollectorInput {
  allAmbiguities: Ambiguity[];
  conflictResolution?: AgentOutput<ConflictResolverOutput>;
}

// ============ User Question Collector Agent ============

export class UserQuestionCollectorAgent extends BaseAgent<UserQuestionCollectorOutput> {
  constructor() {
    super(AGENT_CONFIGS.userQuestionCollector, UserQuestionCollectorOutputSchema);
  }

  /**
   * Extract relevant data for question collection
   */
  protected extractRelevantData(input: AgentInput): unknown {
    const agentOutputs = input.previousOutputs as CollectorInput | undefined;

    // Collect all ambiguities from all agents
    const allAmbiguities: Ambiguity[] = agentOutputs?.allAmbiguities || [];

    // Get unresolved from conflict resolver
    const unresolvedAmbiguities =
      agentOutputs?.conflictResolution?.data.unresolvedAmbiguities || [];

    return {
      ambiguities: [...allAmbiguities, ...unresolvedAmbiguities],
      totalCount: allAmbiguities.length + unresolvedAmbiguities.length,
    };
  }

  /**
   * Build user prompt for question collection
   */
  protected buildUserPrompt(input: AgentInput): string {
    const data = this.extractRelevantData(input);

    return `Aggregate and prioritize these ambiguities into user questions.

## Ambiguities from All Agents:
${JSON.stringify(data, null, 2)}

## Your Task:
1. Group similar ambiguities
2. Create clear, user-friendly questions
3. Provide 2-4 options for each question
4. Suggest a default/recommended option
5. Prioritize by criticality

## Critical Sections (always include if ambiguous):
- Header positioning (fixed/static/sticky)
- Navigation behavior and mobile menu
- Hero section layout
- Primary CTA actions

## Optional (include only if significantly impacts UX):
- Card hover effects
- Animation timings
- Footer layout details
- Color variations

## Question Format:
- Clear, non-technical language
- 2-4 distinct options
- One option marked as recommended
- Criticality: high (affects UX), medium (affects visuals), low (minor detail)

Return your analysis as a JSON object following the specified schema.`;
  }

  /**
   * Custom confidence calculation
   */
  protected calculateConfidence(output: UserQuestionCollectorOutput): number {
    // Higher confidence when we've processed all ambiguities
    const totalQuestions = output.criticalQuestions.length + output.optionalQuestions.length;
    const processedRatio = totalQuestions > 0 ? totalQuestions / Math.max(output.totalAmbiguities, 1) : 1;

    return Math.min(0.7 + processedRatio * 0.3, 1);
  }
}

// ============ Export Singleton ============

export const userQuestionCollectorAgent = new UserQuestionCollectorAgent();
