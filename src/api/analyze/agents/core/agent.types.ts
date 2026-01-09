/**
 * Agent Type Definitions
 *
 * This file contains all type definitions for the multi-agent system.
 * Used by all agents, orchestration, and conflict resolution.
 */

import { RawParsedDOM, StructuralAnalysis, ColorInfo, FontInfo } from '../../pipeline/ir.types';

// ============ Agent Priority ============
export type AgentPriority = 'critical' | 'high' | 'medium' | 'low';

// ============ Agent Status ============
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// ============ Visual Roles ============
export type SectionVisualRole = 'navigation' | 'branding' | 'impact' | 'content' | 'footer' | 'sidebar' | 'unknown';

// ============ Layout Patterns ============
export type LayoutPattern = 'single-column' | 'two-column' | 'three-column' | 'grid' | 'masonry' | 'mixed';

// ============ Component Types ============
export type ComponentType =
  | 'card-grid'
  | 'testimonial-slider'
  | 'pricing-table'
  | 'feature-list'
  | 'hero-section'
  | 'navigation'
  | 'footer'
  | 'form'
  | 'cta-section'
  | 'gallery'
  | 'accordion'
  | 'tabs'
  | 'unknown';

// ============ Visual Identity ============
export type VisualTone = 'corporate' | 'modern' | 'playful' | 'minimal' | 'bold' | 'retro' | 'unknown';
export type VisualDensity = 'compact' | 'balanced' | 'spacious';
export type VisualContrast = 'low' | 'medium' | 'high';

// ============ Animation Types ============
export type AnimationType = 'fade' | 'slide' | 'reveal' | 'scale' | 'rotate' | 'none';
export type AnimationTrigger = 'load' | 'scroll' | 'hover' | 'click' | 'unknown';

// ============ Base Interfaces ============

export interface AgentInput {
  parsedDOM: RawParsedDOM;
  structuralAnalysis: StructuralAnalysis;
  previousOutputs?: Record<string, unknown>;
}

export interface AgentOutput<T = unknown> {
  data: T;
  confidence: number;
  ambiguities: Ambiguity[];
  processingTimeMs: number;
  tokenUsage: number;
}

export interface AgentConfig {
  name: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  timeout: number;
  priority: AgentPriority;
  retryCount: number;
}

// ============ Ambiguity & Questions ============

export interface Ambiguity {
  section: string;
  nodeIds?: number[];
  question: string;
  reason: string;
  criticality: 'high' | 'medium' | 'low';
}

export interface UserQuestion {
  section: string;
  question: string;
  options: string[];
  defaultSuggestion: string;
  criticality: 'high' | 'medium' | 'low';
}

// ============ Layout Analyzer Output ============

export interface SectionInfo {
  nodeIds: number[];
  visualRole: SectionVisualRole;
  confidence: number;
}

export interface LayoutPatternInfo {
  primary: LayoutPattern;
  gridColumns?: number | null;
  breakpoints: string[];
}

export interface LayoutAnalysisOutput {
  sections: {
    header?: SectionInfo;
    hero?: SectionInfo;
    body?: SectionInfo[];
    sidebar?: SectionInfo;
    footer?: SectionInfo;
  };
  layoutPatterns: LayoutPatternInfo;
  visualHierarchy: {
    depth: number;
    mainContentPath: number[];
  };
}

// ============ Component Identifier Output ============

export interface IdentifiedComponent {
  type: ComponentType;
  nodeIds: number[];
  pattern?: 'masonry' | 'regular-grid' | 'list' | 'slider' | null;
  columns?: number | null;
  repeatCount?: number | null;
  visualCharacteristics: string;
}

export interface ComponentIdentificationOutput {
  components: IdentifiedComponent[];
  forms: {
    nodeId: number;
    purpose: 'contact' | 'newsletter' | 'login' | 'search' | 'checkout' | 'unknown';
    fieldCount: number;
  }[];
  navigation: {
    nodeId: number;
    itemCount: number;
    hasMobileMenu: boolean;
  } | null;
}

// ============ Design System Output ============

export interface DesignColors {
  primary: string;
  secondary?: string | null;
  accent?: string | null;
  background?: string | null;
  text?: string | null;
}

export interface DesignFonts {
  heading?: { family: string; source: 'google' | 'system' | 'custom' } | null;
  body?: { family: string; source: 'google' | 'system' | 'custom' } | null;
}

export interface DesignSpacing {
  system: 'consistent' | 'mixed';
  baseUnit?: string | null;
}

export interface VisualIdentity {
  tone: VisualTone;
  density: VisualDensity;
  contrast: VisualContrast;
}

export interface DesignSystemOutput {
  colors: DesignColors;
  fonts: DesignFonts;
  spacing: DesignSpacing;
  visualIdentity: VisualIdentity;
}

// ============ Interaction Analyzer Output ============

export interface InteractionInfo {
  elementType: string;
  nodeIds: number[];
  behavior: string;
  animationType: AnimationType;
  trigger: AnimationTrigger;
}

export interface InteractionAnalysisOutput {
  interactions: InteractionInfo[];
  hoverEffects: {
    nodeIds: number[];
    effect: string;
  }[];
  scrollBehaviors: {
    type: 'parallax' | 'sticky' | 'reveal' | 'none';
    nodeIds: number[];
  }[];
}

// ============ Responsive Behavior Output ============

export interface BreakpointChange {
  width: string;
  changes: string;
}

export interface MobilePatterns {
  navigation: 'hamburger-menu' | 'bottom-nav' | 'hidden' | 'unchanged';
  gridColumns: number;
  textScaling: 'reduced' | 'unchanged' | 'increased';
}

export interface ResponsiveBehaviorOutput {
  breakpoints: BreakpointChange[];
  mobilePatterns: MobilePatterns;
  tabletPatterns?: {
    gridColumns: number;
    layoutChanges: string;
  };
}

// ============ Conflict Resolver Output ============

export interface ResolvedDecision {
  conflict: string;
  resolution: string;
  reason: string;
  evidence?: string | null;
  agentSources: string[];
}

export interface ConflictResolverOutput {
  resolvedDecisions: ResolvedDecision[];
  unresolvedAmbiguities: Ambiguity[];
}

// ============ Prompt Synthesizer Output ============

export interface PromptSynthesizerOutput {
  finalPrompt: string;
  sectionsIncluded: string[];
  imagesReferenced: number;
  decisionsApplied: number;
}

// ============ User Question Collector Output ============

export interface UserQuestionCollectorOutput {
  criticalQuestions: UserQuestion[];
  optionalQuestions: UserQuestion[];
  totalAmbiguities: number;
}

// ============ Agent State (LangGraph) ============

export interface AgentState {
  // Input
  parsedDOM: RawParsedDOM;
  structuralAnalysis: StructuralAnalysis;

  // Agent outputs
  layoutAnalysis?: AgentOutput<LayoutAnalysisOutput>;
  componentIdentification?: AgentOutput<ComponentIdentificationOutput>;
  designSystem?: AgentOutput<DesignSystemOutput>;
  interactionAnalysis?: AgentOutput<InteractionAnalysisOutput>;
  responsiveBehavior?: AgentOutput<ResponsiveBehaviorOutput>;

  // Conflict resolution
  conflictResolution?: AgentOutput<ConflictResolverOutput>;

  // Final outputs
  promptSynthesis?: AgentOutput<PromptSynthesizerOutput>;
  userQuestions?: AgentOutput<UserQuestionCollectorOutput>;

  // Meta
  errors: AgentError[];
  agentStatus: Record<string, AgentStatus>;
  fallbackTriggered: boolean;
  startTime: number;

  // Final result
  finalPrompt?: string;
  questionsForUser?: UserQuestion[];
}

export interface AgentError {
  agentName: string;
  error: string;
  timestamp: number;
  recoverable: boolean;
}

// ============ Pipeline Result V2 ============

export interface PipelineV2Result {
  finalPrompt: string;
  userQuestions?: UserQuestion[];
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
  debug?: {
    parsedDOM: RawParsedDOM;
    agentOutputs: Record<string, AgentOutput>;
    conflictResolutions?: ResolvedDecision[];
  };
}

// ============ Token Budget ============

export interface AgentTokenBudget {
  layoutAnalyzer: number;
  componentIdentifier: number;
  designSystemExtractor: number;
  interactionAnalyzer: number;
  responsiveBehavior: number;
  conflictResolver: number;
  promptSynthesizer: number;
  userQuestionCollector: number;
  buffer: number;
}

export type UserTier = 'free' | 'basic' | 'pro' | 'enterprise';

export const TOKEN_BUDGETS: Record<UserTier, AgentTokenBudget> = {
  free: {
    layoutAnalyzer: 2000,
    componentIdentifier: 2000,
    designSystemExtractor: 1500,
    interactionAnalyzer: 1500,
    responsiveBehavior: 1000,
    conflictResolver: 2000,
    promptSynthesizer: 3000,
    userQuestionCollector: 1000,
    buffer: 6000,
  },
  basic: {
    layoutAnalyzer: 5000,
    componentIdentifier: 5000,
    designSystemExtractor: 4000,
    interactionAnalyzer: 4000,
    responsiveBehavior: 3000,
    conflictResolver: 5000,
    promptSynthesizer: 7000,
    userQuestionCollector: 2000,
    buffer: 15000,
  },
  pro: {
    layoutAnalyzer: 10000,
    componentIdentifier: 10000,
    designSystemExtractor: 8000,
    interactionAnalyzer: 8000,
    responsiveBehavior: 6000,
    conflictResolver: 10000,
    promptSynthesizer: 15000,
    userQuestionCollector: 4000,
    buffer: 29000,
  },
  enterprise: {
    layoutAnalyzer: 20000,
    componentIdentifier: 20000,
    designSystemExtractor: 15000,
    interactionAnalyzer: 15000,
    responsiveBehavior: 12000,
    conflictResolver: 20000,
    promptSynthesizer: 30000,
    userQuestionCollector: 8000,
    buffer: 60000,
  },
};
