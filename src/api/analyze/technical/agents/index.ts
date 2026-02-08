/**
 * Technical Agents Index
 *
 * Exports all technical architecture agents.
 */

// Layer 1
export { databaseAgent } from './layer-1/database.agent';

// Layer 2
export { backendAgent } from './layer-2/backend.agent';
export { testingAgent } from './layer-2/testing.agent';
export { devopsAgent } from './layer-2/devops.agent';
export { userStoryAgent } from './layer-2/user-story.agent';

// Layer 3
export { prdValidatorAgent } from './layer-3/prd-validator.agent';
export { skepticAgent } from './layer-3/skeptic.agent';
export { qaAgent } from './layer-3/qa.agent';

// Agent names for type-safe dynamic access
export type TechnicalAgentName =
  | 'database'
  | 'backend'
  | 'testing'
  | 'devops'
  | 'userStory'
  | 'prdValidator'
  | 'skeptic'
  | 'qa';

// Agent map for dynamic access (use when lazy loading is needed)
export const technicalAgentLoaders: Record<TechnicalAgentName, () => Promise<any>> = {
  database: () => import('./layer-1/database.agent').then((m) => m.databaseAgent),
  backend: () => import('./layer-2/backend.agent').then((m) => m.backendAgent),
  testing: () => import('./layer-2/testing.agent').then((m) => m.testingAgent),
  devops: () => import('./layer-2/devops.agent').then((m) => m.devopsAgent),
  userStory: () => import('./layer-2/user-story.agent').then((m) => m.userStoryAgent),
  prdValidator: () => import('./layer-3/prd-validator.agent').then((m) => m.prdValidatorAgent),
  skeptic: () => import('./layer-3/skeptic.agent').then((m) => m.skepticAgent),
  qa: () => import('./layer-3/qa.agent').then((m) => m.qaAgent),
};
