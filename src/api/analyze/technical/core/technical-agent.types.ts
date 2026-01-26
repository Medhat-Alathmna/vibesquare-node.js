/**
 * Technical Agent Types
 *
 * Type definitions for the Technical Architecture Pipeline agents.
 * All agents output XML format for organization and consistency.
 */

import { z } from 'zod';

// ============ Pipeline Options ============

export type PipelineType = 'visual' | 'technical' | 'both';
export type DetailLevel = 'basic' | 'detailed' | 'comprehensive';
export type APIStyle = 'REST' | 'GraphQL' | 'REST_GraphQL';
export type ImplementationPriority = 'must_have' | 'nice_to_have' | 'later';
export type TechnicalSpirit = 'modern' | 'legacy' | 'enterprise' | 'startup';

// ============ Identity/Vision Types (Layer 0) ============

/**
 * Product Vision - الرؤية والهدف من المنتج
 */
export interface ProductVision {
  statement: string;        // "أن يصبح أداة قياسية لتحويل التصاميم إلى مستندات تقنية"
  futureState: string;      // الحالة المستقبلية المثالية
  transformation: string;   // كيف تتحسن حياة المستخدم
  timeframe?: string;       // السيناريو المتوقع خلال 3 سنوات
}

/**
 * Value Proposition - القيمة المقدمة
 */
export interface ValueProposition {
  uniqueValue: string;      // ما الذي يميز هذا المنتج
  keyBenefits: Array<{
    name: string;
    impact: string;         // التأثير المتوقع (مثل: "توفير 5 ساعات أسبوعياً")
  }>;
  competitiveAdvantage?: string;
  targetAudience: string;
}

/**
 * AI Coder Context - السياق الضروري للـ AI Vibe Coder
 */
export interface AICoderContext {
  productSummary: string;   // 2-3 جمل ملخصة للـ context window
  technicalSpirit: TechnicalSpirit;
  coreEntities: string[];   // أهم الـ domain objects
  criticalFlows: string[];  // أهم رحلات المستخدم
  constraints: string[];    // القيود التي يجب على الـ AI احترامها
}

/**
 * Affected Segment - الشريحة المتأثرة بالمشكلة
 */
export interface AffectedSegment {
  name: string;
  size?: string;
  painLevel: number;        // 1-10
}

/**
 * Identity Problem Statement - تعريف المشكلة
 */
export interface IdentityProblemStatement {
  coreProblem: string;
  affectedSegments: AffectedSegment[];
  costOfInaction: string;
  existingSolutions?: string;
}

/**
 * Product Identity - الهوية الكاملة للمنتج
 */
export interface ProductIdentity {
  vision: ProductVision;
  problemStatement: IdentityProblemStatement;
  valueProposition: ValueProposition;
  aiCoderContext: AICoderContext;
}

/**
 * Identity Agent Output
 */
export interface IdentityAgentOutput {
  xml: string;
  identity: ProductIdentity;
  confidence: number;       // 0-100 درجة الثقة في الاستنتاج
}

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
    identity?: string; // XML - Layer 0 output
    databaseSchema?: string; // XML
    backendArchitecture?: string; // XML
    securityRecommendations?: string; // XML
    testingStrategy?: string; // XML
    devopsConfig?: string; // XML
    validationResult?: string; // XML
    userStories?: string; // XML
  };
  // Parsed identity for quick access (optional)
  productIdentity?: ProductIdentity;
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

// Analytics KPI Type
export interface AnalyticsKPI {
  name: string;
  target: string;
  measurementMethod: string;
  frequency: 'realtime' | 'daily' | 'weekly' | 'monthly';
}

// Analytics Event Type
export interface AnalyticsEvent {
  name: string;
  trigger: string;
  properties: Array<{ name: string; type: string }>;
  category: 'user_action' | 'system' | 'business' | 'error';
}

// Analytics Dashboard Type
export interface AnalyticsDashboard {
  name: string;
  audience: string;
  metrics: string[];
}

// Observability Alerting Type
export interface ObservabilityAlert {
  name: string;
  condition: string;
  severity: 'critical' | 'warning' | 'info';
}

// DevOps Analytics Configuration
export interface DevOpsAnalytics {
  kpis: AnalyticsKPI[];
  events: AnalyticsEvent[];
  dashboards: AnalyticsDashboard[];
}

// DevOps Observability Configuration
export interface DevOpsObservability {
  logging: {
    format: string;
    levels: string[];
    retention: string;
  };
  metrics: {
    provider: string;
    slis: Array<{ name: string; target: string }>;
  };
  alerting: ObservabilityAlert[];
}

export interface DevOpsAgentOutput {
  xml: string;
  services: string[];
  hostingRecommendations: string[];
  analytics?: DevOpsAnalytics;
  observability?: DevOpsObservability;
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

// Roadmap Phase Types
export type RoadmapPhase = 'mvp' | 'v2' | 'v3' | 'future';

// Business Value Types
export interface BusinessValue {
  estimatedTimeSavings?: string;  // "5 hours/week"
  estimatedCostSavings?: string;  // "$200/month"
  revenueImpact?: string;         // "+15% conversion"
  qualitativeValue: string;       // Required descriptive value
}

// Prioritization Score Types
export interface PrioritizationScore {
  businessImpact: number;         // 1-10
  userImpact: number;             // 1-10
  technicalComplexity: number;    // 1-10
  moscowCategory: 'must' | 'should' | 'could' | 'wont';
  wsjfScore?: number;             // (business + user) / complexity
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
  // NEW: Business Value & Roadmap
  businessValue?: BusinessValue;
  phase: RoadmapPhase;
  phaseRationale?: string;
  prioritizationScore?: PrioritizationScore;
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
  identity?: ProductIdentity;  // Layer 0 - Product Identity (parsed)
  identityConfidence?: number;  // Layer 0 confidence score
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
    identity: IdentityAgentOutput;  // Layer 0
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

  // Confidence Scoring
  confidence: {
    overallScore: number;
    agentScores: Record<string, number>;
    lowConfidenceAreas: string[];
    clarificationNeeded: boolean;
  };

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
  layer: 0 | 1 | 2 | 3;  // 0 = Identity (runs first)
  dependencies: string[];
  enableWebSearch: boolean;
  provider?: 'gemini' | 'openrouter';
  model?: string;  // Override default model for specific agents
}

// ============ Zod Schemas for Validation ============

// ============ Identity Agent Schemas ============

export const ProductVisionSchema = z.object({
  statement: z.string(),
  futureState: z.string(),
  transformation: z.string(),
  timeframe: z.string().optional(),
});

export const ValuePropositionSchema = z.object({
  uniqueValue: z.string(),
  keyBenefits: z.array(z.object({
    name: z.string(),
    impact: z.string(),
  })),
  competitiveAdvantage: z.string().optional(),
  targetAudience: z.string(),
});

export const AICoderContextSchema = z.object({
  productSummary: z.string(),
  technicalSpirit: z.enum(['modern', 'legacy', 'enterprise', 'startup']),
  coreEntities: z.array(z.string()),
  criticalFlows: z.array(z.string()),
  constraints: z.array(z.string()),
});

export const AffectedSegmentSchema = z.object({
  name: z.string(),
  size: z.string().optional(),
  painLevel: z.number().min(1).max(10),
});

export const IdentityProblemStatementSchema = z.object({
  coreProblem: z.string(),
  affectedSegments: z.array(AffectedSegmentSchema),
  costOfInaction: z.string(),
  existingSolutions: z.string().optional(),
});

export const ProductIdentitySchema = z.object({
  vision: ProductVisionSchema,
  problemStatement: IdentityProblemStatementSchema,
  valueProposition: ValuePropositionSchema,
  aiCoderContext: AICoderContextSchema,
});

export const IdentityAgentOutputSchema = z.object({
  xml: z.string().min(1),
  identity: ProductIdentitySchema,
  confidence: z.number().min(0).max(100),
});

// ============ Database Agent Schemas ============

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

// NEW: Business Value & Roadmap Schemas
export const RoadmapPhaseSchema = z.enum(['mvp', 'v2', 'v3', 'future']);

export const BusinessValueSchema = z.object({
  estimatedTimeSavings: z.string().optional(),
  estimatedCostSavings: z.string().optional(),
  revenueImpact: z.string().optional(),
  qualitativeValue: z.string(),
});

export const PrioritizationScoreSchema = z.object({
  businessImpact: z.number().min(1).max(10),
  userImpact: z.number().min(1).max(10),
  technicalComplexity: z.number().min(1).max(10),
  moscowCategory: z.enum(['must', 'should', 'could', 'wont']),
  wsjfScore: z.number().optional(),
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
  // NEW: Business Value & Roadmap
  businessValue: BusinessValueSchema.optional(),
  phase: RoadmapPhaseSchema,
  phaseRationale: z.string().optional(),
  prioritizationScore: PrioritizationScoreSchema.optional(),
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
  identity: TechnicalAgentStatus;  // Layer 0
  database: TechnicalAgentStatus;  // Layer 1
  backend: TechnicalAgentStatus;   // Layer 2
  security: TechnicalAgentStatus;  // Layer 2
  testing: TechnicalAgentStatus;   // Layer 2
  devops: TechnicalAgentStatus;    // Layer 2
  userStory: TechnicalAgentStatus; // Layer 2
  prdValidator: TechnicalAgentStatus;  // Layer 3
  qa: TechnicalAgentStatus;            // Layer 3
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

// ============ Confidence Scoring System ============

/**
 * Confidence levels for agent outputs
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Confidence breakdown by section
 */
export interface ConfidenceBreakdown {
  section: string;
  score: number;  // 0-100
  level: ConfidenceLevel;
  reason?: string;
}

/**
 * Agent confidence score with breakdown
 */
export interface AgentConfidenceScore {
  agentName: string;
  overallScore: number;  // 0-100
  level: ConfidenceLevel;
  breakdown: ConfidenceBreakdown[];
  lowConfidenceAreas: string[];  // Areas that need clarification
  suggestedQuestions: string[];  // Questions to ask user for clarification
}

/**
 * Clarification question for low confidence scenarios
 */
export interface ClarificationQuestion {
  id: string;
  question: string;
  context: string;  // Why we're asking
  agentName: string;
  options?: string[];  // Pre-defined options if applicable
  priority: 'critical' | 'important' | 'optional';
}

/**
 * User response to clarification question
 */
export interface ClarificationResponse {
  questionId: string;
  answer: string;
  timestamp: Date;
}

/**
 * Pipeline confidence state
 */
export interface PipelineConfidenceState {
  overallConfidence: number;
  agentConfidences: Record<string, AgentConfidenceScore>;
  needsClarification: boolean;
  pendingQuestions: ClarificationQuestion[];
  resolvedQuestions: ClarificationResponse[];
  confidenceThreshold: number;  // Default: 70
}

/**
 * Confidence score thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 80,
  MEDIUM: 50,
  LOW: 0,
  REQUIRE_CLARIFICATION: 70,  // Below this, ask user for input
} as const;

/**
 * Helper function to determine confidence level from score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Helper function to check if clarification is needed
 */
export function needsClarification(score: number, threshold = CONFIDENCE_THRESHOLDS.REQUIRE_CLARIFICATION): boolean {
  return score < threshold;
}

// ============ Model Fallback System ============

/**
 * Model tier levels (cost & capability order)
 * NO OPUS - too expensive for this use case
 */
export type ModelTier = 'flash' | 'sonnet' | 'gemini-pro';

/**
 * Model definitions by provider and tier
 */
export const MODEL_TIERS: Record<ModelTier, { provider: 'openrouter' | 'gemini'; model: string; costPerMToken: number }> = {
  flash: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    costPerMToken: 0.075,  // Cheapest, use for non-critical agents
  },
  sonnet: {
    provider: 'openrouter',
    model: 'anthropic/claude-3.5-sonnet',
    costPerMToken: 3.0,  // Balanced, use for critical agents
  },
  'gemini-pro': {
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    costPerMToken: 1.25,  // Alternative to Sonnet
  },
};

/**
 * Agent model preferences (primary and fallback)
 */
export interface AgentModelConfig {
  primary: ModelTier;
  fallbacks: ModelTier[];  // Order of fallback attempts
  requireUserApprovalForFallback: boolean;  // If true, ask user before using more expensive model
}

/**
 * Default model configs by agent type
 */
export const DEFAULT_AGENT_MODEL_CONFIGS: Record<string, AgentModelConfig> = {
  // Critical agents - Use Sonnet/Gemini Pro for best quality
  identity: {
    primary: 'sonnet',
    fallbacks: ['gemini-pro'],
    requireUserApprovalForFallback: false,  // Identity is foundational, retry automatically
  },
  database: {
    primary: 'sonnet',
    fallbacks: ['gemini-pro', 'flash'],
    requireUserApprovalForFallback: false,
  },
  userStory: {
    primary: 'sonnet',
    fallbacks: ['gemini-pro'],
    requireUserApprovalForFallback: false,
  },
  backend: {
    primary: 'sonnet',
    fallbacks: ['gemini-pro', 'flash'],
    requireUserApprovalForFallback: false,
  },
  prdValidator: {
    primary: 'sonnet',
    fallbacks: ['gemini-pro'],
    requireUserApprovalForFallback: false,
  },
  qa: {
    primary: 'sonnet',
    fallbacks: ['gemini-pro'],
    requireUserApprovalForFallback: false,
  },

  // Non-critical agents - Use Flash for cost savings
  security: {
    primary: 'flash',
    fallbacks: ['sonnet'],
    requireUserApprovalForFallback: true,  // Ask before using more expensive model
  },
  testing: {
    primary: 'flash',
    fallbacks: ['sonnet'],
    requireUserApprovalForFallback: true,
  },
  devops: {
    primary: 'flash',
    fallbacks: ['sonnet'],
    requireUserApprovalForFallback: true,
  },
};

/**
 * Model fallback result
 */
export interface ModelFallbackResult {
  modelUsed: ModelTier;
  attemptedModels: ModelTier[];
  fallbackOccurred: boolean;
  userApprovalRequested: boolean;
  userApproved?: boolean;
}

/**
 * Model usage stats for cost tracking
 */
export interface ModelUsageStats {
  agentName: string;
  modelTier: ModelTier;
  tokensUsed: number;
  estimatedCost: number;  // in USD
}

/**
 * Pipeline model usage summary
 */
export interface PipelineModelUsage {
  totalTokens: number;
  totalEstimatedCost: number;
  agentUsage: ModelUsageStats[];
  fallbacksOccurred: number;
}
