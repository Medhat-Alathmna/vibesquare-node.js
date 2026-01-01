import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { env } from '../../../config/env';
import {
  RawParsedDOM,
  RawDOMNode,
  StructuralAnalysis,
  DesignPromptResult,
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
const MAX_OUTPUT_TOKENS = 8192;  // Increased for complex JSON responses
const MAX_INPUT_CHARS = 80000;  // Increased for tree structure

// ============ System Prompt ============

const SYSTEM_PROMPT = `You are a Design Prompt Generator and Design Interpreter.

Your role is NOT to design or improve the UI.
Your role is to convert a structured design description into a FINAL, PROFESSIONAL PROMPT
that will be consumed by an AI Code Generator.

You must strictly follow these principles:

────────────────────────
CORE PHILOSOPHY
────────────────────────
- You describe INTENT, STRUCTURE, and VISUAL IDENTITY — not implementation details.
- You NEVER invent UI elements.
- You NEVER redesign, optimize, or suggest alternatives unless explicitly allowed.
- You preserve the user's wording, hierarchy, and priorities.
- The output prompt must be clear enough to be used as a benchmark.

────────────────────────
VISUAL IDENTITY RULES
────────────────────────
- Always extract and define a clear visual identity.
- Always define:
  - Primary color (default: #000000 )
  - Secondary color (if provided)
  - Accent color (if provided)
- Enforce color consistency across the entire prompt.
- If halftone, gradients, or retro effects are mentioned, describe them as OPTIONAL stylistic layers — never mandatory.

────────────────────────
IMAGE HANDLING & ENFORCEMENT
────────────────────────
  - You MUST explicitly include the exact image URL in the corresponding section.
  - You MUST associate each image with its intended role and approximate placement.
  - You MUST NOT modify, replace, infer, or generalize image sources.
  - You MUST NOT omit any provided image.
  - Just mention the image URL in the prompt.

────────────────────────
AMBIGUITY HANDLING (CRITICAL)
────────────────────────
If any of the following are unclear or implied but not explicit:
- Header behavior (fixed / floating / static)
- Card behavior (static / expandable / navigational)
- Animation type or trigger
- Image source (missing or non-http)
- Interactive behavior

You MUST:
1. Clearly describe what is observable or stated.
2. Insert a **USER QUESTION** inside the final prompt asking the AI Code Generator
   to confirm the missing decision with the end user.

Example format:
"⚠ User clarification required:
Ask the user whether the header should be fixed, floating, or static."


────────────────────────
ANIMATIONS
────────────────────────
- Allowed animations: fade, slide, reveal
- Only apply animations if explicitly mentioned or clearly implied
- If animation intent exists but details are unclear:
  → Ask the user via the AI Code Generator

────────────────────────
OUTPUT FORMAT
────────────────────────
- Output ONLY the final production-ready prompt
- Use clear sections, headings, and bullet points
- The result must be readable, deterministic, and professional

Your output will be used directly by an AI Code Generator.
`;


// ============ Main Interpret Function ============

export async function interpretDesign(
  parsed: RawParsedDOM,
  structural: StructuralAnalysis,
  model: LLMModel = DEFAULT_MODEL
): Promise<DesignPromptResultWithDebug> {
  const provider = getProvider(model);
  const summary = buildStructuredSummary(parsed, structural);

  // Check input size limit
  if (summary.length > MAX_INPUT_CHARS) {
    throw new ApiError(413, 'Page content too large for analysis. Please try a simpler page.');
  }

  if (provider === 'openai') {
    const result = await interpretWithOpenAI(summary, model as OpenAIModel);
    return { ...result, debugPrompt: summary };
  } else {
    const result = await interpretWithGemini(summary, model as GeminiModel);
    return { ...result, debugPrompt: summary };
  }
}

// ============ OpenAI Implementation ============

async function interpretWithOpenAI(
  summary: string,
  model: OpenAIModel
): Promise<DesignPromptResult> {
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
        { role: 'user', content: `Analyze this design and generate a production-ready prompt for the AI Code Generator:\n\n${summary}` }
      ],
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.6,
    });

    const text = response.choices[0]?.message?.content || '';

    return {
      finalPrompt: formatPromptResponse(text.trim()),
    };

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

export interface DesignPromptResultWithDebug extends DesignPromptResult {
  debugPrompt?: string;
}

// ============ Gemini Implementation ============

async function interpretWithGemini(
  summary: string,
  model: GeminiModel
): Promise<DesignPromptResult> {
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
      { text: `Analyze this design and generate a production-ready prompt for the AI Code Generator:\n\n${summary}` }
    ]);

    const response = result.response;
    const text = response.text();

    return {
      finalPrompt: formatPromptResponse(text.trim()),
    };

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

/**
 * Format prompt response to fix escape sequences
 * Converts literal \n, \t, etc. to actual characters
 */
function formatPromptResponse(prompt: string): string {
  if (!prompt) return prompt;

  return prompt
    // Convert literal \n to actual newlines
    .replace(/\\n/g, '\n')
    // Convert literal \t to actual tabs
    .replace(/\\t/g, '\t')
    // Convert literal \r to actual carriage returns
    .replace(/\\r/g, '\r')
    // Clean up any double escapes
    .replace(/\\\\/g, '\\');
}

/**
 * Build a hierarchical summary of the DOM tree for LLM interpretation
 * Uses CSS Deduplication and depth limiting for minimal token usage
 */
function buildStructuredSummary(parsed: RawParsedDOM, structural: StructuralAnalysis): string {
  // 1. Deduplicate CSS
  const { cssMap, optimizedNodes } = optimizeCSS(parsed.rootNodes);

  // 2. Prepare Data Structure
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
    forms: (parsed.allForms || []).map(f => ({ ...f, fields: (f.fields || []).map(field => `${field.name} (${field.type})`) })),
    nav: (parsed.navigation || []).map(n => n.text),
  };

  // 3. Serialize with JSON
  return JSON.stringify(context, null, 2);
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

// ============ Export ============

export const interpreter = {
  interpret: interpretDesign,
};

// Export all models for easy access
export const ALL_MODELS = [...GEMINI_MODELS, ...OPENAI_MODELS] as const;
