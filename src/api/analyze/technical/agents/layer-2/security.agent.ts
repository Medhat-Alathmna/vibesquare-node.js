/**
 * Security Agent
 *
 * Layer 2 Agent that provides security recommendations.
 * Outputs XML with OWASP coverage, auth security, data protection, and API security.
 */

import {
  BaseTechnicalAgent,
  getXMLElements,
  getXMLElementContent,
  getXMLAttribute,
} from '../../core/base-technical-agent';
import {
  TechnicalAgentInput,
  SecurityAgentOutput,
  SecurityAgentOutputSchema,
} from '../../core/technical-agent.types';
import { TECHNICAL_AGENT_CONFIGS } from '../../core/technical-agent-config';

class SecurityAgent extends BaseTechnicalAgent<SecurityAgentOutput> {
  constructor() {
    super(TECHNICAL_AGENT_CONFIGS.security, SecurityAgentOutputSchema);
  }

  /**
   * Build user prompt from database and backend schemas
   */
  protected buildUserPrompt(input: TechnicalAgentInput): string {
    const { visualResults, previousOutputs } = input;
    const databaseSchema = previousOutputs?.databaseSchema || '';
    const backendArchitecture = previousOutputs?.backendArchitecture || '';

    // Identify sensitive data from database schema
    const sensitiveFields = this.extractSensitiveFields(databaseSchema);

    // Extract auth endpoints from backend
    const authEndpoints = this.extractAuthEndpoints(backendArchitecture);

    // Check for payment/financial indicators
    const hasPayment = databaseSchema.toLowerCase().includes('payment') ||
      databaseSchema.toLowerCase().includes('price') ||
      databaseSchema.toLowerCase().includes('order') ||
      backendArchitecture.toLowerCase().includes('checkout');

    return `Provide comprehensive security recommendations for this application.

## Database Schema

\`\`\`xml
${databaseSchema.substring(0, 3000)}${databaseSchema.length > 3000 ? '...' : ''}
\`\`\`

## Backend Architecture

\`\`\`xml
${backendArchitecture.substring(0, 3000)}${backendArchitecture.length > 3000 ? '...' : ''}
\`\`\`

## Security Analysis Context

### Sensitive Fields Detected
${sensitiveFields.length > 0 ? sensitiveFields.map((f) => `- ${f}`).join('\n') : 'None explicitly detected - analyze schema for PII'}

### Auth Endpoints
${authEndpoints.length > 0 ? authEndpoints.join('\n') : 'No auth endpoints detected'}

### Payment/Financial Features
${hasPayment ? 'Yes - Payment/order functionality detected. Apply PCI-DSS considerations.' : 'No - Standard security measures apply.'}

### Visual Prompt Context
${visualResults.finalPrompt.substring(0, 500)}...

## Instructions

1. **OWASP Top 10 Coverage**:
   - Analyze each risk category
   - Provide specific recommendations for this application
   - Include implementation examples

2. **Authentication Security**:
   - Password policy recommendations
   - MFA suggestions
   - Session management
   - Brute force protection

3. **Data Protection**:
   - Encryption requirements (at rest and in transit)
   - PII handling for identified sensitive fields
   - Data retention policies

4. **API Security**:
   - Rate limiting rules per endpoint type
   - CORS configuration
   - Input validation rules
   - Security headers

5. **Logging & Monitoring**:
   - Audit events to log
   - PII redaction in logs

Calculate a security score (0-100) based on coverage.

Output complete XML following the format in the system prompt.`;
  }

  /**
   * Extract sensitive fields from database schema
   */
  private extractSensitiveFields(schema: string): string[] {
    const sensitivePatterns = [
      'password', 'email', 'phone', 'address', 'ssn', 'social_security',
      'credit_card', 'card_number', 'cvv', 'secret', 'token', 'api_key',
      'birth', 'dob', 'salary', 'income', 'bank', 'account_number',
    ];

    const fields: string[] = [];
    const fieldMatches = schema.match(/<field\s+name="([^"]+)"/g) || [];

    for (const match of fieldMatches) {
      const nameMatch = match.match(/name="([^"]+)"/);
      if (nameMatch) {
        const fieldName = nameMatch[1].toLowerCase();
        if (sensitivePatterns.some((p) => fieldName.includes(p))) {
          fields.push(nameMatch[1]);
        }
      }
    }

    return fields;
  }

  /**
   * Extract auth endpoints from backend schema
   */
  private extractAuthEndpoints(backend: string): string[] {
    const endpoints: string[] = [];
    const authPaths = ['/auth', '/login', '/register', '/logout', '/password', '/token'];

    const endpointMatches = backend.match(/<endpoint[^>]+path="([^"]+)"/g) || [];
    for (const match of endpointMatches) {
      const pathMatch = match.match(/path="([^"]+)"/);
      if (pathMatch && authPaths.some((p) => pathMatch[1].includes(p))) {
        endpoints.push(pathMatch[1]);
      }
    }

    return endpoints;
  }

  /**
   * Parse XML output to structured data
   */
  protected parseXMLOutput(xmlContent: string): SecurityAgentOutput {
    // Extract OWASP coverage
    const owaspCoverage: string[] = [];
    const riskMatches = xmlContent.match(/<risk\s+name="([^"]+)"/g) || [];
    for (const match of riskMatches) {
      const nameMatch = match.match(/name="([^"]+)"/);
      if (nameMatch) {
        owaspCoverage.push(nameMatch[1]);
      }
    }

    // Extract security score
    const scoreMatch = xmlContent.match(/<securityScore>(\d+)<\/securityScore>/);
    const securityScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 75;

    return {
      xml: xmlContent,
      owaspCoverage,
      securityScore: Math.min(100, Math.max(0, securityScore)),
    };
  }
}

// Export singleton instance
export const securityAgent = new SecurityAgent();
export default securityAgent;
