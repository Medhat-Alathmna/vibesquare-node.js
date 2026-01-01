// Intermediate Representation Types for Vibe Square Pipeline

// ============ Constants ============
export const MAX_DOM_DEPTH = 20;

// ============ Fetch Types ============
export interface FetchResult {
  html: string;
  finalUrl: string;
  statusCode: number;
  contentLength: number;
}

// ============ Parser Types ============

/**
 * Raw DOM Node - No semantic interpretation
 * Preserves full hierarchy and CSS properties
 *
 * CRITICAL RULES:
 * - NO classification (no sections, headers, heroes, nav, footer)
 * - NO semantic inference
 * - NO CSS filtering
 * - HTML + CSS are the ONLY source of truth
 */
export interface RawDOMNode {
  // Identity
  tag: string;
  order: number;              // Explicit DOM order (global counter)
  id?: string;                // HTML id attribute
  className?: string;         // Full class string
  attributes?: Record<string, string>;  // All HTML attributes

  // Hierarchy
  depth: number;              // Current depth level (0 = root)
  isContainer: boolean;       // Has child elements
  children: RawDOMNode[];     // Full nested children (max depth: 20)

  // Content
  textContent: string;        // Full text content (not truncated)

  // CSS (NO FILTERING - classes + inline merged)
  cssProperties: Record<string, string>;  // ALL properties merged

  // Media
  images: ImageInfo[];        // Images in this node (src, data-src)
}

export interface NavItem {
  text: string;
  href?: string;
  isButton: boolean;
  children: NavItem[];
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // for select/radio
}

export interface FormInfo {
  id?: string;
  action?: string;
  method: string;
  fields: FormField[];
  submitButtonText?: string;
}

export interface ImageInfo {
  url: string;
  alt?: string;
}

export interface ColorInfo {
  value: string;
  property: string; // background-color, color, border-color
  frequency: number;
}

export interface FontInfo {
  family: string;
  source: 'google' | 'system' | 'custom';
  url?: string;
}

export interface CTAInfo {
  text: string;
  href?: string;
  type: 'primary' | 'secondary' | 'link';
  location: string; // hero, header, section, footer
}

export interface FooterColumn {
  heading?: string;
  links: { text: string; href?: string }[];
}

export interface FooterInfo {
  columns: FooterColumn[];
  copyright?: string;
  socialLinks: SocialLink[];
}

export interface SocialLink {
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'github' | 'tiktok' | 'other';
  url: string;
}

export interface EmbedInfo {
  type: 'video' | 'map' | 'widget' | 'unknown';
  platform?: string; // youtube, vimeo, google-maps
  url?: string;
}

export interface PageMetadata {
  title?: string;
  description?: string;
  ogTags: Record<string, string>;
  favicon?: string;
}

export interface CSSClassInfo {
  className: string;
  properties: Record<string, string>; // property: value pairs
  mediaQuery?: string; // e.g., '@media (max-width: 768px)'
}

/**
 * CSS Value Dictionary for token compression
 * Maps short IDs to repeated CSS values
 * Prefixes: c=colors, d=display, p=position, s=spacing, v=other
 */
export interface CSSValueDictionary {
  values: Record<string, string>;  // { "c1": "#ffffff", "d1": "flex" }
}

export interface CSSInfo {
  gridColumns: number | undefined;
  flexColumns: number | undefined;
  breakpoints: string[];
  hasResponsiveGrid: boolean;
  classes: CSSClassInfo[]; // Extracted CSS classes with their properties
}

/**
 * Raw Parsed DOM - Full hierarchical DOM representation
 * No semantic interpretation - consumed by LLM for role assignment
 */
export interface RawParsedDOM {
  // Full DOM tree
  rootNodes: RawDOMNode[];    // Top-level nodes (body children)
  totalNodes: number;         // Total count of all nodes

  // Global data (for convenience)
  allImages: ImageInfo[];
  allForms: FormInfo[];
  navigation: NavItem[];
  fonts: FontInfo[];
  colors: ColorInfo[];
  ctas: CTAInfo[];
  footer: FooterInfo | null;
  socialLinks: SocialLink[];
  embeds: EmbedInfo[];

  // Metadata
  metadata: PageMetadata;
  language: string;
  rawTextContent: string;

  // Raw CSS classes
  cssInfo: CSSInfo;
}

// ============ Analyzer Types ============
export type LayoutType = 'single-column' | 'two-column' | 'grid' | 'mixed';
export type ContentDensity = 'low' | 'medium' | 'high';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface StructuralAnalysis {
  nodeCount: number;         // Total nodes in tree
  rootNodeCount: number;     // Top-level nodes
  maxDepth: number;          // Deepest nesting level
  layoutType: LayoutType;
  hasNavigation: boolean;
  hasFooter: boolean;
  contentDensity: ContentDensity;
  difficulty: Difficulty;
  difficultyReason: string;
}

// ============ Interpreter Types ============

/**
 * Design Prompt Result - Direct LLM output
 * The LLM generates a production-ready prompt for AI Code Generator
 */
export interface DesignPromptResult {
  finalPrompt: string;      // The production-ready prompt for AI Code Generator
}

// ============ IR (Intermediate Representation) ============
export interface IRNode {
  order: number;
  tag: string;
  type: string; // hero, features, testimonials, pricing, cta, etc. (from LLM)
  description: string;
  cssProperties: Record<string, string>; // Preserved CSS for final prompt
  depth: number;
  isContainer: boolean;
  childCount: number;
  roleConfidence: "high" | "medium" | "low";  // From LLM interpretation
  images: ImageInfo[];  // Images in this node
}

export interface LayoutInfo {
  type: LayoutType;
  maxWidth?: string;
  hasGrid: boolean;
  columnCount?: number;
}

export interface ComponentInfo {
  type: string;
  description: string;
  location: string;
}

export interface NavigationInfo {
  position: 'top' | 'side' | 'bottom' | null;  // null = cannot determine from HTML alone
  style: 'fixed' | 'sticky' | 'static' | null;  // null = cannot determine from HTML alone
  items: NavItem[];
  hasMobileMenu?: boolean; // Only set if detected in HTML
}

export interface MotionIntent {
  element: string;
  animation: 'fade' | 'slide' | 'reveal';
  trigger: 'load' | 'scroll' | 'hover' | null;  // null = cannot determine from HTML alone
}

export interface IntermediateRepresentation {
  sourceUrl: string;
  nodes: IRNode[];           // Flattened nodes with LLM interpretations
  layout: LayoutInfo;
  components: ComponentInfo[];
  navigation: NavigationInfo | null;
  forms: FormInfo[];
  ctas: CTAInfo[];
  footer: FooterInfo | null;
  embeds: EmbedInfo[];
  colors: ColorInfo[];
  fonts: FontInfo[];
  motionIntent: MotionIntent[];
  cssValueDictionary?: CSSValueDictionary; // Dictionary for compressed CSS values
  metadata: {
    title: string;
    description: string;
    ogTags: Record<string, string>;
    language: string;
    difficulty: Difficulty;
    difficultyReason: string;
  };
}

// ============ Final Output Types ============
export interface AnalysisResult {
  prompt?: string; // Optional: generated prompt (if interpreter is used)
  metadata: {
    finalParsedDOM?: RawParsedDOM | any; // Optional: full parsed DOM for debugging
    sourceUrl: string;
    nodesFound: number;
    layoutType: LayoutType;
    difficulty: Difficulty;
    language: string;
    processingTimeMs: number;
  };
}

// ============ Enhanced Parser Types ============

/**
 * Layout Signals - Attached to each EnhancedRawDOMNode
 * Captures positioning, layering, spacing, and layout role
 */
export interface LayoutSignals {
  // Positioning
  positionType: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';

  // Layering
  layering: {
    zIndex: number;
    isOverlay: boolean;      // z-index > 100
    hasBackdrop: boolean;    // backdrop-filter present
  };

  // Spacing Metrics
  spacing: {
    padding: string | null;
    margin: string | null;
    gap: string | null;
    width: string | null;
    height: string | null;
  };

  // Layout Role (determined from display property)
  layoutRole: 'container' | 'grid' | 'flex-row' | 'flex-column' | 'absolute-positioned' | 'inline';
  gridColumns?: number;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';

  // Visual Effects
  hasElevation: boolean;     // box-shadow present
  hasTransform: boolean;     // transform present
  opacity?: number;
}

/**
 * Visual Section Detection Metadata
 * Multi-factor scoring to identify visual sections
 */
export interface VisualSectionMeta {
  // Background Analysis
  hasBackgroundColor: boolean;
  hasBackgroundImage: boolean;
  backgroundValue?: string;

  // Section Detection
  isSectionCandidate: boolean;  // sectionScore >= 40
  sectionScore: number;          // 0-100 confidence

  // Hierarchy Indicators
  visualDepth: number;
  containsNestedSections: boolean;
}

/**
 * Enhanced Image with Mock Detection
 * Marks images that require placeholder generation
 */
export interface EnhancedImageInfo extends ImageInfo {
  mockRequired: boolean;         // True if src is non-http or missing
  srcType: 'http' | 'data-uri' | 'relative' | 'missing';
}

/**
 * Enhanced DOM Node with Layout and Visual Signals
 * Extends RawDOMNode with rich metadata for LLM consumption
 */
export interface EnhancedRawDOMNode extends Omit<RawDOMNode, 'images' | 'children'> {
  // Layout and visual signals
  layoutSignals: LayoutSignals;
  visualMeta: VisualSectionMeta;

  // Enhanced images with mock detection
  images: EnhancedImageInfo[];

  // CSS reference (for deduplication)
  cssRef?: string;  // Reference to sharedCSSProperties key

  // Recursive children
  children: EnhancedRawDOMNode[];
}

/**
 * Enhanced Parsed DOM - Full hierarchical representation with visual signals
 * Designed to be sent AS-IS to LLM for semantic interpretation
 */
export interface EnhancedParsedDOM extends Omit<RawParsedDOM, 'rootNodes' | 'allImages'> {
  // Enhanced DOM tree
  rootNodes: EnhancedRawDOMNode[];

  // Enhanced images with mock detection
  allImages: EnhancedImageInfo[];

  // CSS normalization (shared patterns for deduplication)
  sharedCSSProperties?: Record<string, Record<string, string>>;  // cssRef -> properties

  // Visual section summary
  visualSectionCount: number;
  maxVisualDepth: number;
}

// ============ Visual ParsedDOM Types (V2 - Complete Redesign) ============

/**
 * Visual Role - Inferred from CSS and structure, NOT from HTML tags
 */
export type VisualRole =
  | 'header'      // Top navigation/branding area
  | 'hero'        // Large visual impact section (usually first)
  | 'section'     // Generic visual grouping
  | 'footer'      // Bottom area with links/info
  | 'nav'         // Navigation container
  | 'card'        // Repeated visual unit
  | 'layout'      // Pure layout wrapper (grid/flex container)
  | 'content'     // Text/media content block
  | 'unknown';    // Cannot determine role

/**
 * Layout Intent - How children are arranged
 */
export type LayoutIntent =
  | 'row'         // Horizontal arrangement
  | 'column'      // Vertical arrangement
  | 'grid'        // Grid arrangement
  | 'stack'       // Overlapping elements
  | 'overlay'     // Positioned on top of others
  | 'unknown';

/**
 * CSS Signals - Summarized visual CSS, NOT raw properties
 */
export interface CSSSignals {
  position: 'static' | 'fixed' | 'sticky' | 'absolute' | 'unknown';
  layout: 'flex' | 'grid' | 'block' | 'unknown';
  dominantColors: string[];       // Max 3 colors
  emphasis: ('background' | 'shadow' | 'blur' | 'contrast' | 'border')[];
}

/**
 * Visual Node - Core building block of visualTree
 * Represents a visually meaningful element
 */
export interface VisualNode {
  id: string;                     // Unique identifier (v-0, v-1, v-1-0...)
  role: VisualRole;               // Inferred visual role
  tag: string;                    // Original HTML tag
  order: number;                  // Visual order (top → bottom)
  depth: number;                  // Visual depth (not DOM depth)
  layoutIntent: LayoutIntent;     // How children are arranged
  isContainer: boolean;           // Groups children visually
  visualPurpose: string;          // Human explanation of why this block exists
  textContent?: string;           // Direct text (if meaningful, truncated)
  cssSignals: CSSSignals;         // Summarized visual CSS
  children: VisualNode[];         // Nested visual nodes
}

/**
 * Image Asset - Contextual image information
 */
export interface ImageAsset {
  id: string;                     // Reference id
  context: 'hero' | 'card' | 'background' | 'icon' | 'avatar' | 'logo' | 'unknown';
  source: 'http' | 'local' | 'missing';
  url?: string;                   // Only if source is 'http'
  hint: string;                   // Human description of expected content
  parentNodeId?: string;          // Which visual node contains this
}

/**
 * Form Asset - Simplified form representation
 */
export interface FormAsset {
  id: string;
  purpose: 'contact' | 'newsletter' | 'login' | 'search' | 'checkout' | 'unknown';
  fieldCount: number;
  hasSubmit: boolean;
  parentNodeId?: string;
}

/**
 * Ambiguity - Questions for user clarification
 */
export interface Ambiguity {
  nodeId: string;                 // Which node has the ambiguity
  questionForUser: string;        // Clear question
  reason: string;                 // Why this is ambiguous
}

/**
 * Visual Identity - Inferred design characteristics
 */
export interface VisualIdentity {
  tone: 'corporate' | 'modern' | 'playful' | 'minimal' | 'bold' | 'unknown';
  density: 'compact' | 'balanced' | 'spacious';
  contrast: 'low' | 'medium' | 'high';
}

/**
 * Design Signals - High-level design observations
 */
export interface DesignSignals {
  visualIdentity: VisualIdentity;
  ambiguities: Ambiguity[];
}

/**
 * Meta - Minimal page metadata
 */
export interface VisualParsedDOMMeta {
  sourceUrl: string;
  title: string;
  language: string;
}

/**
 * Assets - All extracted assets
 */
export interface VisualParsedDOMAssets {
  images: ImageAsset[];
  forms: FormAsset[];
}

/**
 * Visual ParsedDOM - Complete redesigned output
 *
 * DESIGN PRINCIPLES:
 * 1. visualTree reflects VISUAL hierarchy, not DOM hierarchy
 * 2. Meaningless wrappers are collapsed
 * 3. Roles are inferred from CSS + structure, not tags
 * 4. CSS is summarized, not dumped
 * 5. Self-explanatory: another LLM can understand without seeing HTML
 */
export interface VisualParsedDOM {
  meta: VisualParsedDOMMeta;
  visualTree: VisualNode[];       // Root-level visual nodes
  assets: VisualParsedDOMAssets;
  designSignals: DesignSignals;
}
