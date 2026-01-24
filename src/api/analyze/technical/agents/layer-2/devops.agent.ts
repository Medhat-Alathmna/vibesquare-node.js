/**
 * DevOps Agent
 *
 * Layer 2 Agent that provides deployment and infrastructure configuration.
 * Outputs XML with Docker, CI/CD, and hosting recommendations.
 */

import {
  BaseTechnicalAgent,
  getXMLElements,
  getXMLElementContent,
  getCDATAContent,
} from '../../core/base-technical-agent';
import {
  TechnicalAgentInput,
  DevOpsAgentOutput,
  DevOpsAgentOutputSchema,
} from '../../core/technical-agent.types';
import { TECHNICAL_AGENT_CONFIGS } from '../../core/technical-agent-config';

class DevOpsAgent extends BaseTechnicalAgent<DevOpsAgentOutput> {
  constructor() {
    super(TECHNICAL_AGENT_CONFIGS.devops, DevOpsAgentOutputSchema);
  }

  /**
   * Build user prompt from database schema and other context
   */
  protected buildUserPrompt(input: TechnicalAgentInput): string {
    const { previousOutputs, detailLevel } = input;
    const databaseSchema = previousOutputs?.databaseSchema || '';

    // Detect required services
    const needsPostgres = databaseSchema.toLowerCase().includes('postgres') ||
      databaseSchema.includes('<database>');
    const needsRedis = databaseSchema.toLowerCase().includes('session') ||
      databaseSchema.toLowerCase().includes('cache');

    // Check for file uploads
    const hasFileUploads = databaseSchema.toLowerCase().includes('file') ||
      databaseSchema.toLowerCase().includes('image') ||
      databaseSchema.toLowerCase().includes('upload');

    return `Provide DevOps configuration for deploying this Node.js application.

## Technology Stack
- Runtime: Node.js 20
- Database: PostgreSQL 16 ${needsPostgres ? '(Required)' : '(Assumed)'}
- Cache: Redis ${needsRedis ? '(Required for sessions/cache)' : '(Recommended)'}
- File Storage: ${hasFileUploads ? 'Required - S3 compatible' : 'Not required'}

## Database Schema Context
\`\`\`xml
${databaseSchema.substring(0, 1500)}${databaseSchema.length > 1500 ? '...' : ''}
\`\`\`

## Detail Level: ${detailLevel.toUpperCase()}

## Instructions

1. **Docker Configuration**:
   - Multi-stage Dockerfile for production
   - docker-compose.yml for local development
   - Define all required services
   - Include health checks

2. **CI/CD Pipeline** (GitHub Actions):
   - CI workflow: lint, test, build
   - Deploy workflow: deploy on main branch
   - Include caching for faster builds

3. **Hosting Recommendations**:
   - Recommend 2-3 hosting providers
   - Consider cost, ease of use, and scalability
   - Include estimated costs

${detailLevel === 'comprehensive' ? `4. **Monitoring & Logging**:
   - Logging configuration
   - Metrics to collect
   - Alert conditions

5. **Scaling Considerations**:
   - Horizontal scaling setup
   - Database connection pooling
   - Load balancing` : ''}

Output complete XML following the format in the system prompt.`;
  }

  /**
   * Parse XML output to structured data
   */
  protected parseXMLOutput(xmlContent: string): DevOpsAgentOutput {
    // Extract services
    const services: string[] = [];
    const serviceMatches = xmlContent.match(/<service\s+name="([^"]+)"/g) || [];
    for (const match of serviceMatches) {
      const nameMatch = match.match(/name="([^"]+)"/);
      if (nameMatch) {
        services.push(nameMatch[1]);
      }
    }

    // Extract hosting recommendations
    const hostingRecommendations: string[] = [];
    const recommendationMatches = xmlContent.match(/<recommendation\s+provider="([^"]+)"/g) || [];
    for (const match of recommendationMatches) {
      const providerMatch = match.match(/provider="([^"]+)"/);
      if (providerMatch) {
        hostingRecommendations.push(providerMatch[1]);
      }
    }

    return {
      xml: xmlContent,
      services,
      hostingRecommendations,
    };
  }
}

// Export singleton instance
export const devopsAgent = new DevOpsAgent();
export default devopsAgent;
