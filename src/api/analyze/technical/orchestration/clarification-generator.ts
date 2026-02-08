/**
 * Clarification Generator
 *
 * Rule-based (no LLM) question generator that analyzes visual pipeline results
 * and generates targeted select-option questions with recommended answers.
 *
 * Runs BEFORE the technical pipeline to gather user input that prevents hallucination.
 */

import {
  VisualPipelineResult,
  ClarificationQuestion,
  ClarificationOption,
  ClarificationResponse,
  PreflightResult,
} from '../core/technical-agent.types';

// ============ Visual Analysis Helpers ============

interface VisualSignals {
  hasAuth: boolean;
  hasEcommerce: boolean;
  hasDashboard: boolean;
  hasSocial: boolean;
  hasContent: boolean;
  hasForms: boolean;
  hasSearch: boolean;
  hasNavigation: boolean;
  hasFooter: boolean;
  hasHero: boolean;
  hasPricing: boolean;
  hasMedia: boolean;
  componentTypes: string[];
  layoutType: string;
  sourceUrl: string;
}

/**
 * Extract visual signals from pipeline result
 */
function extractVisualSignals(visualResults: VisualPipelineResult): VisualSignals {
  const components = visualResults.componentIdentification?.components || [];
  const sections = visualResults.layoutAnalysis?.sections || [];
  const componentTypes = components.map((c) => c.type.toLowerCase());
  const sectionTypes = sections.map((s) => s.type.toLowerCase());

  const hasType = (keywords: string[]) =>
    componentTypes.some((t) => keywords.some((k) => t.includes(k)));

  const hasSection = (keywords: string[]) =>
    sectionTypes.some((t) => keywords.some((k) => t.includes(k)));

  return {
    hasAuth: hasType(['login', 'register', 'auth', 'signup', 'signin', 'profile', 'avatar']),
    hasEcommerce: hasType(['cart', 'checkout', 'product', 'price', 'buy', 'shop', 'payment']),
    hasDashboard: hasType(['dashboard', 'chart', 'stats', 'analytics', 'graph', 'metric']),
    hasSocial: hasType(['feed', 'post', 'comment', 'like', 'share', 'follow', 'timeline']),
    hasContent: hasType(['article', 'blog', 'content', 'editor', 'cms', 'text']),
    hasForms: hasType(['form', 'input', 'textarea', 'select', 'checkbox', 'radio']),
    hasSearch: hasType(['search', 'filter', 'sort']),
    hasNavigation: hasType(['nav', 'navigation', 'menu', 'sidebar', 'breadcrumb']) || hasSection(['nav', 'header']),
    hasFooter: hasSection(['footer']),
    hasHero: hasSection(['hero', 'banner', 'jumbotron']),
    hasPricing: hasType(['pricing', 'plan', 'subscription', 'tier']),
    hasMedia: hasType(['image', 'video', 'gallery', 'carousel', 'slider']),
    componentTypes,
    layoutType: visualResults.metadata?.layoutType || 'unknown',
    sourceUrl: visualResults.metadata?.sourceUrl || '',
  };
}

// ============ Question Generators ============

/**
 * Generate authentication question based on visual signals
 */
function generateAuthQuestion(signals: VisualSignals): ClarificationQuestion | null {
  if (signals.hasAuth) {
    return {
      id: 'auth-method',
      question: 'What authentication method should this product use?',
      context: 'Login/registration UI detected in the visual analysis.',
      agentName: 'system',
      allowMultiple: true,
      allowCustom: true,
      priority: 'critical',
      options: [
        {
          value: 'email_password',
          label: 'Email/Password',
          description: 'Traditional login with email and password',
          isRecommended: true,
          recommendationReason: 'Login form detected in UI',
        },
        {
          value: 'social_oauth',
          label: 'Social Login (Google, GitHub, etc.)',
          description: 'OAuth-based social authentication',
          isRecommended: false,
        },
        {
          value: 'sso',
          label: 'SSO/Enterprise',
          description: 'Single sign-on for enterprise users',
          isRecommended: false,
        },
        {
          value: 'magic_link',
          label: 'Magic Link (passwordless)',
          description: 'Email-based passwordless authentication',
          isRecommended: false,
        },
      ],
    };
  }

  // No auth detected - ask if they need it
  return {
    id: 'auth-needed',
    question: 'Does this product need user authentication?',
    context: 'No login or registration UI was detected in the visual analysis.',
    agentName: 'system',
    allowMultiple: false,
    allowCustom: true,
    priority: 'important',
    options: [
      {
        value: 'no_auth',
        label: 'No authentication needed',
        description: 'Public-facing product without user accounts',
        isRecommended: true,
        recommendationReason: 'No login UI detected in the design',
      },
      {
        value: 'email_password',
        label: 'Yes, email/password',
        description: 'Add basic email/password authentication',
        isRecommended: false,
      },
      {
        value: 'social_oauth',
        label: 'Yes, social login',
        description: 'Add OAuth-based social authentication',
        isRecommended: false,
      },
    ],
  };
}

/**
 * Generate product type question based on visual signals
 */
function generateProductTypeQuestion(signals: VisualSignals): ClarificationQuestion {
  const options: ClarificationOption[] = [];

  // Build options with recommendations based on detected signals
  if (signals.hasHero && !signals.hasDashboard && !signals.hasEcommerce) {
    options.push({
      value: 'landing_page',
      label: 'Landing/Marketing Page',
      description: 'Single-page marketing site with call-to-action',
      isRecommended: true,
      recommendationReason: 'Hero section and CTA layout detected',
    });
  } else {
    options.push({
      value: 'landing_page',
      label: 'Landing/Marketing Page',
      description: 'Single-page marketing site with call-to-action',
      isRecommended: false,
    });
  }

  if (signals.hasDashboard) {
    options.push({
      value: 'saas_app',
      label: 'SaaS Application',
      description: 'Software-as-a-service with dashboards and user management',
      isRecommended: true,
      recommendationReason: 'Dashboard and analytics components detected',
    });
  } else {
    options.push({
      value: 'saas_app',
      label: 'SaaS Application',
      description: 'Software-as-a-service with dashboards and user management',
      isRecommended: false,
    });
  }

  if (signals.hasEcommerce) {
    options.push({
      value: 'ecommerce',
      label: 'E-commerce Store',
      description: 'Online store with products, cart, and checkout',
      isRecommended: true,
      recommendationReason: 'Shopping/product components detected',
    });
  } else {
    options.push({
      value: 'ecommerce',
      label: 'E-commerce Store',
      description: 'Online store with products, cart, and checkout',
      isRecommended: false,
    });
  }

  if (signals.hasSocial) {
    options.push({
      value: 'social_platform',
      label: 'Social/Community Platform',
      description: 'Social network with feeds, posts, and interactions',
      isRecommended: true,
      recommendationReason: 'Social interaction components detected',
    });
  }

  // Ensure at least 3 options
  if (!signals.hasContent) {
    options.push({
      value: 'content_platform',
      label: 'Content/Blog Platform',
      description: 'Content publishing with articles and media',
      isRecommended: false,
    });
  }

  return {
    id: 'product-type',
    question: 'What best describes this product?',
    context: 'Understanding the product type helps generate more accurate architecture.',
    agentName: 'system',
    allowMultiple: false,
    allowCustom: true,
    priority: 'critical',
    options: options.slice(0, 4), // Max 4 options
  };
}

/**
 * Generate tech stack question
 */
function generateTechStackQuestion(signals: VisualSignals): ClarificationQuestion {
  return {
    id: 'tech-stack',
    question: 'What tech stack do you plan to use?',
    context: 'This determines the backend architecture, database, and deployment recommendations.',
    agentName: 'system',
    allowMultiple: false,
    allowCustom: true,
    priority: 'important',
    options: [
      {
        value: 'react_node',
        label: 'React + Node.js/Express',
        description: 'Popular full-stack JavaScript setup',
        isRecommended: true,
        recommendationReason: 'Most common choice for modern web applications',
      },
      {
        value: 'nextjs',
        label: 'Next.js (Full-stack)',
        description: 'React framework with SSR and API routes',
        isRecommended: false,
      },
      {
        value: 'vue_python',
        label: 'Vue + Python/Django',
        description: 'Vue.js frontend with Python backend',
        isRecommended: false,
      },
      {
        value: 'system_decide',
        label: 'Let the system decide',
        description: 'System will recommend based on product requirements',
        isRecommended: false,
      },
    ],
  };
}

/**
 * Generate key features question based on what was detected
 */
function generateKeyFeaturesQuestion(signals: VisualSignals): ClarificationQuestion {
  const options: ClarificationOption[] = [];

  if (signals.hasSearch) {
    options.push({
      value: 'search',
      label: 'Search & Filtering',
      description: 'Full-text search with filters',
      isRecommended: true,
      recommendationReason: 'Search UI component detected',
    });
  } else {
    options.push({
      value: 'search',
      label: 'Search & Filtering',
      description: 'Full-text search with filters',
      isRecommended: false,
    });
  }

  if (signals.hasForms) {
    options.push({
      value: 'crud',
      label: 'CRUD Operations',
      description: 'Create, read, update, delete data',
      isRecommended: true,
      recommendationReason: 'Form components detected in UI',
    });
  } else {
    options.push({
      value: 'crud',
      label: 'CRUD Operations',
      description: 'Create, read, update, delete data',
      isRecommended: false,
    });
  }

  options.push({
    value: 'realtime',
    label: 'Real-time Updates',
    description: 'WebSocket-based live data (chat, notifications)',
    isRecommended: signals.hasSocial,
    recommendationReason: signals.hasSocial ? 'Social features often need real-time' : undefined,
  });

  options.push({
    value: 'file_upload',
    label: 'File Upload',
    description: 'Image/document upload and management',
    isRecommended: signals.hasMedia,
    recommendationReason: signals.hasMedia ? 'Media components detected in UI' : undefined,
  });

  return {
    id: 'key-features',
    question: 'Which key features should the PRD focus on?',
    context: 'Select the features that are most important for your product.',
    agentName: 'system',
    allowMultiple: true,
    allowCustom: true,
    priority: 'optional',
    options,
  };
}

/**
 * Generate database question
 */
function generateDatabaseQuestion(signals: VisualSignals): ClarificationQuestion {
  return {
    id: 'database',
    question: 'What database do you prefer?',
    context: 'This affects the schema design and ORM recommendations.',
    agentName: 'system',
    allowMultiple: false,
    allowCustom: true,
    priority: 'optional',
    options: [
      {
        value: 'postgresql',
        label: 'PostgreSQL',
        description: 'Relational database, great for structured data',
        isRecommended: true,
        recommendationReason: 'Most versatile choice for web applications',
      },
      {
        value: 'mongodb',
        label: 'MongoDB',
        description: 'Document database, flexible schema',
        isRecommended: false,
      },
      {
        value: 'mysql',
        label: 'MySQL',
        description: 'Widely-used relational database',
        isRecommended: false,
      },
      {
        value: 'system_decide',
        label: 'Let the system decide',
        description: 'System will recommend based on data model',
        isRecommended: false,
      },
    ],
  };
}

// ============ Main Generator ============

/**
 * Generate clarification questions from visual pipeline results.
 * Rule-based, no LLM call needed. Returns 3-5 questions.
 */
export function generateClarificationQuestions(
  visualResults: VisualPipelineResult
): PreflightResult {
  const signals = extractVisualSignals(visualResults);
  const questions: ClarificationQuestion[] = [];

  // Always ask product type (critical)
  questions.push(generateProductTypeQuestion(signals));

  // Always ask about auth (critical)
  const authQuestion = generateAuthQuestion(signals);
  if (authQuestion) {
    questions.push(authQuestion);
  }

  // Tech stack (important)
  questions.push(generateTechStackQuestion(signals));

  // Key features (optional, but useful)
  questions.push(generateKeyFeaturesQuestion(signals));

  // Database (optional)
  questions.push(generateDatabaseQuestion(signals));

  // Sort: critical first, then important, then optional
  const priorityOrder = { critical: 0, important: 1, optional: 2 };
  questions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    questions,
    visualSummary: {
      componentsDetected: signals.componentTypes,
      hasAuth: signals.hasAuth,
      hasEcommerce: signals.hasEcommerce,
      hasDashboard: signals.hasDashboard,
      hasSocial: signals.hasSocial,
      hasContent: signals.hasContent,
      layoutType: signals.layoutType,
      sourceUrl: signals.sourceUrl,
    },
  };
}

/**
 * Format user clarifications into a readable string for agent prompts.
 * This is injected into downstream agent user prompts.
 */
export function formatClarificationsForPrompt(
  questions: ClarificationQuestion[],
  responses: ClarificationResponse[]
): string {
  if (responses.length === 0) return '';

  const lines: string[] = ['## User Clarifications (Confirmed by User)', ''];

  for (const response of responses) {
    const question = questions.find((q) => q.id === response.questionId);
    if (!question) continue;

    const selectedLabels = response.selectedValues
      .map((v) => {
        const opt = question.options.find((o) => o.value === v);
        return opt ? opt.label : v;
      })
      .join(', ');

    const answer = response.customAnswer || selectedLabels;
    if (answer) {
      // Map question IDs to human-readable labels
      const label = getQuestionLabel(question.id);
      lines.push(`- **${label}**: ${answer}`);
    }
  }

  if (lines.length <= 2) return ''; // No valid responses

  lines.push('');
  lines.push('IMPORTANT: Respect these user-confirmed choices. Do NOT add features or architecture');
  lines.push('that contradict these selections. If the user said "No authentication needed",');
  lines.push('do NOT include auth tables, endpoints, or middleware.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Get human-readable label for a question ID
 */
function getQuestionLabel(questionId: string): string {
  const labels: Record<string, string> = {
    'product-type': 'Product Type',
    'auth-method': 'Authentication Method',
    'auth-needed': 'Authentication',
    'tech-stack': 'Tech Stack',
    'key-features': 'Key Features',
    'database': 'Database',
  };
  return labels[questionId] || questionId;
}
