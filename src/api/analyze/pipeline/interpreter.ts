import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { env } from '../../../config/env';
import { ParsedDOM, StructuralAnalysis, DesignInterpretation, AnimationType } from './ir.types';
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
const MAX_OUTPUT_TOKENS = 1024;
const MAX_INPUT_CHARS = 50000; // ~12,500 tokens

// ============ System Prompt ============

const SYSTEM_PROMPT = `You are a Design Interpreter. Your role is to analyze HTML structure and describe the design intent.

CRITICAL RULES:
1. NEVER invent or assume UI elements that are not explicitly present in the data
2. NEVER suggest redesigns or improvements
3. ONLY describe what EXISTS in the provided structure
4. Be conservative with animation suggestions - only fade, slide, reveal
5. Focus on layout intent, visual hierarchy, and emphasis

You will receive:
- Structural analysis (sections, layout type, etc.)
- Page metadata (title, description)
- Navigation structure
- Forms summary
- CTA information
- Color palette
- Typography information

Respond ONLY in valid JSON format with this exact structure:
{
  "layoutIntent": "Brief description of the overall layout purpose",
  "hierarchy": "Description of visual hierarchy and content flow",
  "emphasis": ["Array of emphasized elements/sections"],
  "suggestedAnimations": ["fade" | "slide" | "reveal"],
  "responsiveHints": ["Array of responsive design considerations"]
}`;

// ============ Main Interpret Function ============

export async function interpretDesign(
  parsed: ParsedDOM,
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
        { role: 'user', content: `Analyze this page structure and provide design interpretation:\n\n${summary}` }
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
      { text: `Analyze this page structure and provide design interpretation:\n\n${summary}` }
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

function buildStructuredSummary(parsed: ParsedDOM, structural: StructuralAnalysis): string {
  const lines: string[] = [];

  // Page metadata
  lines.push('## Page Metadata');
  lines.push(`- Title: ${parsed.metadata.title || 'N/A'}`);
  lines.push(`- Description: ${parsed.metadata.description || 'N/A'}`);
  lines.push(`- Language: ${parsed.language}`);
  lines.push('');

  // Structural analysis
  lines.push('## Structural Analysis');
  lines.push(`- Section Count: ${structural.sectionCount}`);
  lines.push(`- Layout Type: ${structural.layoutType}`);
  lines.push(`- Has Hero: ${structural.hasHero}`);
  lines.push(`- Has Navigation: ${structural.hasNavigation}`);
  lines.push(`- Has Footer: ${structural.hasFooter}`);
  lines.push(`- Card Sections: ${structural.cardSections}`);
  lines.push(`- Content Density: ${structural.contentDensity}`);
  lines.push('');

  // Sections
  lines.push('## Sections');
  parsed.sections.forEach((section, i) => {
    lines.push(`${i + 1}. [${section.tag}] ${section.id || section.className || 'unnamed'}`);
    lines.push(`   - Children: ${section.childCount}, Has Images: ${section.hasImages}, Has Forms: ${section.hasForms}`);
    if (section.textContent) {
      lines.push(`   - Preview: "${section.textContent.slice(0, 100)}..."`);
    }
  });
  lines.push('');

  // Navigation
  if (parsed.navigation.length > 0) {
    lines.push('## Navigation');
    parsed.navigation.forEach(item => {
      lines.push(`- ${item.text}${item.isButton ? ' [BUTTON]' : ''}`);
      if (item.children.length > 0) {
        item.children.forEach(child => lines.push(`  - ${child.text}`));
      }
    });
    lines.push('');
  }

  // CTAs
  if (parsed.ctas.length > 0) {
    lines.push('## Call-to-Actions');
    parsed.ctas.forEach(cta => {
      lines.push(`- "${cta.text}" [${cta.type}] in ${cta.location}`);
    });
    lines.push('');
  }

  // Forms
  if (parsed.forms.length > 0) {
    lines.push('## Forms');
    parsed.forms.forEach((form, i) => {
      lines.push(`Form ${i + 1}: ${form.fields.length} fields`);
      form.fields.forEach(field => {
        lines.push(`  - ${field.label || field.name}: ${field.type}${field.required ? ' (required)' : ''}`);
      });
      if (form.submitButtonText) {
        lines.push(`  - Submit: "${form.submitButtonText}"`);
      }
    });
    lines.push('');
  }

  // Colors
  if (parsed.colors.length > 0) {
    lines.push('## Color Palette');
    const topColors = parsed.colors.slice(0, 5);
    topColors.forEach(color => {
      lines.push(`- ${color.value} (${color.property})`);
    });
    lines.push('');
  }

  // Fonts
  if (parsed.fonts.length > 0) {
    lines.push('## Typography');
    parsed.fonts.forEach(font => {
      lines.push(`- ${font.family} (${font.source})`);
    });
    lines.push('');
  }

  // Footer
  if (parsed.footer) {
    lines.push('## Footer');
    lines.push(`- Columns: ${parsed.footer.columns.length}`);
    if (parsed.footer.copyright) {
      lines.push(`- Copyright: ${parsed.footer.copyright}`);
    }
    if (parsed.footer.socialLinks.length > 0) {
      lines.push(`- Social Links: ${parsed.footer.socialLinks.map(s => s.platform).join(', ')}`);
    }
    lines.push('');
  }

  // Embeds
  if (parsed.embeds.length > 0) {
    lines.push('## Embedded Content');
    parsed.embeds.forEach(embed => {
      lines.push(`- ${embed.type}${embed.platform ? ` (${embed.platform})` : ''}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

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
    if (!parsed.layoutIntent || !parsed.hierarchy) {
      throw new Error('Missing required fields in LLM response');
    }

    // Validate and sanitize animations
    const validAnimations: AnimationType[] = ['fade', 'slide', 'reveal'];
    const suggestedAnimations = (parsed.suggestedAnimations || [])
      .filter((a: string) => validAnimations.includes(a as AnimationType)) as AnimationType[];

    return {
      layoutIntent: String(parsed.layoutIntent),
      hierarchy: String(parsed.hierarchy),
      emphasis: Array.isArray(parsed.emphasis) ? parsed.emphasis.map(String) : [],
      suggestedAnimations,
      responsiveHints: Array.isArray(parsed.responsiveHints) ? parsed.responsiveHints.map(String) : [],
    };

  } catch (error) {
    // Throw error instead of returning fallback values
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
