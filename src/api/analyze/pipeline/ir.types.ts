// Intermediate Representation Types for Vibe Square Pipeline

// ============ Fetch Types ============
export interface FetchResult {
  html: string;
  finalUrl: string;
  statusCode: number;
  contentLength: number;
}

// ============ Parser Types ============
export interface ParsedSection {
  tag: string;
  id?: string;
  className?: string;
  textContent: string;
  childCount: number;
  hasImages: boolean;
  hasForms: boolean;
  order: number;
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

export interface ParsedDOM {
  sections: ParsedSection[];
  navigation: NavItem[];
  forms: FormInfo[];
  images: ImageInfo[];
  colors: ColorInfo[];
  fonts: FontInfo[];
  ctas: CTAInfo[];
  footer: FooterInfo | null;
  socialLinks: SocialLink[];
  embeds: EmbedInfo[];
  metadata: PageMetadata;
  language: string;
  rawTextContent: string;
  cssInfo: CSSInfo;
}

// ============ Analyzer Types ============
export type LayoutType = 'single-column' | 'two-column' | 'grid' | 'mixed';
export type ContentDensity = 'low' | 'medium' | 'high';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface StructuralAnalysis {
  sectionCount: number;
  layoutType: LayoutType;
  hasHero: boolean;
  hasNavigation: boolean;
  hasFooter: boolean;
  cardSections: number;
  contentDensity: ContentDensity;
  difficulty: Difficulty;
  difficultyReason: string;
}

// ============ Interpreter Types ============
export type AnimationType = 'fade' | 'slide' | 'reveal';

export interface DesignInterpretation {
  layoutIntent: string;
  hierarchy: string;
  emphasis: string[];
  suggestedAnimations: AnimationType[];
  responsiveHints: string[];
}

// ============ IR (Intermediate Representation) ============
export interface IRSection {
  order: number;
  type: string; // hero, features, testimonials, pricing, cta, etc.
  description: string;
  hasCards: boolean;
  cardCount?: number;
  layout: LayoutType;
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
  position: 'top' | 'side' | 'bottom';
  style: 'fixed' | 'sticky' | 'static';
  items: NavItem[];
  hasMobileMenu?: boolean; // Only set if detected in HTML
}

export interface MotionIntent {
  element: string;
  animation: AnimationType;
  trigger: 'load' | 'scroll' | 'hover';
}

export interface IntermediateRepresentation {
  sourceUrl: string;
  sections: IRSection[];
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
    sectionsFound: number;
    layoutType: LayoutType;
    difficulty: Difficulty;
    language: string;
    processingTimeMs: number;
  };
}
