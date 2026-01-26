/**
 * Technical Agent Types
 *
 * Type definitions for the Technical Architecture Pipeline agents.
 * All agents output XML format for organization and consistency.
 */

import { z } from 'zod';
import { AgentOutput, Ambiguity } from '../../agents/core/agent.types';

// ============ Pipeline Options ============

export type PipelineType = 'visual' | 'technical' | 'both';
export type DetailLevel = 'basic' | 'detailed' | 'comprehensive';
export type APIStyle = 'REST' | 'GraphQL' | 'REST_GraphQL';
export type ImplementationPriority = 'must_have' | 'nice_to_have' | 'later';

export interface TechnicalPipelineOptions {
  pipelineType: PipelineType;
  detailLevel: DetailLevel;
  enableWebSearch?: boolean;
}

// ============ Visual Pipeline Input ============

export interface VisualPipelineResult {
  finalPrompt: string;
  userQuestions?: string[];
  metadata: {
    sourceUrl: string;
    nodesFound: number;
    layoutType: string;
    difficulty: string;
    language: string;
    processingTimeMs: number;
    agentsUsed: string[];
    fallbackTriggered: boolean;
  };
  // Agent outputs
  layoutAnalysis?: {
    sections: Array<{
      type: string;
      position: string;
      content?: string;
    }>;
    layoutPattern: string;
  };
  componentIdentification?: {
    components: Array<{
      type: string;
      count: number;
      details?: string;
    }>;
  };
  designSystem?: {
    colors: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      text?: string;
    };
    fonts: {
      heading?: string;
      body?: string;
    };
    visualTone?: string;
  };
}

// ============ Technical Agent Input ============

export interface TechnicalAgentInput {
  visualResults: VisualPipelineResult;
  detailLevel: DetailLevel;
  apiStyle?: APIStyle;
  previousOutputs?: {
    databaseSchema?: string; // XML
    backendArchitecture?: string; // XML
    securityRecommendations?: string; // XML
    testingStrategy?: string; // XML
    devopsConfig?: string; // XML
    validationResult?: string; // XML
    userStories?: string; // XML
  };
}

// ============ Agent Output Types (XML Strings) ============

export interface DatabaseAgentOutput {
  xml: string; // Full XML output
  entities: string[]; // Entity names for quick reference
  relations: string[]; // Relation descriptions
  enums: string[]; // Enum names
}

export interface BackendAgentOutput {
  xml: string;
  endpoints: Array<{
    method: string;
    path: string;
    auth: boolean;
  }>;
  techStack: {
    framework: string;
    runtime: string;
    apiStyle: APIStyle;
  };
}

export interface SecurityRequirement {
  name: string;
  riskPriority: 'critical' | 'high' | 'medium' | 'low';
  implementationPriority: ImplementationPriority;
  description: string;
  implementation?: string;
}

export interface SecurityAgentOutput {
  xml: string;
  owaspCoverage: string[];
  securityScore: number;
  requirements?: SecurityRequirement[];
}

export interface TestingAgentOutput {
  xml: string;
  testSuites: string[];
  coverageTarget: number;
}

export interface DevOpsAgentOutput {
  xml: string;
  services: string[];
  hostingRecommendations: string[];
}

export interface UserStory {
  id: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  priority: 'high' | 'medium' | 'low';
  estimatedEffort: 'small' | 'medium' | 'large';
  relatedEntities: string[];
  relatedEndpoints: string[];
}

export interface UserStoryAgentOutput {
  xml: string;
  stories: UserStory[];
  epicSummary: Array<{
    name: string;
    description: string;
    storyCount: number;
  }>;
}

// ============ Enhanced User Story Types (8-Section PRD) ============

// Product Context Types
export interface ProductGoal {
  id: string;
  description: string;
  priority: 'must_have' | 'should_have' | 'nice_to_have';
  measurable: boolean;
  metric?: string;
}

export interface ProductNonGoal {
  id: string;
  description: string;
  reason: string;
}

export interface SuccessMetric {
  id: string;
  name: string;
  target: string;
  measurementMethod: string;
  baseline?: string;
}

export interface ProductContext {
  background: {
    description: string;
    isNewFeature: boolean;
    existingContext?: string;
  };
  problemStatement: {
    problem: string;
    affectedUsers: string[];
    currentWorkarounds: string[];
    impactIfNotSolved: string;
  };
  goalsAndNonGoals: {
    goals: ProductGoal[];
    nonGoals: ProductNonGoal[];
    successMetrics: SuccessMetric[];
  };
}

// User Persona Types
export interface UserPersona {
  id: string;
  name: string;
  role: string;
  demographics: {
    age?: string;
    location?: string;
    technicalExpertise: 'novice' | 'intermediate' | 'expert';
  };
  needs: string[];
  painPoints: string[];
  constraints: string[];
  goals: string[];
  behaviors: string[];
  quotation?: string;
}

// Acceptance Criteria Types
export interface AcceptanceCriterion {
  id: string;
  description: string;
  type: 'functional' | 'ui' | 'performance' | 'security' | 'accessibility';
  testable: boolean;
  priority: 'must' | 'should' | 'could';
}

// Functional Requirement Types
export interface FunctionalRequirement {
  id: string;
  description: string;
  scenario: string; // Given/When/Then format
  priority: 'must_have' | 'should_have' | 'nice_to_have';
  relatedEndpoint?: string;
  relatedEntity?: string;
}

// Edge Case Types
export interface EdgeCase {
  id: string;
  scenario: string;
  expectedBehavior: string;
  severity: 'critical' | 'major' | 'minor';
  handlingStrategy: string;
}

// Story Dependency Types
export interface StoryDependency {
  storyId: string;
  type: 'hard' | 'soft';
  reason: string;
}

// Enhanced User Story with Full Context
export interface EnhancedUserStory {
  id: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: AcceptanceCriterion[];
  priority: 'high' | 'medium' | 'low';
  estimatedEffort: 'xs' | 'small' | 'medium' | 'large' | 'xl';
  featureId: string;
  epicId: string;
  personaId: string;
  functionalRequirements: FunctionalRequirement[];
  edgeCases: EdgeCase[];
  dependencies: StoryDependency[];
  blockers: string[];
  relatedEntities: string[];
  relatedEndpoints: string[];
  uiComponents: string[];
  userFlow?: string;
}

// Feature Type (Level 2 Hierarchy)
export interface Feature {
  id: string;
  name: string;
  description: string;
  epicId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  businessValue: string;
  successMetrics: string[]; // SuccessMetric ID refs
  dependencies: string[]; // Feature ID refs
  estimatedComplexity: 'low' | 'medium' | 'high' | 'very_high';
  userPersonas: string[]; // UserPersona ID refs
  stories: EnhancedUserStory[];
}

// Epic Type (Level 1 Hierarchy)
export interface Epic {
  id: string;
  name: string;
  description: string;
  businessObjective: string;
  goals: string[]; // ProductGoal ID refs
  successMetrics: string[]; // SuccessMetric ID refs
  targetPersonas: string[]; // UserPersona ID refs
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedDuration?: string;
  features: Feature[];
}

// Enhanced User Story Agent Output
export interface EnhancedUserStoryAgentOutput {
  xml: string;
  productContext: ProductContext;
  personas: UserPersona[];
  epics: Epic[];
  allFeatures: Feature[]; // Flattened for quick access
  allStories: EnhancedUserStory[]; // Flattened
  summary: {
    totalEpics: number;
    totalFeatures: number;
    totalStories: number;
    totalPersonas: number;
    estimatedComplexity: 'low' | 'medium' | 'high' | 'very_high';
    estimatedDuration: string;
  };
}

export interface PRDValidatorOutput {
  xml: string;
  scores: {
    completeness: number;
    consistency: number;
    security: number;
    implementability: number;
    acceptanceCriteria: number;
    nonGoals: number;
    tradeoffs: number;
    overall: number;
  };
  issues: Array<{
    section: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  nonGoalsIdentified: string[];
  tradeoffsIdentified: string[];
  approved: boolean;
}

export interface QAAgentOutput {
  xml: string;
  iteration: number;
  critiques: Array<{
    section: string;
    severity: 'critical' | 'major' | 'minor';
    issue: string;
    suggestedFix: string;
  }>;
  modifications: Array<{
    section: string;
    original: string;
    modified: string;
    reason: string;
  }>;
  frontendBackendAlignmentChecks: Array<{
    name: string;
    status: 'pass' | 'warning' | 'fail';
    issue?: string;
    fix?: string;
  }>;
  requiresAnotherPass: boolean;
  finalApproval: boolean;
}

// ============ Technical Pipeline Result ============

export interface TechnicalPipelineResult {
  // Raw XML outputs from each agent
  databaseSchema: string;
  backendArchitecture: string;
  securityRecommendations: string;
  testingStrategy: string;
  devopsConfig: string;
  userStories: string;
  validationResult: string;
  qaReview: string;

  // Parsed summaries
  summaries: {
    database: DatabaseAgentOutput;
    backend: BackendAgentOutput;
    security: SecurityAgentOutput;
    testing: TestingAgentOutput;
    devops: DevOpsAgentOutput;
    userStory: EnhancedUserStoryAgentOutput;
    validation: PRDValidatorOutput;
    qa: QAAgentOutput;
  };

  // Final PRD
  prdMarkdown: string;

  // Metadata
  metadata: {
    processingTimeMs: number;
    agentsUsed: string[];
    qaIterations: number;
    overallScore: number;
    detailLevel: DetailLevel;
  };
}

// ============ Technical Agent Config ============

export interface TechnicalAgentConfig {
  name: string;
  systemPrompt: string;
  maxTokens: number;
  timeout: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  retryCount: number;
  layer: 1 | 2 | 3;
  dependencies: string[];
  enableWebSearch: boolean;
  provider?: 'gemini' | 'openrouter';
}

// ============ Zod Schemas for Validation ============

export const DatabaseAgentOutputSchema = z.object({
  xml: z.string().min(1),
  entities: z.array(z.string()),
  relations: z.array(z.string()),
  enums: z.array(z.string()),
});

export const BackendAgentOutputSchema = z.object({
  xml: z.string().min(1),
  endpoints: z.array(z.object({
    method: z.string(),
    path: z.string(),
    auth: z.boolean(),
  })),
  techStack: z.object({
    framework: z.string(),
    runtime: z.string(),
    apiStyle: z.string(),
  }),
});

export const SecurityRequirementSchema = z.object({
  name: z.string(),
  riskPriority: z.enum(['critical', 'high', 'medium', 'low']),
  implementationPriority: z.enum(['must_have', 'nice_to_have', 'later']),
  description: z.string(),
  implementation: z.string().optional(),
});

export const SecurityAgentOutputSchema = z.object({
  xml: z.string().min(1),
  owaspCoverage: z.array(z.string()),
  securityScore: z.number().min(0).max(100),
  requirements: z.array(SecurityRequirementSchema).optional(),
});

export const TestingAgentOutputSchema = z.object({
  xml: z.string().min(1),
  testSuites: z.array(z.string()),
  coverageTarget: z.number().min(0).max(100),
});

export const DevOpsAgentOutputSchema = z.object({
  xml: z.string().min(1),
  services: z.array(z.string()),
  hostingRecommendations: z.array(z.string()),
});

export const UserStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  asA: z.string(),
  iWant: z.string(),
  soThat: z.string(),
  acceptanceCriteria: z.array(z.string()),
  priority: z.enum(['high', 'medium', 'low']),
  estimatedEffort: z.enum(['small', 'medium', 'large']),
  relatedEntities: z.array(z.string()),
  relatedEndpoints: z.array(z.string()),
});

export const UserStoryAgentOutputSchema = z.object({
  xml: z.string().min(1),
  stories: z.array(UserStorySchema),
  epicSummary: z.array(z.object({
    name: z.string(),
    description: z.string(),
    storyCount: z.number(),
  })),
});

// Enhanced User Story Schemas
export const ProductGoalSchema = z.object({
  id: z.string(),
  description: z.string(),
  priority: z.enum(['must_have', 'should_have', 'nice_to_have']),
  measurable: z.boolean(),
  metric: z.string().optional(),
});

export const ProductNonGoalSchema = z.object({
  id: z.string(),
  description: z.string(),
  reason: z.string(),
});

export const SuccessMetricSchema = z.object({
  id: z.string(),
  name: z.string(),
  target: z.string(),
  measurementMethod: z.string(),
  baseline: z.string().optional(),
});

export const ProductContextSchema = z.object({
  background: z.object({
    description: z.string(),
    isNewFeature: z.boolean(),
    existingContext: z.string().optional(),
  }),
  problemStatement: z.object({
    problem: z.string(),
    affectedUsers: z.array(z.string()),
    currentWorkarounds: z.array(z.string()),
    impactIfNotSolved: z.string(),
  }),
  goalsAndNonGoals: z.object({
    goals: z.array(ProductGoalSchema),
    nonGoals: z.array(ProductNonGoalSchema),
    successMetrics: z.array(SuccessMetricSchema),
  }),
});

export const UserPersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  demographics: z.object({
    age: z.string().optional(),
    location: z.string().optional(),
    technicalExpertise: z.enum(['novice', 'intermediate', 'expert']),
  }),
  needs: z.array(z.string()),
  painPoints: z.array(z.string()),
  constraints: z.array(z.string()),
  goals: z.array(z.string()),
  behaviors: z.array(z.string()),
  quotation: z.string().optional(),
});

export const AcceptanceCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum(['functional', 'ui', 'performance', 'security', 'accessibility']),
  testable: z.boolean(),
  priority: z.enum(['must', 'should', 'could']),
});

export const FunctionalRequirementSchema = z.object({
  id: z.string(),
  description: z.string(),
  scenario: z.string(),
  priority: z.enum(['must_have', 'should_have', 'nice_to_have']),
  relatedEndpoint: z.string().optional(),
  relatedEntity: z.string().optional(),
});

export const EdgeCaseSchema = z.object({
  id: z.string(),
  scenario: z.string(),
  expectedBehavior: z.string(),
  severity: z.enum(['critical', 'major', 'minor']),
  handlingStrategy: z.string(),
});

export const StoryDependencySchema = z.object({
  storyId: z.string(),
  type: z.enum(['hard', 'soft']),
  reason: z.string(),
});

export const EnhancedUserStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  asA: z.string(),
  iWant: z.string(),
  soThat: z.string(),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema),
  priority: z.enum(['high', 'medium', 'low']),
  estimatedEffort: z.enum(['xs', 'small', 'medium', 'large', 'xl']),
  featureId: z.string(),
  epicId: z.string(),
  personaId: z.string(),
  functionalRequirements: z.array(FunctionalRequirementSchema),
  edgeCases: z.array(EdgeCaseSchema),
  dependencies: z.array(StoryDependencySchema),
  blockers: z.array(z.string()),
  relatedEntities: z.array(z.string()),
  relatedEndpoints: z.array(z.string()),
  uiComponents: z.array(z.string()),
  userFlow: z.string().optional(),
});

export const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  epicId: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  businessValue: z.string(),
  successMetrics: z.array(z.string()),
  dependencies: z.array(z.string()),
  estimatedComplexity: z.enum(['low', 'medium', 'high', 'very_high']),
  userPersonas: z.array(z.string()),
  stories: z.lazy(() => z.array(EnhancedUserStorySchema)),
});

export const EpicSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  businessObjective: z.string(),
  goals: z.array(z.string()),
  successMetrics: z.array(z.string()),
  targetPersonas: z.array(z.string()),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  estimatedDuration: z.string().optional(),
  features: z.lazy(() => z.array(FeatureSchema)),
});

export const EnhancedUserStoryAgentOutputSchema = z.object({
  xml: z.string().min(1),
  productContext: ProductContextSchema,
  personas: z.array(UserPersonaSchema),
  epics: z.array(EpicSchema),
  allFeatures: z.array(FeatureSchema),
  allStories: z.array(EnhancedUserStorySchema),
  summary: z.object({
    totalEpics: z.number(),
    totalFeatures: z.number(),
    totalStories: z.number(),
    totalPersonas: z.number(),
    estimatedComplexity: z.enum(['low', 'medium', 'high', 'very_high']),
    estimatedDuration: z.string(),
  }),
});

export const PRDValidatorOutputSchema = z.object({
  xml: z.string().min(1),
  scores: z.object({
    completeness: z.number(),
    consistency: z.number(),
    security: z.number(),
    implementability: z.number(),
    acceptanceCriteria: z.number(),
    nonGoals: z.number(),
    tradeoffs: z.number(),
    overall: z.number(),
  }),
  issues: z.array(z.object({
    section: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    description: z.string(),
  })),
  nonGoalsIdentified: z.array(z.string()),
  tradeoffsIdentified: z.array(z.string()),
  approved: z.boolean(),
});

export const QAAgentOutputSchema = z.object({
  xml: z.string().min(1),
  iteration: z.number(),
  critiques: z.array(z.object({
    section: z.string(),
    severity: z.enum(['critical', 'major', 'minor']),
    issue: z.string(),
    suggestedFix: z.string(),
  })),
  modifications: z.array(z.object({
    section: z.string(),
    original: z.string(),
    modified: z.string(),
    reason: z.string(),
  })),
  frontendBackendAlignmentChecks: z.array(z.object({
    name: z.string(),
    status: z.enum(['pass', 'warning', 'fail']),
    issue: z.string().optional(),
    fix: z.string().optional(),
  })),
  requiresAnotherPass: z.boolean(),
  finalApproval: z.boolean(),
});

// ============ Agent Status ============

export type TechnicalAgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface TechnicalAgentStatusMap {
  database: TechnicalAgentStatus;
  backend: TechnicalAgentStatus;
  security: TechnicalAgentStatus;
  testing: TechnicalAgentStatus;
  devops: TechnicalAgentStatus;
  userStory: TechnicalAgentStatus;
  prdValidator: TechnicalAgentStatus;
  qa: TechnicalAgentStatus;
  prdSynthesizer: TechnicalAgentStatus;
}

// ============ Error Types ============

export interface TechnicalAgentError {
  agentName: string;
  message: string;
  type: 'timeout' | 'llm_error' | 'validation_error' | 'xml_parse_error' | 'unknown';
  isCritical: boolean;
  timestamp: Date;
}
