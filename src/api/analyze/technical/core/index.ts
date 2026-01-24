/**
 * Technical Agents Core Module
 *
 * Exports all core components for the Technical Architecture Pipeline.
 */

// Types
export * from './technical-agent.types';

// Base Agent
export { BaseTechnicalAgent, TechnicalAgentExecutionError } from './base-technical-agent';
export {
  getXMLAttribute,
  getXMLElements,
  getXMLElementContent,
  getSelfClosingElementAttributes,
  getCDATAContent,
} from './base-technical-agent';

// Configurations
export { TECHNICAL_AGENT_CONFIGS, default as technicalAgentConfigs } from './technical-agent-config';
