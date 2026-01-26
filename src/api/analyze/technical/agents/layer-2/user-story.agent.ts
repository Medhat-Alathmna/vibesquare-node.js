/**
 * User Story Agent
 *
 * Layer 2 Agent that generates comprehensive 8-section Product Requirements Documents.
 * Outputs XML with background, personas, epics, features, stories, functional requirements,
 * edge cases, and acceptance criteria.
 */

import {
  BaseTechnicalAgent,
} from '../../core/base-technical-agent';
import {
  TechnicalAgentInput,
  EnhancedUserStoryAgentOutput,
  EnhancedUserStoryAgentOutputSchema,
  ProductContext,
  UserPersona,
  Epic,
  Feature,
  EnhancedUserStory,
  AcceptanceCriterion,
  FunctionalRequirement,
  EdgeCase,
  StoryDependency,
  ProductGoal,
  ProductNonGoal,
  SuccessMetric,
  BusinessValue,
  PrioritizationScore,
  RoadmapPhase,
} from '../../core/technical-agent.types';
import { TECHNICAL_AGENT_CONFIGS } from '../../core/technical-agent-config';

class UserStoryAgent extends BaseTechnicalAgent<EnhancedUserStoryAgentOutput> {
  constructor() {
    super(TECHNICAL_AGENT_CONFIGS.userStory, EnhancedUserStoryAgentOutputSchema);
  }

  /**
   * Build user prompt from visual analysis and architecture
   */
  protected buildUserPrompt(input: TechnicalAgentInput): string {
    const { visualResults, previousOutputs } = input;
    const databaseSchema = previousOutputs?.databaseSchema || '';
    const backendArchitecture = previousOutputs?.backendArchitecture || '';

    // Extract components for story generation
    const components = visualResults.componentIdentification?.components || [];
    const layoutSections = visualResults.layoutAnalysis?.sections || [];

    return `Generate a comprehensive 8-section Professional Product Requirements Document with detailed user stories, personas, and requirements.

## Visual Analysis Context

### UI Components Detected
${components.map((c) => `- ${c.type}: ${c.count} instance(s)${c.details ? ` (${c.details})` : ''}`).join('\n')}

### Page Sections & Layout
${layoutSections.map((s) => `- ${s.type} at ${s.position}${s.content ? `: ${s.content}` : ''}`).join('\n')}

### Full Visual Context
${visualResults.finalPrompt.substring(0, 3000)}${visualResults.finalPrompt.length > 3000 ? '...' : ''}

## Architecture Context

### Database Schema (First 2500 chars)
\`\`\`xml
${databaseSchema.substring(0, 2500)}${databaseSchema.length > 2500 ? '...' : ''}
\`\`\`

### Backend Architecture (First 2500 chars)
\`\`\`xml
${backendArchitecture.substring(0, 2500)}${backendArchitecture.length > 2500 ? '...' : ''}
\`\`\`

## Instructions

Follow the 8-section structure from the system prompt exactly:

1. **BACKGROUND**: Describe the application and whether it's new product or feature addition
2. **PROBLEM STATEMENT**: Define the specific problem, affected users, workarounds, impact
3. **GOALS & NON-GOALS**: 3-5 goals (must/should/nice), 2-4 non-goals with reasons, 3-5 success metrics
4. **USER PERSONAS**: Infer 2-4 realistic personas from UI components (include name, role, demographics, needs, pain points, constraints, goals, behaviors, quotation)
5. **EPIC → FEATURE → STORY HIERARCHY**: 2-5 epics, each with 2-4 features, each with 3-8 stories. EVERY epic MUST have features.
6. **FUNCTIONAL REQUIREMENTS**: For each story, 3-5 Given/When/Then scenarios linked to endpoints and entities
7. **EDGE CASES**: For each story, 3-5 edge cases (Network/Auth/Data/User/System) with severity and handling strategy
8. **ACCEPTANCE CRITERIA**: Multi-level criteria (story/feature/epic) covering functional/UI/security/performance/accessibility

Output valid XML with root <userStories> element containing all 8 sections.`;
  }

  /**
   * Parse complete XML output to structured 8-section PRD
   */
  protected parseXMLOutput(xmlContent: string): EnhancedUserStoryAgentOutput {
    try {
      // Parse all 8 sections
      const productContext = this.parseProductContext(xmlContent);
      const personas = this.parsePersonas(xmlContent);
      const epics = this.parseEpics(xmlContent, personas);

      // Flatten hierarchy for quick access
      const allFeatures: Feature[] = [];
      const allStories: EnhancedUserStory[] = [];

      epics.forEach((epic) => {
        epic.features.forEach((feature) => {
          allFeatures.push(feature);
          feature.stories.forEach((story) => {
            allStories.push(story);
          });
        });
      });

      // Generate summary
      const summary = this.generateSummary(epics, allFeatures, allStories, personas);

      return {
        xml: xmlContent,
        productContext,
        personas,
        epics,
        allFeatures,
        allStories,
        summary,
      };
    } catch (error) {
      console.error('Error parsing user stories XML:', error);
      // Return graceful fallback with empty structures
      return {
        xml: xmlContent,
        productContext: this.getDefaultProductContext(),
        personas: [],
        epics: [],
        allFeatures: [],
        allStories: [],
        summary: {
          totalEpics: 0,
          totalFeatures: 0,
          totalStories: 0,
          totalPersonas: 0,
          estimatedComplexity: 'medium',
          estimatedDuration: 'Unknown',
        },
      };
    }
  }

  /**
   * Parse Section 1: Background/Overview
   */
  private parseProductContext(xmlContent: string): ProductContext {
    const backgroundMatch = xmlContent.match(/<background>([\s\S]*?)<\/background>/);
    const problemMatch = xmlContent.match(/<problemStatement>([\s\S]*?)<\/problemStatement>/);
    const goalsMatch = xmlContent.match(/<goalsAndNonGoals>([\s\S]*?)<\/goalsAndNonGoals>/);

    const background = {
      description: this.extractText(backgroundMatch?.[1], 'description') || 'Application for managing user data and workflows',
      isNewFeature: this.extractBoolAttribute(backgroundMatch?.[1], 'isNewFeature', false),
      existingContext: this.extractText(backgroundMatch?.[1], 'existingContext'),
    };

    const problemStatement = {
      problem: this.extractText(problemMatch?.[1], 'problem') || 'Undefined problem',
      affectedUsers: this.extractListItems(problemMatch?.[1] || '', 'user') || ['Users'],
      currentWorkarounds: this.extractListItems(problemMatch?.[1] || '', 'workaround') || [],
      impactIfNotSolved: this.extractText(problemMatch?.[1], 'impactIfNotSolved') || 'No significant impact identified',
    };

    const goals = this.parseProductGoals(goalsMatch?.[1]);
    const nonGoals = this.parseProductNonGoals(goalsMatch?.[1]);
    const successMetrics = this.parseSuccessMetrics(goalsMatch?.[1]);

    return {
      background,
      problemStatement,
      goalsAndNonGoals: {
        goals,
        nonGoals,
        successMetrics,
      },
    };
  }

  /**
   * Parse Section 4: User Personas
   */
  private parsePersonas(xmlContent: string): UserPersona[] {
    const personas: UserPersona[] = [];
    const personasMatch = xmlContent.match(/<personas>([\s\S]*?)<\/personas>/);
    if (!personasMatch) return personas;

    const personaMatches = personasMatch[1].match(/<persona[^>]*>([\s\S]*?)<\/persona>/g) || [];

    personaMatches.forEach((personaXml, index) => {
      const id = this.getAttribute(personaXml, 'id') || `P${index + 1}`;
      const name = this.extractText(personaXml, 'name') || `Persona ${index + 1}`;
      const role = this.extractText(personaXml, 'role') || 'User';

      const demographicsMatch = personaXml.match(/<demographics>([\s\S]*?)<\/demographics>/);
      const demographics = {
        age: this.extractText(demographicsMatch?.[1], 'age'),
        location: this.extractText(demographicsMatch?.[1], 'location'),
        technicalExpertise: (this.extractText(demographicsMatch?.[1], 'technicalExpertise') as 'novice' | 'intermediate' | 'expert') || 'intermediate',
      };

      const needs = this.extractListItems(personaXml, 'need') || [];
      const painPoints = this.extractListItems(personaXml, 'painPoint') || [];
      const constraints = this.extractListItems(personaXml, 'constraint') || [];
      const goals = this.extractListItems(personaXml, 'goal') || [];
      const behaviors = this.extractListItems(personaXml, 'behavior') || [];
      const quotation = this.extractText(personaXml, 'quotation');

      personas.push({
        id,
        name,
        role,
        demographics,
        needs,
        painPoints,
        constraints,
        goals,
        behaviors,
        quotation,
      });
    });

    return personas;
  }

  /**
   * Parse Section 5: Epic → Feature → Story Hierarchy
   */
  private parseEpics(xmlContent: string, personas: UserPersona[]): Epic[] {
    const epics: Epic[] = [];
    const epicsMatch = xmlContent.match(/<epics>([\s\S]*?)<\/epics>/);
    if (!epicsMatch) return epics;

    const epicMatches = epicsMatch[1].match(/<epic[^>]*>([\s\S]*?)<\/epic>/g) || [];

    epicMatches.forEach((epicXml, epicIndex) => {
      const epicId = this.getAttribute(epicXml, 'id') || `E${epicIndex + 1}`;
      const epicName = this.getAttribute(epicXml, 'name') || `Epic ${epicIndex + 1}`;
      const epicPriority = (this.getAttribute(epicXml, 'priority') as 'critical' | 'high' | 'medium' | 'low') || 'high';
      const epicDescription = this.extractText(epicXml, 'description') || '';
      const businessObjective = this.extractText(epicXml, 'businessObjective') || '';
      const estimatedDuration = this.extractText(epicXml, 'estimatedDuration');

      const goals = this.extractListItems(epicXml, 'goal') || [];
      const successMetrics = this.extractListItems(epicXml, 'successMetrics') || [];
      const targetPersonas = this.extractListItems(epicXml, 'targetPersonas') || [];

      // Parse features within epic
      const features = this.parseFeatures(epicXml, epicId, personas);

      epics.push({
        id: epicId,
        name: epicName,
        description: epicDescription,
        businessObjective,
        goals,
        successMetrics,
        targetPersonas,
        priority: epicPriority,
        estimatedDuration,
        features,
      });
    });

    return epics;
  }

  /**
   * Parse features within an epic
   */
  private parseFeatures(epicXml: string, epicId: string, personas: UserPersona[]): Feature[] {
    const features: Feature[] = [];
    const featuresMatch = epicXml.match(/<features>([\s\S]*?)<\/features>/);
    if (!featuresMatch) return features;

    const featureMatches = featuresMatch[1].match(/<feature[^>]*>([\s\S]*?)<\/feature>/g) || [];

    featureMatches.forEach((featureXml, featureIndex) => {
      const featureId = this.getAttribute(featureXml, 'id') || `F${epicId.substring(1)}-${featureIndex + 1}`;
      const featureName = this.getAttribute(featureXml, 'name') || `Feature ${featureIndex + 1}`;
      const featurePriority = (this.getAttribute(featureXml, 'priority') as 'critical' | 'high' | 'medium' | 'low') || 'high';
      const featureComplexity = (this.getAttribute(featureXml, 'estimatedComplexity') as 'low' | 'medium' | 'high' | 'very_high') || 'medium';
      const featureDescription = this.extractText(featureXml, 'description') || '';
      const businessValue = this.extractText(featureXml, 'businessValue') || '';

      const successMetrics = this.extractListItems(featureXml, 'successMetrics') || [];
      const dependencies = this.extractListItems(featureXml, 'dependencies') || [];
      const userPersonas = this.extractListItems(featureXml, 'userPersonas') || [];

      // Parse stories within feature
      const stories = this.parseStories(featureXml, featureId, epicId, personas);

      features.push({
        id: featureId,
        name: featureName,
        description: featureDescription,
        epicId,
        priority: featurePriority,
        businessValue,
        successMetrics,
        dependencies,
        estimatedComplexity: featureComplexity,
        userPersonas,
        stories,
      });
    });

    return features;
  }

  /**
   * Parse stories within a feature
   */
  private parseStories(featureXml: string, featureId: string, epicId: string, personas: UserPersona[]): EnhancedUserStory[] {
    const stories: EnhancedUserStory[] = [];
    const storiesMatch = featureXml.match(/<stories>([\s\S]*?)<\/stories>/);
    if (!storiesMatch) return stories;

    const storyMatches = storiesMatch[1].match(/<story[^>]*>([\s\S]*?)<\/story>/g) || [];

    storyMatches.forEach((storyXml) => {
      const story = this.parseStory(storyXml, featureId, epicId, personas);
      if (story) {
        stories.push(story);
      }
    });

    return stories;
  }

  /**
   * Parse individual story with all enhanced fields
   */
  private parseStory(
    storyXml: string,
    featureId: string,
    epicId: string,
    personas: UserPersona[]
  ): EnhancedUserStory | null {
    const storyId = this.getAttribute(storyXml, 'id');
    if (!storyId) return null;

    const title = this.extractText(storyXml, 'title') || `Story ${storyId}`;
    const asA = this.extractText(storyXml, 'asA') || '';
    const iWant = this.extractText(storyXml, 'iWant') || '';
    const soThat = this.extractText(storyXml, 'soThat') || '';

    const priority = (this.getAttribute(storyXml, 'priority') as 'high' | 'medium' | 'low') || 'medium';
    const personaId = this.getAttribute(storyXml, 'personaId') || this.inferPersonaFromStory(asA, personas);
    const estimatedEffort = (this.getAttribute(storyXml, 'estimatedEffort') as 'xs' | 'small' | 'medium' | 'large' | 'xl') || 'medium';

    // Parse Section 6: Functional Requirements
    const functionalRequirements = this.parseFunctionalRequirements(storyXml, storyId);

    // Parse Section 7: Edge Cases
    const edgeCases = this.parseEdgeCases(storyXml, storyId);

    // Parse Section 8: Acceptance Criteria
    const acceptanceCriteria = this.parseAcceptanceCriteria(storyXml, storyId);

    const dependencies = this.parseStoryDependencies(storyXml);
    const relatedEntities = this.extractListItems(storyXml, 'relatedEntity') || this.extractListItems(storyXml, 'entity') || [];
    const relatedEndpoints = this.extractListItems(storyXml, 'relatedEndpoint') || this.extractListItems(storyXml, 'endpoint') || [];
    const uiComponents = this.extractListItems(storyXml, 'uiComponent') || [];
    const userFlow = this.extractCDATA(storyXml, 'userFlow') || this.extractText(storyXml, 'userFlow');
    const blockers = this.extractListItems(storyXml, 'blocker') || [];

    // NEW: Parse Business Value
    const businessValue = this.parseBusinessValue(storyXml);

    // NEW: Parse Roadmap Phase
    const phaseStr = this.extractText(storyXml, 'phase') || 'mvp';
    const phase = (['mvp', 'v2', 'v3', 'future'].includes(phaseStr) ? phaseStr : 'mvp') as RoadmapPhase;
    const phaseRationale = this.extractText(storyXml, 'phaseRationale');

    // NEW: Parse Prioritization Score
    const prioritizationScore = this.parsePrioritizationScore(storyXml);

    return {
      id: storyId,
      title,
      asA,
      iWant,
      soThat,
      acceptanceCriteria,
      priority,
      estimatedEffort,
      featureId,
      epicId,
      personaId,
      functionalRequirements,
      edgeCases,
      dependencies,
      blockers,
      relatedEntities,
      relatedEndpoints,
      uiComponents,
      userFlow,
      // NEW fields
      businessValue,
      phase,
      phaseRationale,
      prioritizationScore,
    };
  }

  /**
   * Parse Section 6: Functional Requirements (Given/When/Then format)
   */
  private parseFunctionalRequirements(storyXml: string, storyId: string): FunctionalRequirement[] {
    const requirements: FunctionalRequirement[] = [];
    const reqsMatch = storyXml.match(/<functionalRequirements>([\s\S]*?)<\/functionalRequirements>/);
    if (!reqsMatch) return requirements;

    const reqMatches = reqsMatch[1].match(/<requirement[^>]*>([\s\S]*?)<\/requirement>/g) || [];

    reqMatches.forEach((reqXml, index) => {
      const reqId = this.getAttribute(reqXml, 'id') || `FR-${storyId}-${index + 1}`;
      const priority = (this.getAttribute(reqXml, 'priority') as 'must_have' | 'should_have' | 'nice_to_have') || 'must_have';
      const description = this.extractText(reqXml, 'description') || `Requirement ${index + 1}`;

      const given = this.extractText(reqXml, 'given') || '';
      const when = this.extractText(reqXml, 'when') || '';
      const then = this.extractText(reqXml, 'then') || '';

      const scenario = `Given ${given}, When ${when}, Then ${then}`;
      const relatedEndpoint = this.extractText(reqXml, 'relatedEndpoint');
      const relatedEntity = this.extractText(reqXml, 'relatedEntity');

      requirements.push({
        id: reqId,
        description,
        scenario,
        priority,
        relatedEndpoint,
        relatedEntity,
      });
    });

    return requirements;
  }

  /**
   * Parse Section 7: Edge Cases
   */
  private parseEdgeCases(storyXml: string, storyId: string): EdgeCase[] {
    const edgeCases: EdgeCase[] = [];
    const casesMatch = storyXml.match(/<edgeCases>([\s\S]*?)<\/edgeCases>/);
    if (!casesMatch) return edgeCases;

    const caseMatches = casesMatch[1].match(/<edgeCase[^>]*>([\s\S]*?)<\/edgeCase>/g) || [];

    caseMatches.forEach((caseXml, index) => {
      const caseId = this.getAttribute(caseXml, 'id') || `EC-${storyId}-${index + 1}`;
      const severity = (this.getAttribute(caseXml, 'severity') as 'critical' | 'major' | 'minor') || 'major';
      const scenario = this.extractText(caseXml, 'scenario') || `Edge case ${index + 1}`;
      const expectedBehavior = this.extractText(caseXml, 'expectedBehavior') || '';
      const handlingStrategy = this.extractText(caseXml, 'handlingStrategy') || '';

      edgeCases.push({
        id: caseId,
        scenario,
        expectedBehavior,
        severity,
        handlingStrategy,
      });
    });

    return edgeCases;
  }

  /**
   * Parse Section 8: Acceptance Criteria
   */
  private parseAcceptanceCriteria(storyXml: string, storyId: string): AcceptanceCriterion[] {
    const criteria: AcceptanceCriterion[] = [];
    const criteriaMatch = storyXml.match(/<acceptanceCriteria>([\s\S]*?)<\/acceptanceCriteria>/);
    if (!criteriaMatch) return criteria;

    const criterionMatches = criteriaMatch[1].match(/<criterion[^>]*>([\s\S]*?)<\/criterion>/g) || [];

    criterionMatches.forEach((criterionXml, index) => {
      const criterionId = this.getAttribute(criterionXml, 'id') || `AC-${storyId}-${index + 1}`;
      const type = (this.getAttribute(criterionXml, 'type') as 'functional' | 'ui' | 'performance' | 'security' | 'accessibility') || 'functional';
      const priority = (this.getAttribute(criterionXml, 'priority') as 'must' | 'should' | 'could') || 'must';
      const description = this.extractText(criterionXml, 'description') || criterionXml.replace(/<[^>]*>/g, '').trim();
      const testable = this.extractBoolAttribute(criterionXml, 'testable', true);

      criteria.push({
        id: criterionId,
        description,
        type,
        testable,
        priority,
      });
    });

    return criteria;
  }

  /**
   * Parse story dependencies
   */
  private parseStoryDependencies(storyXml: string): StoryDependency[] {
    const dependencies: StoryDependency[] = [];
    const depsMatch = storyXml.match(/<dependencies>([\s\S]*?)<\/dependencies>/);
    if (!depsMatch) return dependencies;

    const depMatches = depsMatch[1].match(/<dependency[^>]*>([\s\S]*?)<\/dependency>/g) || [];

    depMatches.forEach((depXml) => {
      const storyId = this.getAttribute(depXml, 'storyId') || this.extractText(depXml, 'storyId');
      if (storyId) {
        const type = (this.getAttribute(depXml, 'type') as 'hard' | 'soft') || 'soft';
        const reason = this.extractText(depXml, 'reason') || '';

        dependencies.push({
          storyId,
          type,
          reason,
        });
      }
    });

    return dependencies;
  }

  /**
   * Parse business value from story XML
   */
  private parseBusinessValue(storyXml: string): BusinessValue | undefined {
    const bvMatch = storyXml.match(/<businessValue>([\s\S]*?)<\/businessValue>/);
    if (!bvMatch) return undefined;

    const bvXml = bvMatch[1];
    const qualitativeValue = this.extractText(bvXml, 'qualitativeValue') || '';

    // If no qualitative value, return undefined
    if (!qualitativeValue) return undefined;

    return {
      estimatedTimeSavings: this.extractText(bvXml, 'estimatedTimeSavings'),
      estimatedCostSavings: this.extractText(bvXml, 'estimatedCostSavings'),
      revenueImpact: this.extractText(bvXml, 'revenueImpact'),
      qualitativeValue,
    };
  }

  /**
   * Parse prioritization score from story XML
   */
  private parsePrioritizationScore(storyXml: string): PrioritizationScore | undefined {
    const psMatch = storyXml.match(/<prioritizationScore[^>]*>/);
    if (!psMatch) return undefined;

    const psXml = psMatch[0];
    const businessImpact = parseInt(this.getAttribute(psXml, 'businessImpact') || '5', 10);
    const userImpact = parseInt(this.getAttribute(psXml, 'userImpact') || '5', 10);
    const technicalComplexity = parseInt(this.getAttribute(psXml, 'technicalComplexity') || '5', 10);
    const moscowCategoryRaw = this.getAttribute(psXml, 'moscowCategory') || 'should';
    const moscowCategory = (['must', 'should', 'could', 'wont'].includes(moscowCategoryRaw)
      ? moscowCategoryRaw
      : 'should') as 'must' | 'should' | 'could' | 'wont';

    // Calculate WSJF score
    const wsjfScore = technicalComplexity > 0
      ? (businessImpact + userImpact) / technicalComplexity
      : 0;

    return {
      businessImpact: Math.min(Math.max(businessImpact, 1), 10),
      userImpact: Math.min(Math.max(userImpact, 1), 10),
      technicalComplexity: Math.min(Math.max(technicalComplexity, 1), 10),
      moscowCategory,
      wsjfScore: Math.round(wsjfScore * 100) / 100,
    };
  }

  /**
   * Parse product goals from goals section
   */
  private parseProductGoals(goalsXml: string | undefined): ProductGoal[] {
    const goals: ProductGoal[] = [];
    if (!goalsXml) return goals;

    const goalMatches = goalsXml.match(/<goal[^>]*>([\s\S]*?)<\/goal>/g) || [];

    goalMatches.forEach((goalXml, index) => {
      const goalId = this.getAttribute(goalXml, 'id') || `G${index + 1}`;
      const priority = (this.getAttribute(goalXml, 'priority') as 'must_have' | 'should_have' | 'nice_to_have') || 'must_have';
      const description = this.extractText(goalXml, 'description') || '';
      const measurable = this.extractBoolAttribute(goalXml, 'measurable', false);
      const metric = this.extractText(goalXml, 'metric');

      goals.push({
        id: goalId,
        description,
        priority,
        measurable,
        metric,
      });
    });

    return goals;
  }

  /**
   * Parse product non-goals
   */
  private parseProductNonGoals(goalsXml: string | undefined): ProductNonGoal[] {
    const nonGoals: ProductNonGoal[] = [];
    if (!goalsXml) return nonGoals;

    const nonGoalMatches = goalsXml.match(/<nonGoal[^>]*>([\s\S]*?)<\/nonGoal>/g) || [];

    nonGoalMatches.forEach((nonGoalXml, index) => {
      const nonGoalId = this.getAttribute(nonGoalXml, 'id') || `NG${index + 1}`;
      const description = this.extractText(nonGoalXml, 'description') || '';
      const reason = this.extractText(nonGoalXml, 'reason') || '';

      nonGoals.push({
        id: nonGoalId,
        description,
        reason,
      });
    });

    return nonGoals;
  }

  /**
   * Parse success metrics
   */
  private parseSuccessMetrics(goalsXml: string | undefined): SuccessMetric[] {
    const metrics: SuccessMetric[] = [];
    if (!goalsXml) return metrics;

    const metricsMatch = goalsXml.match(/<successMetrics>([\s\S]*?)<\/successMetrics>/);
    if (!metricsMatch) return metrics;

    const metricMatches = metricsMatch[1].match(/<metric[^>]*>([\s\S]*?)<\/metric>/g) || [];

    metricMatches.forEach((metricXml, index) => {
      const metricId = this.getAttribute(metricXml, 'id') || `M${index + 1}`;
      const name = this.extractText(metricXml, 'name') || `Metric ${index + 1}`;
      const target = this.extractText(metricXml, 'target') || '';
      const measurementMethod = this.extractText(metricXml, 'measurementMethod') || '';
      const baseline = this.extractText(metricXml, 'baseline');

      metrics.push({
        id: metricId,
        name,
        target,
        measurementMethod,
        baseline,
      });
    });

    return metrics;
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(
    epics: Epic[],
    features: Feature[],
    stories: EnhancedUserStory[],
    personas: UserPersona[]
  ) {
    // Estimate complexity based on number of features and stories
    const totalComplexityScore = features.reduce((sum, f) => {
      const complexityValue =
        f.estimatedComplexity === 'low' ? 1 :
        f.estimatedComplexity === 'medium' ? 2 :
        f.estimatedComplexity === 'high' ? 3 : 4;
      return sum + complexityValue;
    }, 0);

    const avgComplexity = features.length > 0 ? totalComplexityScore / features.length : 2;
    const estimatedComplexity = (
      avgComplexity < 1.5 ? 'low' :
      avgComplexity < 2.5 ? 'medium' :
      avgComplexity < 3.5 ? 'high' : 'very_high'
    ) as 'low' | 'medium' | 'high' | 'very_high';

    // Estimate duration based on features and complexity
    let durationEstimate = '2-4 weeks';
    if (features.length <= 3 && estimatedComplexity === 'low') {
      durationEstimate = '1-2 weeks';
    } else if (features.length > 8 || estimatedComplexity === 'very_high') {
      durationEstimate = '8-12+ weeks';
    } else if (features.length > 5) {
      durationEstimate = '4-8 weeks';
    }

    return {
      totalEpics: epics.length,
      totalFeatures: features.length,
      totalStories: stories.length,
      totalPersonas: personas.length,
      estimatedComplexity,
      estimatedDuration: durationEstimate,
    };
  }

  /**
   * Helper: Extract attribute value from XML element
   */
  private getAttribute(xml: string, attrName: string): string | undefined {
    const match = xml.match(new RegExp(`${attrName}="([^"]*)"`));
    return match?.[1];
  }

  /**
   * Helper: Extract text from XML element
   */
  private extractText(xml: string | undefined, tagName: string): string | undefined {
    if (!xml) return undefined;
    const match = xml.match(new RegExp(`<${tagName}>([^<]*)</${tagName}>`));
    return match?.[1]?.trim() || undefined;
  }

  /**
   * Helper: Extract CDATA or regular text content
   */
  private extractCDATA(xml: string | undefined, tagName: string): string | undefined {
    if (!xml) return undefined;
    // Try CDATA first
    const cdataMatch = xml.match(new RegExp(`<${tagName}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`));
    if (cdataMatch) return cdataMatch[1]?.trim();
    // Fall back to regular content
    return this.extractText(xml, tagName);
  }

  /**
   * Helper: Extract list items from XML
   */
  private extractListItems(xml: string | undefined, itemTagName: string): string[] {
    if (!xml) return [];
    const itemMatches = xml.match(new RegExp(`<${itemTagName}[^>]*>([^<]*)</${itemTagName}>`, 'g')) || [];
    return itemMatches
      .map((item) => {
        const match = item.match(new RegExp(`<${itemTagName}[^>]*>([^<]*)</${itemTagName}>`));
        return match?.[1]?.trim() || '';
      })
      .filter(Boolean);
  }

  /**
   * Helper: Extract boolean attribute
   */
  private extractBoolAttribute(xml: string | undefined, attrName: string, defaultValue: boolean): boolean {
    if (!xml) return defaultValue;
    const attrValue = this.getAttribute(xml, attrName);
    if (!attrValue) return defaultValue;
    return attrValue.toLowerCase() === 'true' || attrValue === '1';
  }

  /**
   * Helper: Infer persona from story context
   */
  private inferPersonaFromStory(asA: string, personas: UserPersona[]): string {
    if (!asA || personas.length === 0) return personas[0]?.id || 'P1';

    // Try to match asA text with persona roles
    const lowerAsA = asA.toLowerCase();
    const matchedPersona = personas.find((p) => lowerAsA.includes(p.role.toLowerCase()));

    return matchedPersona?.id || personas[0].id;
  }

  /**
   * Helper: Get default product context for fallback
   */
  private getDefaultProductContext(): ProductContext {
    return {
      background: {
        description: 'Application for managing user data and workflows',
        isNewFeature: false,
      },
      problemStatement: {
        problem: 'Undefined problem',
        affectedUsers: ['Users'],
        currentWorkarounds: [],
        impactIfNotSolved: 'No significant impact identified',
      },
      goalsAndNonGoals: {
        goals: [],
        nonGoals: [],
        successMetrics: [],
      },
    };
  }
}

// Export singleton instance
export const userStoryAgent = new UserStoryAgent();
export default userStoryAgent;
