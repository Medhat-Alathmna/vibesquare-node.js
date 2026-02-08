/**
 * Identity Agent
 *
 * Layer 0 Agent that extracts the "soul" of the product from Visual Pipeline results.
 * Outputs XML with product vision, problem statement, value proposition, and AI coder context.
 *
 * This agent runs BEFORE all other agents and provides foundational context.
 */

import {
  BaseTechnicalAgent,
  getXMLElements,
  getXMLElementContent,
  getSelfClosingElementAttributes,
} from '../../core/base-technical-agent';
import {
  TechnicalAgentInput,
  IdentityAgentOutput,
  IdentityAgentOutputSchema,
  ProductIdentity,
  ProductVision,
  IdentityProblemStatement,
  ValueProposition,
  AICoderContext,
  AffectedSegment,
  TechnicalSpirit,
  AgentConfidenceScore,
  ConfidenceBreakdown,
  InferenceConfidence,
  getConfidenceLevel,
  CONFIDENCE_THRESHOLDS,
} from '../../core/technical-agent.types';
import { TECHNICAL_AGENT_CONFIGS } from '../../core/technical-agent-config';

class IdentityAgent extends BaseTechnicalAgent<IdentityAgentOutput> {
  constructor() {
    super(TECHNICAL_AGENT_CONFIGS.identity, IdentityAgentOutputSchema);
  }

  /**
   * Build user prompt from visual pipeline results
   */
  protected buildUserPrompt(input: TechnicalAgentInput): string {
    const { visualResults } = input;

    // Validate input
    if (!visualResults) {
      throw new Error('visualResults is required but was undefined');
    }

    if (!visualResults.metadata) {
      throw new Error('visualResults.metadata is required but was undefined');
    }

    // Extract relevant information from visual analysis
    const components = visualResults.componentIdentification?.components || [];
    const layoutSections = visualResults.layoutAnalysis?.sections || [];
    const designInfo = visualResults.designSystem || {};
    const metadata = visualResults.metadata;

    // Build component summary for context
    const componentSummary = components
      .map((c) => `- ${c.type}: ${c.count} instance(s)${c.details ? ` - ${c.details}` : ''}`)
      .join('\n');

    // Build section summary
    const sectionSummary = layoutSections
      .map((s) => `- ${s.type} (${s.position})${s.content ? `: ${s.content}` : ''}`)
      .join('\n');

    // Identify key UI patterns for product type inference
    const hasAuth = components.some((c) =>
      ['login', 'register', 'auth', 'signup', 'signin', 'profile'].includes(c.type.toLowerCase())
    );
    const hasDashboard = components.some((c) =>
      ['dashboard', 'chart', 'stats', 'analytics', 'graph'].includes(c.type.toLowerCase())
    );
    const hasEcommerce = components.some((c) =>
      ['cart', 'checkout', 'product', 'price', 'buy', 'shop'].includes(c.type.toLowerCase())
    );
    const hasSocial = components.some((c) =>
      ['feed', 'post', 'comment', 'like', 'share', 'follow'].includes(c.type.toLowerCase())
    );
    const hasContent = components.some((c) =>
      ['article', 'blog', 'content', 'editor', 'cms'].includes(c.type.toLowerCase())
    );

    // Infer product category
    const productHints: string[] = [];
    if (hasAuth) productHints.push('User authentication system');
    if (hasDashboard) productHints.push('Dashboard/Analytics platform');
    if (hasEcommerce) productHints.push('E-commerce/Shopping');
    if (hasSocial) productHints.push('Social/Community features');
    if (hasContent) productHints.push('Content management');

    return `Analyze this website and extract its Product Identity - the "soul" of what this product is trying to achieve.

## Visual Analysis Results

### Source URL
${metadata.sourceUrl || 'Not provided'}

### Page Layout
${sectionSummary || 'No specific sections identified'}

### UI Components Found
${componentSummary || 'No specific components identified'}

### Detected Product Patterns
${productHints.length > 0 ? productHints.map((h) => `- ${h}`).join('\n') : 'No specific patterns detected'}

### Visual Identity
- Primary Color: ${(designInfo as any)?.colors?.primary || 'Not detected'}
- Visual Tone: ${(designInfo as any)?.visualTone || 'Not detected'}
- Layout Type: ${metadata.layoutType || 'Not detected'}
- Difficulty: ${metadata.difficulty || 'Not detected'}
- Language: ${metadata.language || 'Not detected'}

### Full Visual Description
${visualResults.finalPrompt.substring(0, 3000)}${visualResults.finalPrompt.length > 3000 ? '...' : ''}

## Instructions

Based on the above analysis, extract the Product Identity.

**Formal Instruction**: If the analysis does not provide sufficient evidence to conclude a specific element (such as Vision, Problem Statement, Value Proposition, or specific context details), you MUST explicitly state that the element was "not inferred from the analysis". Do not provide speculative or generic content.

1. **Vision** - What is this product trying to become?
   - Write a clear, inspiring vision statement
   - Describe the future state when the vision is achieved
   - Explain how users' lives will be transformed
   - Suggest a reasonable timeframe (1-3 years, 3-5 years, etc.)

2. **Problem Statement** - What problem does this solve?
   - Identify the CORE problem (one main problem)
   - Who is affected? List 2-4 user segments with pain levels (1-10)
   - What happens if this problem isn't solved? (cost of inaction)
   - What do people currently use instead? (existing solutions)

3. **Value Proposition** - Why choose this product?
   - What unique value does it provide?
   - List 3-5 key benefits with their impact
   - What's the competitive advantage?
   - Who is the primary target audience?

4. **AI Coder Context** - Help AI coders understand quickly
   - Write a 2-3 sentence product summary for context window
   - Identify the technical spirit: modern, legacy, enterprise, or startup
   - List 5-10 core domain entities (the main "nouns")
   - List 3-5 critical user flows (the main "verbs")
   - Note any important constraints or considerations

Output the complete XML following the format specified in the system prompt.
Rate your confidence in this analysis (0-100).`;
  }

  /**
   * Parse XML output to structured data
   */
  protected parseXMLOutput(xmlContent: string): IdentityAgentOutput {
    // Parse Vision
    const visionContent = getXMLElementContent(xmlContent, 'vision') || '';
    const vision: ProductVision = {
      statement: getXMLElementContent(visionContent, 'statement') || '',
      futureState: getXMLElementContent(visionContent, 'future_state') || '',
      transformation: getXMLElementContent(visionContent, 'transformation') || '',
      timeframe: getXMLElementContent(visionContent, 'timeframe'),
    };

    // Parse Problem Statement
    const problemContent = getXMLElementContent(xmlContent, 'problem_statement') || '';
    const segmentsContent = getXMLElementContent(problemContent, 'affected_segments') || '';
    const segmentElements = getXMLElements(segmentsContent, 'segment');

    const affectedSegments: AffectedSegment[] = segmentElements.map((seg) => ({
      name: getXMLElementContent(seg, 'name') || '',
      size: getXMLElementContent(seg, 'size'),
      painLevel: parseInt(getXMLElementContent(seg, 'pain_level') || '5', 10),
    }));

    const problemStatement: IdentityProblemStatement = {
      coreProblem: getXMLElementContent(problemContent, 'core_problem') || '',
      affectedSegments,
      costOfInaction: getXMLElementContent(problemContent, 'cost_of_inaction') || '',
      existingSolutions: getXMLElementContent(problemContent, 'existing_solutions'),
    };

    // Parse Value Proposition
    const valueContent = getXMLElementContent(xmlContent, 'value_proposition') || '';
    const benefitsContent = getXMLElementContent(valueContent, 'key_benefits') || '';
    const benefitElements = getXMLElements(benefitsContent, 'benefit');

    const keyBenefits = benefitElements.map((ben) => ({
      name: getXMLElementContent(ben, 'name') || '',
      impact: getXMLElementContent(ben, 'impact') || '',
    }));

    const valueProposition: ValueProposition = {
      uniqueValue: getXMLElementContent(valueContent, 'unique_value') || '',
      keyBenefits,
      competitiveAdvantage: getXMLElementContent(valueContent, 'competitive_advantage'),
      targetAudience: getXMLElementContent(valueContent, 'target_audience') || '',
    };

    // Parse AI Coder Context
    const aiContent = getXMLElementContent(xmlContent, 'ai_coder_context') || '';

    // Parse core entities
    const entitiesContent = getXMLElementContent(aiContent, 'core_entities') || '';
    const entityElements = getXMLElements(entitiesContent, 'entity');
    const coreEntities = entityElements.map((e) => e.trim()).filter((e) => e.length > 0);

    // Parse critical flows
    const flowsContent = getXMLElementContent(aiContent, 'critical_flows') || '';
    const flowElements = getXMLElements(flowsContent, 'flow');
    const criticalFlows = flowElements.map((f) => f.trim()).filter((f) => f.length > 0);

    // Parse constraints
    const constraintsContent = getXMLElementContent(aiContent, 'constraints') || '';
    const constraintElements = getXMLElements(constraintsContent, 'constraint');
    const constraints = constraintElements.map((c) => c.trim()).filter((c) => c.length > 0);

    // Parse technical spirit
    const spiritRaw = getXMLElementContent(aiContent, 'technical_spirit') || 'modern';
    const technicalSpirit = ['modern', 'legacy', 'enterprise', 'startup'].includes(spiritRaw.toLowerCase())
      ? (spiritRaw.toLowerCase() as TechnicalSpirit)
      : 'modern';

    const aiCoderContext: AICoderContext = {
      productSummary: getXMLElementContent(aiContent, 'product_summary') || '',
      technicalSpirit,
      coreEntities,
      criticalFlows,
      constraints,
    };

    // Parse confidence
    const confidenceStr = getXMLElementContent(xmlContent, 'confidence') || '70';
    const confidence = parseInt(confidenceStr, 10) || 70;

    // Build full identity
    const identity: ProductIdentity = {
      vision,
      problemStatement,
      valueProposition,
      aiCoderContext,
    };

    return {
      xml: xmlContent,
      identity,
      confidence,
    };
  }

  /**
   * Extract per-inference confidence from identity analysis.
   * Creates inferences for each core entity and critical flow identified.
   */
  protected extractInferences(data: IdentityAgentOutput, xmlContent: string): InferenceConfidence[] {
    const inferences: InferenceConfidence[] = [];
    const { identity, confidence } = data;
    const baseConfidence = confidence / 100; // Normalize 0-100 to 0-1

    // Parse LLM-provided evidence from XML
    const evidenceMap = this.parseEvidenceFromXML(xmlContent);

    // Helper to find matching evidence by keyword overlap
    const findEvidence = (keyword: string): { confidence: number; evidence: string[]; alternatives: string[] } | undefined => {
      const lower = keyword.toLowerCase();
      for (const [key, val] of evidenceMap) {
        if (key.includes(lower) || lower.includes(key)) return val;
      }
      return undefined;
    };

    // Inferences for each core entity
    for (const entity of identity.aiCoderContext.coreEntities) {
      const llmEvidence = findEvidence(entity);
      const conf = llmEvidence
        ? Math.min(1, llmEvidence.confidence)
        : Math.min(1, baseConfidence + 0.1);
      inferences.push({
        inference: `Core domain entity: ${entity}`,
        confidence: parseFloat(conf.toFixed(2)),
        level: conf >= 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low',
        evidence: llmEvidence?.evidence || [],
        alternatives: llmEvidence?.alternatives || [],
        humanReviewNeeded: !llmEvidence || llmEvidence.evidence.length === 0,
        source: 'IdentityAgent',
      });
    }

    // Inferences for each critical flow
    for (const flow of identity.aiCoderContext.criticalFlows) {
      const llmEvidence = findEvidence(flow);
      const conf = llmEvidence
        ? Math.min(1, llmEvidence.confidence)
        : Math.min(1, baseConfidence);
      inferences.push({
        inference: `Critical user flow: ${flow}`,
        confidence: parseFloat(conf.toFixed(2)),
        level: conf >= 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low',
        evidence: llmEvidence?.evidence || [],
        alternatives: llmEvidence?.alternatives || [],
        humanReviewNeeded: !llmEvidence || llmEvidence.evidence.length === 0,
        source: 'IdentityAgent',
      });
    }

    // Inference for product vision
    const visionEvidence = findEvidence('vision');
    const visionConf = visionEvidence
      ? visionEvidence.confidence
      : (identity.vision.statement.length > 50 ? baseConfidence : baseConfidence * 0.7);
    inferences.push({
      inference: `Product vision: ${identity.vision.statement.substring(0, 100)}`,
      confidence: parseFloat(Math.min(1, visionConf).toFixed(2)),
      level: visionConf >= 0.8 ? 'high' : visionConf >= 0.5 ? 'medium' : 'low',
      evidence: visionEvidence?.evidence || [],
      alternatives: visionEvidence?.alternatives || [],
      humanReviewNeeded: !visionEvidence || visionEvidence.evidence.length === 0,
      source: 'IdentityAgent',
    });

    // Inference for core problem
    const problemEvidence = findEvidence('problem');
    const problemConf = problemEvidence
      ? problemEvidence.confidence
      : (identity.problemStatement.coreProblem.length > 30 ? baseConfidence : baseConfidence * 0.6);
    inferences.push({
      inference: `Core problem: ${identity.problemStatement.coreProblem.substring(0, 100)}`,
      confidence: parseFloat(Math.min(1, problemConf).toFixed(2)),
      level: problemConf >= 0.8 ? 'high' : problemConf >= 0.5 ? 'medium' : 'low',
      evidence: problemEvidence?.evidence || [],
      alternatives: problemEvidence?.alternatives || [],
      humanReviewNeeded: !problemEvidence || problemEvidence.evidence.length === 0,
      source: 'IdentityAgent',
    });

    return inferences;
  }

  /**
   * Generate confidence score breakdown for the identity analysis
   */
  public generateConfidenceBreakdown(output: IdentityAgentOutput): AgentConfidenceScore {
    const { identity, confidence } = output;
    const breakdown: ConfidenceBreakdown[] = [];
    const lowConfidenceAreas: string[] = [];
    const suggestedQuestions: string[] = [];

    // Score vision section
    const visionScore = this.scoreVisionSection(identity.vision);
    breakdown.push({
      section: 'vision',
      score: visionScore,
      level: getConfidenceLevel(visionScore),
      reason: visionScore < 70 ? 'Vision statement needs more specificity' : undefined,
    });
    if (visionScore < CONFIDENCE_THRESHOLDS.REQUIRE_CLARIFICATION) {
      lowConfidenceAreas.push('Product Vision');
      suggestedQuestions.push('What is the primary goal or vision for this product in 2-3 years?');
    }

    // Score problem statement section
    const problemScore = this.scoreProblemSection(identity.problemStatement);
    breakdown.push({
      section: 'problemStatement',
      score: problemScore,
      level: getConfidenceLevel(problemScore),
      reason: problemScore < 70 ? 'Problem statement could be more specific' : undefined,
    });
    if (problemScore < CONFIDENCE_THRESHOLDS.REQUIRE_CLARIFICATION) {
      lowConfidenceAreas.push('Problem Statement');
      suggestedQuestions.push('What specific problem does this product solve for users?');
    }

    // Score value proposition section
    const valueScore = this.scoreValueSection(identity.valueProposition);
    breakdown.push({
      section: 'valueProposition',
      score: valueScore,
      level: getConfidenceLevel(valueScore),
      reason: valueScore < 70 ? 'Value proposition needs more clarity' : undefined,
    });
    if (valueScore < CONFIDENCE_THRESHOLDS.REQUIRE_CLARIFICATION) {
      lowConfidenceAreas.push('Value Proposition');
      suggestedQuestions.push('What makes this product different from alternatives?');
    }

    // Score AI coder context section
    const aiScore = this.scoreAICoderSection(identity.aiCoderContext);
    breakdown.push({
      section: 'aiCoderContext',
      score: aiScore,
      level: getConfidenceLevel(aiScore),
      reason: aiScore < 70 ? 'AI coder context needs more domain entities' : undefined,
    });
    if (aiScore < CONFIDENCE_THRESHOLDS.REQUIRE_CLARIFICATION) {
      lowConfidenceAreas.push('Domain Entities');
      suggestedQuestions.push('What are the main data objects/entities in this system?');
    }

    return {
      agentName: 'identity',
      overallScore: confidence,
      level: getConfidenceLevel(confidence),
      breakdown,
      lowConfidenceAreas,
      suggestedQuestions,
    };
  }

  /**
   * Score the vision section based on completeness
   */
  private scoreVisionSection(vision: ProductVision): number {
    let score = 100;

    // Deduct for empty/short fields
    if (!vision.statement || vision.statement.length < 20) score -= 30;
    else if (vision.statement.length < 50) score -= 15;

    if (!vision.futureState || vision.futureState.length < 20) score -= 25;
    if (!vision.transformation || vision.transformation.length < 20) score -= 25;

    // Bonus for having timeframe
    if (!vision.timeframe) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score the problem statement section
   */
  private scoreProblemSection(problem: IdentityProblemStatement): number {
    let score = 100;

    // Deduct for empty/short fields
    if (!problem.coreProblem || problem.coreProblem.length < 20) score -= 30;

    // Deduct if no affected segments
    if (problem.affectedSegments.length === 0) score -= 25;
    else if (problem.affectedSegments.length < 2) score -= 10;

    if (!problem.costOfInaction || problem.costOfInaction.length < 10) score -= 20;

    // Existing solutions is optional but helpful
    if (!problem.existingSolutions) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score the value proposition section
   */
  private scoreValueSection(value: ValueProposition): number {
    let score = 100;

    if (!value.uniqueValue || value.uniqueValue.length < 20) score -= 30;
    if (!value.targetAudience || value.targetAudience.length < 10) score -= 20;

    // Key benefits
    if (value.keyBenefits.length === 0) score -= 25;
    else if (value.keyBenefits.length < 2) score -= 10;

    // Competitive advantage is optional but helpful
    if (!value.competitiveAdvantage) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score the AI coder context section
   */
  private scoreAICoderSection(context: AICoderContext): number {
    let score = 100;

    if (!context.productSummary || context.productSummary.length < 50) score -= 25;

    // Core entities
    if (context.coreEntities.length === 0) score -= 25;
    else if (context.coreEntities.length < 3) score -= 10;

    // Critical flows
    if (context.criticalFlows.length === 0) score -= 25;
    else if (context.criticalFlows.length < 2) score -= 10;

    // Constraints are optional but helpful for complex projects
    if (context.constraints.length === 0) score -= 10;

    return Math.max(0, Math.min(100, score));
  }
}

// Export singleton instance
export const identityAgent = new IdentityAgent();
export default identityAgent;
