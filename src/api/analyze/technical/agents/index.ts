/**
 * Technical Agents Index
 *
 * Exports all technical architecture agents.
 */

// Layer 1
export { databaseAgent } from './layer-1/database.agent';

// Layer 2
export { backendAgent } from './layer-2/backend.agent';
export { securityAgent } from './layer-2/security.agent';
export { testingAgent } from './layer-2/testing.agent';
export { devopsAgent } from './layer-2/devops.agent';

// Layer 3
export { prdValidatorAgent } from './layer-3/prd-validator.agent';
export { qaAgent } from './layer-3/qa.agent';

// Agent names for type-safe dynamic access
export type TechnicalAgentName =
  | 'database'
  | 'backend'
  | 'security'
  | 'testing'
  | 'devops'
  | 'prdValidator'
  | 'qa';

// Agent map for dynamic access (use when lazy loading is needed)
export const technicalAgentLoaders: Record<TechnicalAgentName, () => Promise<any>> = {
  database: () => import('./layer-1/database.agent').then((m) => m.databaseAgent),
  backend: () => import('./layer-2/backend.agent').then((m) => m.backendAgent),
  security: () => import('./layer-2/security.agent').then((m) => m.securityAgent),
  testing: () => import('./layer-2/testing.agent').then((m) => m.testingAgent),
  devops: () => import('./layer-2/devops.agent').then((m) => m.devopsAgent),
  prdValidator: () => import('./layer-3/prd-validator.agent').then((m) => m.prdValidatorAgent),
  qa: () => import('./layer-3/qa.agent').then((m) => m.qaAgent),
};
