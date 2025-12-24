import {
  IntermediateRepresentation,
  ParsedDOM,
  StructuralAnalysis,
  DesignInterpretation,
  IRSection,
  LayoutInfo,
  ComponentInfo,
  NavigationInfo,
  MotionIntent,
} from './ir.types';

/**
 * Synthesizer - Converts IR to final professional prompt
 * Output: Markdown + JSON Schema format
 * Tone: Confident, Directive, Instructional
 * Audience: AI Code Generators only
 */

export function buildIntermediateRepresentation(
  sourceUrl: string,
  parsed: ParsedDOM,
  structural: StructuralAnalysis,
  interpretation: DesignInterpretation
): IntermediateRepresentation {
  // Build IR sections from parsed sections
  const sections: IRSection[] = parsed.sections.map((section, index) => ({
    order: index + 1,
    type: detectSectionType(section.className, section.id, section.tag, index),
    description: section.textContent.slice(0, 200),
    hasCards: section.className?.toLowerCase().includes('card') || section.childCount >= 3,
    cardCount: section.childCount >= 3 ? section.childCount : undefined,
    layout: structural.layoutType,
  }));

  // Build layout info - use actual CSS data when available
  const layout: LayoutInfo = {
    type: structural.layoutType,
    hasGrid: structural.layoutType === 'grid',
    columnCount: parsed.cssInfo.gridColumns || parsed.cssInfo.flexColumns ||
                 (structural.layoutType === 'two-column' ? 2 :
                  structural.layoutType === 'single-column' ? 1 : undefined),
  };

  // Build components
  const components: ComponentInfo[] = [];
  if (structural.hasHero) {
    components.push({ type: 'hero', description: 'Hero section with headline and CTA', location: 'top' });
  }
  if (parsed.forms.length > 0) {
    components.push({ type: 'form', description: `${parsed.forms.length} form(s) with ${parsed.forms.reduce((a, f) => a + f.fields.length, 0)} total fields`, location: 'various' });
  }
  if (structural.cardSections > 0) {
    components.push({ type: 'card-grid', description: `${structural.cardSections} card-based section(s)`, location: 'various' });
  }

  // Build navigation info - don't assume mobile menu exists
  const navigation: NavigationInfo | null = parsed.navigation.length > 0 ? {
    position: 'top',
    style: 'fixed',
    items: parsed.navigation,
    // hasMobileMenu omitted - cannot determine from HTML alone
  } : null;

  // Build motion intents from interpretation
  const motionIntent: MotionIntent[] = interpretation.suggestedAnimations.map(anim => ({
    element: 'sections',
    animation: anim,
    trigger: anim === 'fade' ? 'load' : 'scroll',
  }));

  return {
    sourceUrl,
    sections,
    layout,
    components,
    navigation,
    forms: parsed.forms,
    ctas: parsed.ctas,
    footer: parsed.footer,
    embeds: parsed.embeds,
    colors: parsed.colors,
    fonts: parsed.fonts,
    motionIntent,
    metadata: {
      title: parsed.metadata.title || '',
      description: parsed.metadata.description || '',
      ogTags: parsed.metadata.ogTags,
      language: parsed.language,
      difficulty: structural.difficulty,
      difficultyReason: structural.difficultyReason,
    },
  };
}

function detectSectionType(
  className: string | undefined,
  id: string | undefined,
  tag: string,
  index: number
): string {
  const combined = ((className || '') + ' ' + (id || '')).toLowerCase();

  if (index === 0 || combined.includes('hero') || combined.includes('banner')) return 'hero';
  if (combined.includes('feature')) return 'features';
  if (combined.includes('service')) return 'services';
  if (combined.includes('about')) return 'about';
  if (combined.includes('testimonial') || combined.includes('review')) return 'testimonials';
  if (combined.includes('pricing') || combined.includes('plan')) return 'pricing';
  if (combined.includes('team')) return 'team';
  if (combined.includes('contact')) return 'contact';
  if (combined.includes('faq')) return 'faq';
  if (combined.includes('cta') || combined.includes('call-to-action')) return 'cta';
  if (combined.includes('blog') || combined.includes('post')) return 'blog';
  if (combined.includes('gallery') || combined.includes('portfolio')) return 'gallery';
  if (tag === 'header') return 'header';
  if (tag === 'footer') return 'footer';
  if (tag === 'nav') return 'navigation';

  return 'content';
}

export function synthesizePrompt(ir: IntermediateRepresentation): string {
  const lines: string[] = [];

  // Title
  lines.push('# Landing Page Recreation Prompt');
  lines.push('');

  // Metadata section
  lines.push('## Metadata');
  lines.push(`- **Source URL**: ${ir.sourceUrl}`);
  lines.push(`- **Page Title**: ${ir.metadata.title || 'Untitled'}`);
  lines.push(`- **Language**: ${ir.metadata.language.toUpperCase()}`);
  lines.push(`- **Difficulty**: ${ir.metadata.difficulty.toUpperCase()} - ${ir.metadata.difficultyReason}`);
  lines.push('');

  // Page description
  if (ir.metadata.description) {
    lines.push('## Page Description');
    lines.push(ir.metadata.description);
    lines.push('');
  }

  // Page structure overview
  lines.push('## Page Structure Overview');
  lines.push(`This landing page uses a **${ir.layout.type}** layout with **${ir.sections.length}** distinct sections.`);
  lines.push('');

  // Sections detail
  lines.push('## Sections');
  lines.push('Build the following sections in order:');
  lines.push('');

  ir.sections.forEach((section, index) => {
    lines.push(`### ${index + 1}. ${capitalizeFirst(section.type)} Section`);
    if (section.description) {
      lines.push(`Content preview: "${section.description.slice(0, 100)}..."`);
    }
    if (section.hasCards && section.cardCount) {
      lines.push(`- Contains a grid of **${section.cardCount}** cards`);
    }
    lines.push(`- Layout: ${section.layout}`);
    lines.push('');
  });

  // Navigation
  if (ir.navigation) {
    lines.push('## Navigation');
    lines.push(`Position: **${ir.navigation.position}**, Style: **${ir.navigation.style}**`);
    lines.push('');
    lines.push('Menu items:');
    ir.navigation.items.forEach(item => {
      const buttonMark = item.isButton ? ' `[BUTTON]`' : '';
      lines.push(`- ${item.text}${buttonMark}`);
      if (item.children.length > 0) {
        item.children.forEach(child => lines.push(`  - ${child.text}`));
      }
    });
    lines.push('');
  }

  // CTAs
  if (ir.ctas.length > 0) {
    lines.push('## Call-to-Action Buttons');
    ir.ctas.forEach(cta => {
      lines.push(`- **"${cta.text}"** - ${cta.type} button in ${cta.location}`);
    });
    lines.push('');
  }

  // Forms
  if (ir.forms.length > 0) {
    lines.push('## Forms');
    ir.forms.forEach((form, i) => {
      lines.push(`### Form ${i + 1}`);
      lines.push(`Method: ${form.method.toUpperCase()}`);
      lines.push('');
      lines.push('Fields:');
      form.fields.forEach(field => {
        const required = field.required ? ' *(required)*' : '';
        lines.push(`- **${field.label || field.name}**: \`${field.type}\`${required}`);
        if (field.placeholder) {
          lines.push(`  - Placeholder: "${field.placeholder}"`);
        }
        if (field.options && field.options.length > 0) {
          lines.push(`  - Options: ${field.options.join(', ')}`);
        }
      });
      if (form.submitButtonText) {
        lines.push(`- Submit button text: **"${form.submitButtonText}"**`);
      }
      lines.push('');
    });
  }

  // Footer
  if (ir.footer) {
    lines.push('## Footer');
    if (ir.footer.columns.length > 0) {
      lines.push(`Structure: **${ir.footer.columns.length} columns**`);
      lines.push('');
      ir.footer.columns.forEach((col, i) => {
        lines.push(`Column ${i + 1}${col.heading ? ` - "${col.heading}"` : ''}:`);
        col.links.forEach(link => lines.push(`  - ${link.text}`));
      });
      lines.push('');
    }
    if (ir.footer.socialLinks.length > 0) {
      lines.push('Social links: ' + ir.footer.socialLinks.map(s => capitalizeFirst(s.platform)).join(', '));
      lines.push('');
    }
    if (ir.footer.copyright) {
      lines.push(`Copyright: ${ir.footer.copyright}`);
      lines.push('');
    }
  }

  // Design Details
  lines.push('## Design Details');
  lines.push('');

  // Colors
  if (ir.colors.length > 0) {
    lines.push('### Color Palette');
    const topColors = ir.colors.slice(0, 6);
    topColors.forEach(color => {
      lines.push(`- \`${color.value}\` - ${color.property}`);
    });
    lines.push('');
  }

  // Typography
  if (ir.fonts.length > 0) {
    lines.push('### Typography');
    ir.fonts.forEach(font => {
      lines.push(`- **${font.family}** (${font.source})`);
    });
    lines.push('');
  }

  // Animations
  if (ir.motionIntent.length > 0) {
    lines.push('### Animations');
    lines.push('Apply conservative animations:');
    ir.motionIntent.forEach(motion => {
      lines.push(`- **${motion.animation}** on ${motion.element} (trigger: ${motion.trigger})`);
    });
    lines.push('');
  }

  // Embedded Content
  if (ir.embeds.length > 0) {
    lines.push('### Embedded Content');
    ir.embeds.forEach(embed => {
      lines.push(`- ${capitalizeFirst(embed.type)}${embed.platform ? ` (${embed.platform})` : ''}`);
    });
    lines.push('');
  }


  // JSON Schema
  lines.push('---');
  lines.push('');
  lines.push('## JSON Schema');
  lines.push('```json');
  lines.push(JSON.stringify(ir, null, 2));
  lines.push('```');

  return lines.join('\n');
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const synthesizer = {
  buildIR: buildIntermediateRepresentation,
  synthesize: synthesizePrompt,
};
