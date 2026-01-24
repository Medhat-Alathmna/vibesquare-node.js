/**
 * Testing Agent
 *
 * Layer 2 Agent that defines testing strategy.
 * Outputs XML with unit tests, API tests, and coverage targets.
 */

import {
  BaseTechnicalAgent,
  getXMLElements,
  getXMLElementContent,
  getXMLAttribute,
} from '../../core/base-technical-agent';
import {
  TechnicalAgentInput,
  TestingAgentOutput,
  TestingAgentOutputSchema,
} from '../../core/technical-agent.types';
import { TECHNICAL_AGENT_CONFIGS } from '../../core/technical-agent-config';

class TestingAgent extends BaseTechnicalAgent<TestingAgentOutput> {
  constructor() {
    super(TECHNICAL_AGENT_CONFIGS.testing, TestingAgentOutputSchema);
  }

  /**
   * Build user prompt from database and backend schemas
   */
  protected buildUserPrompt(input: TechnicalAgentInput): string {
    const { previousOutputs, detailLevel } = input;
    const databaseSchema = previousOutputs?.databaseSchema || '';
    const backendArchitecture = previousOutputs?.backendArchitecture || '';

    // Extract entities for service tests
    const entityMatches = databaseSchema.match(/<entity\s+name="([^"]+)"/g) || [];
    const entities = entityMatches.map((m) => m.match(/name="([^"]+)"/)?.[1] || '').filter(Boolean);

    // Extract endpoints for API tests
    const endpointMatches = backendArchitecture.match(/<endpoint[^>]+method="([^"]+)"[^>]+path="([^"]+)"/g) || [];
    const endpoints = endpointMatches.map((m) => {
      const method = m.match(/method="([^"]+)"/)?.[1] || '';
      const path = m.match(/path="([^"]+)"/)?.[1] || '';
      return `${method} ${path}`;
    }).filter(Boolean);

    // Check for critical paths
    const hasCriticalPaths = backendArchitecture.toLowerCase().includes('auth') ||
      backendArchitecture.toLowerCase().includes('payment') ||
      backendArchitecture.toLowerCase().includes('checkout');

    const testDepth = detailLevel === 'comprehensive' ? 'comprehensive'
      : detailLevel === 'detailed' ? 'standard' : 'basic';

    return `Define a ${testDepth} testing strategy for this application.

## Database Entities (for Service Tests)
${entities.map((e) => `- ${e}Service`).join('\n') || 'No entities detected'}

## API Endpoints (for API Tests)
${endpoints.slice(0, 30).join('\n') || 'No endpoints detected'}
${endpoints.length > 30 ? `... and ${endpoints.length - 30} more` : ''}

## Critical Paths Detected
${hasCriticalPaths ? 'Yes - Auth/Payment detected. Require 100% coverage.' : 'No - Standard coverage targets apply.'}

## Detail Level: ${detailLevel.toUpperCase()}

## Instructions

1. **Unit Tests** (for each service):
   - Test CRUD operations
   - Test validation logic
   - Test error handling
   - Test edge cases${detailLevel === 'comprehensive' ? ' (exhaustive)' : ''}

2. **API Tests** (for each endpoint):
   - Test success scenarios (200, 201)
   - Test auth requirements (401, 403)
   - Test validation (400)
   - Test not found (404)${detailLevel !== 'basic' ? '\n   - Test rate limiting (429)' : ''}

3. **Coverage Targets**:
   - Overall: ${detailLevel === 'comprehensive' ? '90' : detailLevel === 'detailed' ? '80' : '70'}%
   - Critical paths: 100%

4. **Test Data Strategy**:
   - Define fixtures for common test data
   - Define factories for dynamic test data

${detailLevel === 'comprehensive' ? `5. **Advanced Testing**:
   - Integration test scenarios
   - Load testing recommendations
   - Security testing (penetration tests)` : ''}

Output complete XML following the format in the system prompt.`;
  }

  /**
   * Parse XML output to structured data
   */
  protected parseXMLOutput(xmlContent: string): TestingAgentOutput {
    // Extract test suites
    const testSuites: string[] = [];
    const suiteMatches = xmlContent.match(/<suite\s+name="([^"]+)"/g) || [];
    for (const match of suiteMatches) {
      const nameMatch = match.match(/name="([^"]+)"/);
      if (nameMatch) {
        testSuites.push(nameMatch[1]);
      }
    }

    // Also check for resource-based suites
    const resourceMatches = xmlContent.match(/<suite\s+resource="([^"]+)"/g) || [];
    for (const match of resourceMatches) {
      const nameMatch = match.match(/resource="([^"]+)"/);
      if (nameMatch) {
        testSuites.push(`${nameMatch[1]} API Tests`);
      }
    }

    // Extract coverage target
    const targetMatch = xmlContent.match(/<target\s+percentage="(\d+)"/);
    const coverageTarget = targetMatch ? parseInt(targetMatch[1], 10) : 80;

    return {
      xml: xmlContent,
      testSuites,
      coverageTarget: Math.min(100, Math.max(0, coverageTarget)),
    };
  }
}

// Export singleton instance
export const testingAgent = new TestingAgent();
export default testingAgent;
