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
export type AnimationType = 'fade' | 'slide' | 'reveal';

/**
 * Node Interpretation - LLM assigns roles to RawDOMNodes
 */
export interface NodeInterpretation {
  nodeOrder: number;         // Maps to RawDOMNode.order
  inferredRole: string;      // "hero", "features", "pricing", "unknown", etc.
  confidence: "high" | "medium" | "low";
  cssSignalsUsed: string[];  // CSS properties that influenced the decision
  visualDescription: string; // Based on layout + CSS, not imagination
}

export interface DesignInterpretation {
  nodes: NodeInterpretation[];  // Per-node analysis
  layoutIntent: string;
  hierarchy: string;
  emphasis: string[];
  suggestedAnimations: AnimationType[];
  responsiveHints: string[];
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
  animation: AnimationType;
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
  prompt: string;
  ir: IntermediateRepresentation;
  metadata: {
    sourceUrl: string;
    nodesFound: number;
    layoutType: LayoutType;
    difficulty: Difficulty;
    language: string;
    processingTimeMs: number;
  };
}
