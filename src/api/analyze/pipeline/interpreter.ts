import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { env } from '../../../config/env';
import {
  RawParsedDOM,
  RawDOMNode,
  StructuralAnalysis,
  DesignInterpretation,
  AnimationType,
} from './ir.types';
import { ApiError } from '../../../shared/utils/ApiError';
import httpStatus from 'http-status';

// ============ Model Types ============

// Gemini models
export const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
] as const;

// OpenAI models
export const OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'o1',
  'o1-mini',
  'o1-preview',
] as const;

export type GeminiModel = typeof GEMINI_MODELS[number];
export type OpenAIModel = typeof OPENAI_MODELS[number];
export type LLMModel = GeminiModel | OpenAIModel;

// Provider detection
export type LLMProvider = 'gemini' | 'openai';

export function getProvider(model: LLMModel): LLMProvider {
  if (OPENAI_MODELS.includes(model as OpenAIModel)) {
    return 'openai';
  }
  return 'gemini';
}

export function isValidModel(model: string): model is LLMModel {
  return GEMINI_MODELS.includes(model as GeminiModel) ||
    OPENAI_MODELS.includes(model as OpenAIModel);
}

// Default model
const DEFAULT_MODEL: LLMModel = 'gemini-1.5-flash';

// Token limits
const MAX_OUTPUT_TOKENS = 2048;  // Increased for hierarchical output
const MAX_INPUT_CHARS = 80000;  // Increased for tree structure

// ============ System Prompt ============

const SYSTEM_PROMPT = `You are a Semantic DOM Interpreter.

You receive a HIERARCHICAL DOM TREE representation with full CSS properties.
Your task is to assign semantic ROLES to nodes based on visual behavior.

HTML tag names are NOT the source of truth.
The SOURCE OF TRUTH is:
1. CSS properties (position, display, background, z-index, etc.)
2. Visual behavior inferred from CSS
3. Layout structure (grid, flex, columns)
4. Content grouping patterns

CRITICAL RULES:
- NEVER classify nodes based only on tag name
- Use CSS properties to infer visual behavior
- Use the "order" field to identify nodes in your response
- Assign roles to SIGNIFICANT nodes only (containers with visual identity)
- Skip trivial nodes (empty divs, wrapper elements with no CSS)

NODE ROLE EXAMPLES:
- order 0: header (position: fixed, z-index high)
- order 5: hero (large padding, prominent background, contains CTA)
- order 12: features-grid (display: grid, contains cards)
- order 25: testimonials (contains quotes, avatar images)
- order 40: footer (bottom of page, contains links/copyright)

CSS INTERPRETATION RULES:
- position: fixed/sticky → likely Header / Nav / Overlay
- background-color or gradient → visual block identity
- z-index > 10 → layered importance
- display: grid/flex with multiple children → section with cards
- padding > 40px → major section boundary
- max-width with margin: auto → centered content container

OUTPUT REQUIREMENTS:
- Output ONLY valid JSON
- Include only SIGNIFICANT nodes (not every node)
- Each node interpretation must include:
  - nodeOrder (number matching the "order" field from input)
  - inferredRole (e.g. header, hero, features, testimonials, pricing, cta, footer)
  - confidence ("high" | "medium" | "low")
  - cssSignalsUsed (array of CSS properties that influenced the decision)
  - visualDescription (factual description based on CSS, not imagination)

Expected JSON structure:
{
  "nodes": [
    {
      "nodeOrder": 0,
      "inferredRole": "header",
      "confidence": "high",
      "cssSignalsUsed": ["position: fixed", "z-index: 1000"],
      "visualDescription": "Fixed navigation bar at top of page"
    },
    {
      "nodeOrder": 5,
      "inferredRole": "hero",
      "confidence": "high",
      "cssSignalsUsed": ["padding", "background", "height"],
      "visualDescription": "Large hero section with centered content"
    }
  ],
  "layoutIntent": "Marketing landing page with hero, features, and CTA",
  "hierarchy": "Header → Hero → Features → Testimonials → CTA → Footer",
  "emphasis": ["hero", "cta"],
  "suggestedAnimations": ["fade"],
  "responsiveHints": ["Grid collapses to single column on mobile"]
}

FINAL GOAL:
Produce semantic role assignments for significant visual nodes based on CSS behavior.`;


// ============ Main Interpret Function ============

export async function interpretDesign(
  parsed: RawParsedDOM,
  structural: StructuralAnalysis,
  model: LLMModel = DEFAULT_MODEL
): Promise<DesignInterpretation> {
  const provider = getProvider(model);
  const summary = buildStructuredSummary(parsed, structural);

  // Check input size limit
  if (summary.length > MAX_INPUT_CHARS) {
    throw new ApiError(413, 'Page content too large for analysis. Please try a simpler page.');
  }

  if (provider === 'openai') {
    return interpretWithOpenAI(summary, model as OpenAIModel);
  } else {
    return interpretWithGemini(summary, model as GeminiModel);
  }
}

// ============ OpenAI Implementation ============

async function interpretWithOpenAI(
  summary: string,
  model: OpenAIModel
): Promise<DesignInterpretation> {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'OpenAI API key not configured');
  }

  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this DOM tree and provide node interpretations:\n\n${summary}` }
      ],
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content || '';
    return parseInterpretationResponse(text);

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.message.includes('rate') || error.message.includes('quota')) {
        throw new ApiError(httpStatus.TOO_MANY_REQUESTS, 'OpenAI rate limit exceeded. Please try again later.');
      }
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Invalid OpenAI API key');
      }
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, `Design interpretation failed: ${error.message}`);
    }

    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Design interpretation failed');
  }
}

// ============ Gemini Implementation ============

async function interpretWithGemini(
  summary: string,
  model: GeminiModel
): Promise<DesignInterpretation> {
  if (!env.GOOGLE_AI_KEY) {
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Google AI API key not configured');
  }

  const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_KEY);
  const generativeModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });

  try {
    const result = await generativeModel.generateContent([
      { text: SYSTEM_PROMPT },
      { text: `Analyze this DOM tree and provide node interpretations:\n\n${summary}` }
    ]);

    const response = result.response;
    const text = response.text();

    return parseInterpretationResponse(text);

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('rate')) {
        throw new ApiError(httpStatus.TOO_MANY_REQUESTS, 'Gemini rate limit exceeded. Please try again later.');
      }
      if (error.message.includes('API key')) {
        throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Invalid Google AI API key');
      }
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, `Design interpretation failed: ${error.message}`);
    }

    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, 'Design interpretation failed');
  }
}

// ============ Helper Functions ============

import { encode } from '@toon-format/toon';

/**
 * Build a hierarchical summary of the DOM tree for LLM interpretation
 * Uses TOON format + CSS Deduplication for minimal token usage
 */
function buildStructuredSummary(parsed: RawParsedDOM, structural: StructuralAnalysis): string {
  // 1. Deduplicate CSS
  const { cssMap, optimizedNodes } = optimizeCSS(parsed.rootNodes);

  // 2. Prepare Data Structure for TOON
  const context = {
    metadata: {
      title: parsed.metadata.title,
      description: parsed.metadata.description?.slice(0, 200), // Truncate
      language: parsed.language,
    },
    structure: {
      nodeCount: structural.nodeCount,
      rootNodes: structural.rootNodeCount,
      maxDepth: structural.maxDepth,
      layout: structural.layoutType,
    },
    cssMap: cssMap,
    tree: optimizedNodes,
    // Add specific data arrays if relevant (flat lists for reference if needed)
    // but tree should cover most.
    forms: parsed.allForms.map(f => ({ ...f, fields: f.fields.map(field => `${field.name} (${field.type})`) })),
    nav: parsed.navigation.map(n => n.text),
  };

  // 3. Serialize with TOON
  return encode(context);
}

// Helper types for optimization
interface OptimizedNode {
  id: number;
  tag: string;
  css: number; // ID reference to CSS map
  txt?: string;
  img?: number; // count
  children?: OptimizedNode[];
}

function optimizeCSS(nodes: RawDOMNode[]): { cssMap: Record<number, any>, optimizedNodes: OptimizedNode[] } {
  const cssSignatureMap = new Map<string, number>();
  const cssIdMap: Record<number, any> = {};
  let nextCssId = 1;

  function getCssId(props: Record<string, string>): number {
    if (!props || Object.keys(props).length === 0) return 0;

    // Sort keys for deterministic signature
    const signature = JSON.stringify(Object.entries(props).sort((a, b) => a[0].localeCompare(b[0])));

    if (cssSignatureMap.has(signature)) {
      return cssSignatureMap.get(signature)!;
    }

    const id = nextCssId++;
    cssSignatureMap.set(signature, id);
    cssIdMap[id] = props;
    return id;
  }

  function transformNode(node: RawDOMNode): OptimizedNode {
    const optimized: OptimizedNode = {
      id: node.order,
      tag: node.tag,
      css: getCssId(node.cssProperties),
    };

    if (node.textContent && node.textContent.length > 0) {
      optimized.txt = node.textContent.slice(0, 50).replace(/\s+/g, ' ');
    }

    if (node.images && node.images.length > 0) {
      optimized.img = node.images.length;
    }

    if (node.children && node.children.length > 0) {
      optimized.children = node.children.map(transformNode);
    }

    return optimized;
  }

  const optimizedNodes = nodes.map(transformNode);

  return {
    cssMap: cssIdMap,
    optimizedNodes
  };
}

/**
 * Parse LLM response into DesignInterpretation
 */
function parseInterpretationResponse(text: string): DesignInterpretation {
  // Try to extract JSON from response
  let jsonStr = text.trim();

  // Handle markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
      throw new Error('Missing or invalid "nodes" array in LLM response');
    }
    if (!parsed.layoutIntent || !parsed.hierarchy) {
      throw new Error('Missing required fields (layoutIntent, hierarchy) in LLM response');
    }

    // Parse nodes with validation
    const nodes = parsed.nodes.map((n: any, i: number) => {
      if (!n.inferredRole || !n.confidence || !n.visualDescription || n.nodeOrder === undefined) {
        throw new Error(`Node ${i} missing required fields: ${JSON.stringify(n)}`);
      }
      return {
        nodeOrder: Number(n.nodeOrder) || 0,
        inferredRole: String(n.inferredRole || 'unknown'),
        confidence: (n.confidence === 'high' || n.confidence === 'medium' || n.confidence === 'low')
          ? n.confidence
          : 'low',
        cssSignalsUsed: Array.isArray(n.cssSignalsUsed) ? n.cssSignalsUsed.map(String) : [],
        visualDescription: String(n.visualDescription || 'No description provided'),
      };
    });

    // Validate and sanitize animations
    const validAnimations: AnimationType[] = ['fade', 'slide', 'reveal'];
    const suggestedAnimations = (parsed.suggestedAnimations || [])
      .filter((a: string) => validAnimations.includes(a as AnimationType)) as AnimationType[];

    return {
      nodes,
      layoutIntent: String(parsed.layoutIntent),
      hierarchy: String(parsed.hierarchy),
      emphasis: Array.isArray(parsed.emphasis) ? parsed.emphasis.map(String) : [],
      suggestedAnimations,
      responsiveHints: Array.isArray(parsed.responsiveHints) ? parsed.responsiveHints.map(String) : [],
    };

  } catch (error) {
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE,
      `Failed to interpret design: Invalid LLM response - ${error instanceof Error ? error.message : 'Parse error'}`);
  }
}

// ============ Export ============

export const interpreter = {
  interpret: interpretDesign,
};

// Export all models for easy access
export const ALL_MODELS = [...GEMINI_MODELS, ...OPENAI_MODELS] as const;
