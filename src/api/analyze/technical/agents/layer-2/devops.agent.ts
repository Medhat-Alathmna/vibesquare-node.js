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
  DevOpsAnalytics,
  DevOpsObservability,
  AnalyticsKPI,
  AnalyticsEvent,
  AnalyticsDashboard,
  ObservabilityAlert,
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

4. **Analytics & KPIs** (CRITICAL for AI Vibe Coders):
   - Define 3-5 business KPIs with targets
   - Define 5-10 tracking events for key user actions
   - Create 2-3 dashboard layouts for different stakeholders

5. **Observability**:
   - Logging format and retention
   - SLIs (Service Level Indicators) with targets
   - Alerting rules with actions
   - Distributed tracing setup

${detailLevel === 'comprehensive' ? `6. **Scaling Considerations**:
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

    // Parse analytics section
    const analytics = this.parseAnalytics(xmlContent);

    // Parse observability section
    const observability = this.parseObservability(xmlContent);

    return {
      xml: xmlContent,
      services,
      hostingRecommendations,
      analytics,
      observability,
    };
  }

  /**
   * Parse analytics section from XML
   */
  private parseAnalytics(xmlContent: string): DevOpsAnalytics | undefined {
    const analyticsMatch = xmlContent.match(/<analytics>([\s\S]*?)<\/analytics>/);
    if (!analyticsMatch) return undefined;

    const analyticsXml = analyticsMatch[1];

    // Parse KPIs
    const kpis: AnalyticsKPI[] = [];
    const kpiRegex = /<kpi\s+name="([^"]+)"\s+target="([^"]+)"\s+measurementMethod="([^"]+)"\s+frequency="([^"]+)"/g;
    let kpiMatch;
    while ((kpiMatch = kpiRegex.exec(analyticsXml)) !== null) {
      kpis.push({
        name: kpiMatch[1],
        target: kpiMatch[2],
        measurementMethod: kpiMatch[3],
        frequency: kpiMatch[4] as 'realtime' | 'daily' | 'weekly' | 'monthly',
      });
    }

    // Parse events
    const events: AnalyticsEvent[] = [];
    const eventRegex = /<event\s+name="([^"]+)"\s+trigger="([^"]+)"\s+category="([^"]+)">([\s\S]*?)<\/event>/g;
    let eventMatch;
    while ((eventMatch = eventRegex.exec(analyticsXml)) !== null) {
      const properties: Array<{ name: string; type: string }> = [];
      const propRegex = /<property\s+name="([^"]+)"\s+type="([^"]+)"/g;
      let propMatch;
      while ((propMatch = propRegex.exec(eventMatch[4])) !== null) {
        properties.push({ name: propMatch[1], type: propMatch[2] });
      }
      events.push({
        name: eventMatch[1],
        trigger: eventMatch[2],
        category: eventMatch[3] as 'user_action' | 'system' | 'business' | 'error',
        properties,
      });
    }

    // Parse dashboards
    const dashboards: AnalyticsDashboard[] = [];
    const dashboardRegex = /<dashboard\s+name="([^"]+)">([\s\S]*?)<\/dashboard>/g;
    let dashMatch;
    while ((dashMatch = dashboardRegex.exec(analyticsXml)) !== null) {
      const widgets: Array<{ type: string; metric: string }> = [];
      const widgetRegex = /<widget\s+type="([^"]+)"\s+metric="([^"]+)"/g;
      let widgetMatch;
      while ((widgetMatch = widgetRegex.exec(dashMatch[2])) !== null) {
        widgets.push({ type: widgetMatch[1], metric: widgetMatch[2] });
      }
      dashboards.push({
        name: dashMatch[1],
        widgets,
      });
    }

    return { kpis, events, dashboards };
  }

  /**
   * Parse observability section from XML
   */
  private parseObservability(xmlContent: string): DevOpsObservability | undefined {
    const obsMatch = xmlContent.match(/<observability>([\s\S]*?)<\/observability>/);
    if (!obsMatch) return undefined;

    const obsXml = obsMatch[1];

    // Parse logging
    const formatMatch = obsXml.match(/<format>([^<]+)<\/format>/);
    const levelsMatch = obsXml.match(/<levels>([^<]+)<\/levels>/);
    const retentionMatch = obsXml.match(/<retention>([^<]+)<\/retention>/);

    const logging = {
      format: formatMatch ? formatMatch[1] : 'JSON',
      levels: levelsMatch ? levelsMatch[1].split(',') : ['info', 'warn', 'error'],
      retention: retentionMatch ? retentionMatch[1] : '30 days',
    };

    // Parse metrics/SLIs
    const providerMatch = obsXml.match(/<metrics>[\s\S]*?<provider>([^<]+)<\/provider>/);
    const slis: Array<{ name: string; target: string }> = [];
    const sliRegex = /<sli\s+name="([^"]+)"\s+target="([^"]+)"/g;
    let sliMatch;
    while ((sliMatch = sliRegex.exec(obsXml)) !== null) {
      slis.push({ name: sliMatch[1], target: sliMatch[2] });
    }

    const metrics = {
      provider: providerMatch ? providerMatch[1] : 'Prometheus',
      slis,
    };

    // Parse alerts
    const alerting: ObservabilityAlert[] = [];
    const alertRegex = /<alert\s+name="([^"]+)"\s+severity="([^"]+)"\s+condition="([^"]+)">([\s\S]*?)<\/alert>/g;
    let alertMatch;
    while ((alertMatch = alertRegex.exec(obsXml)) !== null) {
      const actionMatch = alertMatch[4].match(/<action>([^<]+)<\/action>/);
      alerting.push({
        name: alertMatch[1],
        severity: alertMatch[2] as 'critical' | 'warning' | 'info',
        condition: alertMatch[3],
        action: actionMatch ? actionMatch[1] : '',
      });
    }

    return { logging, metrics, alerting };
  }
}

// Export singleton instance
export const devopsAgent = new DevOpsAgent();
export default devopsAgent;
