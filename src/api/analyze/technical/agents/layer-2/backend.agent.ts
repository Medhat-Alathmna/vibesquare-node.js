/**
 * Backend Agent
 *
 * Layer 2 Agent that designs API architecture based on Database schema.
 * Outputs XML with REST endpoints, GraphQL schema, and authentication.
 */

import {
  BaseTechnicalAgent,
  getXMLElements,
  getXMLElementContent,
  getSelfClosingElementAttributes,
} from '../../core/base-technical-agent';
import {
  TechnicalAgentInput,
  BackendAgentOutput,
  BackendAgentOutputSchema,
  InferenceConfidence,
} from '../../core/technical-agent.types';
import { TECHNICAL_AGENT_CONFIGS } from '../../core/technical-agent-config';

class BackendAgent extends BaseTechnicalAgent<BackendAgentOutput> {
  constructor() {
    super(TECHNICAL_AGENT_CONFIGS.backend, BackendAgentOutputSchema);
  }

  /**
   * Build user prompt from database schema and visual results
   */
  protected buildUserPrompt(input: TechnicalAgentInput): string {
    const { visualResults, previousOutputs, clarificationsText } = input;
    const databaseSchema = previousOutputs?.databaseSchema || '';

    // Extract entities from database schema for API mapping
    const entityMatches = databaseSchema.match(/<entity\s+name="([^"]+)"/g) || [];
    const entities = entityMatches.map((m) => m.match(/name="([^"]+)"/)?.[1] || '').filter(Boolean);

    // Check for auth-related entities
    const hasAuth = entities.some((e) =>
      ['user', 'users', 'auth', 'account', 'accounts', 'role', 'roles'].includes(e.toLowerCase())
    );

    // Extract UI actions from visual prompt
    const visualPrompt = visualResults.finalPrompt;
    const components = visualResults.componentIdentification?.components || [];

    // Identify interactive components
    const formCount = components.filter((c) => c.type.toLowerCase().includes('form')).length;
    const buttonCount = components.filter((c) => c.type.toLowerCase().includes('button')).length;
    const searchDetected = components.some((c) => c.type.toLowerCase().includes('search'));

    // Build clarifications section if available
    const clarificationsSection = clarificationsText
      ? `\n${clarificationsText}\n`
      : '';

    return `Design a complete Node.js + Express backend API based on the database schema.
${clarificationsSection}
## Database Schema (from Database Agent)

\`\`\`xml
${databaseSchema}
\`\`\`

## Entities to Create APIs For
${entities.map((e) => `- ${e}`).join('\n') || 'No entities detected - create based on visual analysis'}

## Visual Analysis Context

### Components Detected
- Forms: ${formCount}
- Buttons/Actions: ${buttonCount}
- Search: ${searchDetected ? 'Yes' : 'No'}

### Auth Required
${hasAuth ? 'Yes - User/Auth entities detected. Include full auth flow.' : 'No - No auth entities detected. Do NOT include auth endpoints unless the visual analysis strongly suggests authentication is needed.'}

### Visual Prompt Summary
${visualPrompt.substring(0, 1500)}${visualPrompt.length > 1500 ? '...' : ''}

## Instructions

1. **Create REST endpoints** for each database entity:
   - CRUD operations (GET list, GET single, POST, PUT, DELETE)
   - Include pagination for list endpoints
   - Add search endpoint if search UI detected
   - Define request/response schemas

2. **Design authentication**:
   - JWT-based auth with access/refresh tokens
   - Define roles and permissions
   - Protect appropriate endpoints

3. **Add GraphQL schema**:
   - Queries for read operations
   - Mutations for write operations
   - Include subscriptions if real-time UI detected

4. **Define middleware stack**:
   - Auth middleware
   - Validation middleware
   - Rate limiting
   - Error handling

5. **Map UI actions to endpoints**:
   - Each form should have a corresponding POST/PUT endpoint
   - Each list should have a GET endpoint
   - Each action button should have an endpoint

Output complete XML following the format in the system prompt.`;
  }

  /**
   * Parse XML output to structured data
   */
  protected parseXMLOutput(xmlContent: string): BackendAgentOutput {
    const endpoints: Array<{ method: string; path: string; auth: boolean }> = [];

    // Extract endpoints
    const endpointAttrs = getSelfClosingElementAttributes(xmlContent, 'endpoint');
    for (const ep of endpointAttrs) {
      if (ep.method && ep.path) {
        endpoints.push({
          method: ep.method,
          path: ep.path,
          auth: ep.auth === 'true',
        });
      }
    }

    // Also check for non-self-closing endpoint elements
    const endpointMatches = xmlContent.match(/<endpoint\s+method="([^"]+)"\s+path="([^"]+)"[^>]*auth="([^"]+)"/g) || [];
    for (const match of endpointMatches) {
      const methodMatch = match.match(/method="([^"]+)"/);
      const pathMatch = match.match(/path="([^"]+)"/);
      const authMatch = match.match(/auth="([^"]+)"/);

      if (methodMatch && pathMatch) {
        const endpoint = {
          method: methodMatch[1],
          path: pathMatch[1],
          auth: authMatch?.[1] === 'true',
        };

        // Avoid duplicates
        if (!endpoints.some((e) => e.method === endpoint.method && e.path === endpoint.path)) {
          endpoints.push(endpoint);
        }
      }
    }

    // Extract tech stack
    const framework = getXMLElementContent(xmlContent, 'framework') || 'Express';
    const runtime = getXMLElementContent(xmlContent, 'runtime') || 'Node.js';
    const apiStyle = getXMLElementContent(xmlContent, 'apiStyle') || 'REST + GraphQL';

    return {
      xml: xmlContent,
      endpoints,
      techStack: {
        framework,
        runtime,
        apiStyle,
      },
    };
  }

  /**
   * Extract per-inference confidence from backend architecture.
   * Creates inferences for each endpoint and tech stack choice.
   */
  protected extractInferences(data: BackendAgentOutput, xmlContent: string): InferenceConfidence[] {
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

    // Standard CRUD endpoints are high confidence, custom ones are lower
    const crudMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    for (const ep of data.endpoints) {
      const isCrud = crudMethods.includes(ep.method.toUpperCase());
      const isStandardPath = /^\/api\/v\d+\/\w+/.test(ep.path);
      const llmEvidence = findEvidence(ep.path);
      const defaultConf = isCrud && isStandardPath ? 0.8 : 0.55;
      const conf = llmEvidence ? llmEvidence.confidence : defaultConf;

      inferences.push({
        inference: `API endpoint: ${ep.method} ${ep.path}${ep.auth ? ' (auth required)' : ''}`,
        confidence: parseFloat(conf.toFixed(2)),
        level: conf >= 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low',
        evidence: llmEvidence?.evidence || [],
        alternatives: llmEvidence?.alternatives || [],
        humanReviewNeeded: !llmEvidence && conf < 0.6,
        source: 'BackendAgent',
      });
    }

    // Tech stack inference
    const techEvidence = findEvidence('tech stack') || findEvidence('framework');
    inferences.push({
      inference: `Tech stack: ${data.techStack.framework} on ${data.techStack.runtime} (${data.techStack.apiStyle})`,
      confidence: techEvidence ? parseFloat(techEvidence.confidence.toFixed(2)) : 0.7,
      level: 'medium',
      evidence: techEvidence?.evidence || [],
      alternatives: techEvidence?.alternatives || ['Express + Node.js', 'Fastify + Node.js', 'NestJS + Node.js'],
      humanReviewNeeded: true,
      source: 'BackendAgent',
    });

    return inferences;
  }
}

// Export singleton instance
export const backendAgent = new BackendAgent();
export default backendAgent;
