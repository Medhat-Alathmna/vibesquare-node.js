/**
 * Database Agent
 *
 * Layer 1 Agent that infers database schema from Visual Pipeline results.
 * Outputs XML schema with entities, relations, enums, and indexes.
 */

import {
  BaseTechnicalAgent,
  getXMLElements,
  getXMLElementContent,
  getSelfClosingElementAttributes,
  getXMLAttribute,
} from '../../core/base-technical-agent';
import {
  TechnicalAgentInput,
  DatabaseAgentOutput,
  DatabaseAgentOutputSchema,
  InferenceConfidence,
} from '../../core/technical-agent.types';
import { TECHNICAL_AGENT_CONFIGS } from '../../core/technical-agent-config';

class DatabaseAgent extends BaseTechnicalAgent<DatabaseAgentOutput> {
  constructor() {
    super(TECHNICAL_AGENT_CONFIGS.database, DatabaseAgentOutputSchema);
  }

  /**
   * Build user prompt from visual pipeline results
   */
  protected buildUserPrompt(input: TechnicalAgentInput): string {
    const { visualResults, clarificationsText } = input;

    // Extract relevant information from visual analysis
    const components = visualResults.componentIdentification?.components || [];
    const layoutSections = visualResults.layoutAnalysis?.sections || [];
    const designInfo = visualResults.designSystem || {};

    // Build component summary
    const componentSummary = components
      .map((c) => `- ${c.type}: ${c.count} instance(s)${c.details ? ` - ${c.details}` : ''}`)
      .join('\n');

    // Build section summary
    const sectionSummary = layoutSections
      .map((s) => `- ${s.type} (${s.position})${s.content ? `: ${s.content}` : ''}`)
      .join('\n');

    // Analyze for data entities
    const formComponents = components.filter((c) =>
      ['form', 'input', 'textarea', 'select', 'checkbox', 'radio'].includes(c.type.toLowerCase())
    );

    const listComponents = components.filter((c) =>
      ['table', 'list', 'grid', 'card-grid', 'cards'].includes(c.type.toLowerCase())
    );

    const authComponents = components.filter((c) =>
      ['login', 'register', 'auth', 'signup', 'signin', 'profile', 'avatar'].includes(c.type.toLowerCase())
    );

    // Build clarifications section if available
    const clarificationsSection = clarificationsText
      ? `\n${clarificationsText}\n`
      : '';

    return `Analyze this website's visual components and infer a comprehensive PostgreSQL database schema.
${clarificationsSection}
## Visual Analysis Results

### Page Layout
${sectionSummary || 'No specific sections identified'}

### UI Components Found
${componentSummary || 'No specific components identified'}

### Form Components (suggest entities)
${formComponents.length > 0 ? formComponents.map((c) => `- ${c.type} (${c.count})`).join('\n') : 'None detected'}

### List/Table Components (suggest collections)
${listComponents.length > 0 ? listComponents.map((c) => `- ${c.type} (${c.count})`).join('\n') : 'None detected'}

### Auth-Related Components
${authComponents.length > 0 ? authComponents.map((c) => `- ${c.type}`).join('\n') : 'None detected - do NOT include auth tables unless other strong signals suggest authentication is needed'}

### Visual Identity
- Primary Color: ${(designInfo as any)?.colors?.primary || 'Not detected'}
- Visual Tone: ${(designInfo as any)?.visualTone || 'Not detected'}

### Full Visual Prompt (for context)
${visualResults.finalPrompt.substring(0, 2000)}${visualResults.finalPrompt.length > 2000 ? '...' : ''}

## Instructions

Based on the above analysis:

1. **Identify all entities** that would be needed:
   - Core entities from forms and lists
   - Auth entities (User, Role, Session) if any auth UI detected
   - Supporting entities (categories, tags, etc.)

2. **Define fields for each entity** with:
   - Appropriate PostgreSQL types
   - Required/optional markers
   - Default values where appropriate
   - Always include: id (uuid), createdAt, updatedAt

3. **Define relationships**:
   - One-to-many (foreign keys)
   - Many-to-many (junction tables)
   - Self-referential if applicable

4. **Extract enums** from:
   - Status fields
   - Type selectors
   - Categories with fixed options

5. **Add indexes** for:
   - Foreign keys
   - Frequently queried fields
   - Unique constraints

Output the complete XML schema following the format specified in the system prompt.`;
  }

  /**
   * Parse XML output to structured data
   */
  protected parseXMLOutput(xmlContent: string): DatabaseAgentOutput {
    const entities: string[] = [];
    const relations: string[] = [];
    const enums: string[] = [];

    // Extract entity names
    const entityElements = xmlContent.match(/<entity\s+name="([^"]+)"/g) || [];
    for (const match of entityElements) {
      const nameMatch = match.match(/name="([^"]+)"/);
      if (nameMatch) {
        entities.push(nameMatch[1]);
      }
    }

    // Extract relations
    const relationMatches = getSelfClosingElementAttributes(xmlContent, 'relation');
    for (const rel of relationMatches) {
      if (rel.from && rel.to && rel.type) {
        relations.push(`${rel.from} → ${rel.to} (${rel.type})`);
      }
    }

    // Extract enum names
    const enumElements = xmlContent.match(/<enum\s+name="([^"]+)"/g) || [];
    for (const match of enumElements) {
      const nameMatch = match.match(/name="([^"]+)"/);
      if (nameMatch) {
        enums.push(nameMatch[1]);
      }
    }

    return {
      xml: xmlContent,
      entities,
      relations,
      enums,
    };
  }

  /**
   * Extract per-inference confidence from database schema.
   * Creates inferences for each entity, relation, and enum.
   */
  protected extractInferences(data: DatabaseAgentOutput, xmlContent: string): InferenceConfidence[] {
    const inferences: InferenceConfidence[] = [];

    // Parse LLM-provided evidence from XML
    const evidenceMap = this.parseEvidenceFromXML(xmlContent);

    const findEvidence = (keyword: string) => {
      const lower = keyword.toLowerCase();
      for (const [key, val] of evidenceMap) {
        if (key.includes(lower) || lower.includes(key)) return val;
      }
      return undefined;
    };

    // Standard entities that are high-confidence (common in most apps)
    const commonEntities = ['user', 'users', 'role', 'roles', 'session', 'sessions', 'account', 'accounts'];

    // Per-entity inferences
    for (const entity of data.entities) {
      const isCommon = commonEntities.includes(entity.toLowerCase());
      const llmEvidence = findEvidence(entity);
      const conf = llmEvidence
        ? llmEvidence.confidence
        : (isCommon ? 0.9 : 0.65);
      inferences.push({
        inference: `Database entity: ${entity}`,
        confidence: parseFloat(conf.toFixed(2)),
        level: conf >= 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low',
        evidence: llmEvidence?.evidence || [],
        alternatives: llmEvidence?.alternatives || [],
        humanReviewNeeded: !isCommon && (!llmEvidence || llmEvidence.evidence.length === 0),
        source: 'DatabaseAgent',
      });
    }

    // Per-relation inferences (relations are more speculative)
    for (const relation of data.relations) {
      const llmEvidence = findEvidence(relation.split('→')[0]?.trim() || relation);
      const conf = llmEvidence ? llmEvidence.confidence : 0.6;
      inferences.push({
        inference: `Database relation: ${relation}`,
        confidence: parseFloat(conf.toFixed(2)),
        level: conf >= 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low',
        evidence: llmEvidence?.evidence || [],
        alternatives: llmEvidence?.alternatives || [],
        humanReviewNeeded: !llmEvidence || llmEvidence.evidence.length === 0,
        source: 'DatabaseAgent',
      });
    }

    // Per-enum inferences
    for (const enumName of data.enums) {
      const llmEvidence = findEvidence(enumName);
      const conf = llmEvidence ? llmEvidence.confidence : 0.7;
      inferences.push({
        inference: `Enum type: ${enumName}`,
        confidence: parseFloat(conf.toFixed(2)),
        level: conf >= 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low',
        evidence: llmEvidence?.evidence || [],
        alternatives: llmEvidence?.alternatives || [],
        humanReviewNeeded: false,
        source: 'DatabaseAgent',
      });
    }

    return inferences;
  }
}

// Export singleton instance
export const databaseAgent = new DatabaseAgent();
export default databaseAgent;
