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
  previousOutputs?: {
    databaseSchema?: string; // XML
    backendArchitecture?: string; // XML
    securityRecommendations?: string; // XML
    testingStrategy?: string; // XML
    devopsConfig?: string; // XML
    validationResult?: string; // XML
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
    apiStyle: string;
  };
}

export interface SecurityAgentOutput {
  xml: string;
  owaspCoverage: string[];
  securityScore: number;
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

export interface PRDValidatorOutput {
  xml: string;
  scores: {
    completeness: number;
    consistency: number;
    security: number;
    implementability: number;
    overall: number;
  };
  issues: Array<{
    section: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
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
  validationResult: string;
  qaReview: string;

  // Parsed summaries
  summaries: {
    database: DatabaseAgentOutput;
    backend: BackendAgentOutput;
    security: SecurityAgentOutput;
    testing: TestingAgentOutput;
    devops: DevOpsAgentOutput;
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

export const SecurityAgentOutputSchema = z.object({
  xml: z.string().min(1),
  owaspCoverage: z.array(z.string()),
  securityScore: z.number().min(0).max(100),
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

export const PRDValidatorOutputSchema = z.object({
  xml: z.string().min(1),
  scores: z.object({
    completeness: z.number(),
    consistency: z.number(),
    security: z.number(),
    implementability: z.number(),
    overall: z.number(),
  }),
  issues: z.array(z.object({
    section: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    description: z.string(),
  })),
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
