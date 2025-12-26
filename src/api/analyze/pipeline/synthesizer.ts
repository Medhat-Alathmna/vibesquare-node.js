import {
  IntermediateRepresentation,
  RawParsedDOM,
  RawDOMNode,
  StructuralAnalysis,
  DesignInterpretation,
  IRNode,
  LayoutInfo,
  ComponentInfo,
  NavigationInfo,
  MotionIntent,
  ImageInfo,
} from './ir.types';

/**
 * Synthesizer - Converts IR to final professional prompt
 * Output: Markdown + JSON Schema format
 * Tone: Confident, Directive, Instructional
 * Audience: AI Code Generators only
 */

/**
 * Build Intermediate Representation from parsed DOM and LLM interpretation
 */
export function buildIntermediateRepresentation(
  sourceUrl: string,
  parsed: RawParsedDOM,
  structural: StructuralAnalysis,
  interpretation: DesignInterpretation
): IntermediateRepresentation {
  // Build a map from node order to node for quick lookup
  const nodeMap = new Map<number, RawDOMNode>();
  traverseTree(parsed.rootNodes, (node) => {
    nodeMap.set(node.order, node);
  });

  // Build IR nodes from LLM interpretation + parsed data
  const nodes: IRNode[] = interpretation.nodes.map((llmNode) => {
    const rawNode = nodeMap.get(llmNode.nodeOrder);

    // Collect images from node and its children
    const nodeImages: ImageInfo[] = [];
    if (rawNode) {
      collectImages(rawNode, nodeImages);
    }

    return {
      order: llmNode.nodeOrder,
      tag: rawNode?.tag || 'unknown',
      type: llmNode.inferredRole,
      description: llmNode.visualDescription,
      cssProperties: rawNode?.cssProperties || {},
      depth: rawNode?.depth || 0,
      isContainer: rawNode?.isContainer || false,
      childCount: rawNode?.children.length || 0,
      roleConfidence: llmNode.confidence,
      images: nodeImages,
    };
  });

  // Build layout info
  const layout: LayoutInfo = {
    type: structural.layoutType,
    hasGrid: structural.layoutType === 'grid',
    columnCount: parsed.cssInfo.gridColumns || parsed.cssInfo.flexColumns ||
                 (structural.layoutType === 'two-column' ? 2 :
                  structural.layoutType === 'single-column' ? 1 : undefined),
  };

  // Build components based on LLM interpretation
  const components: ComponentInfo[] = [];

  // Check if LLM identified a hero
  const hasHero = interpretation.nodes.some(n =>
    n.inferredRole.toLowerCase().includes('hero')
  );
  if (hasHero) {
    components.push({ type: 'hero', description: 'Hero section with headline and CTA', location: 'top' });
  }

  if (parsed.allForms.length > 0) {
    components.push({
      type: 'form',
      description: `${parsed.allForms.length} form(s) with ${parsed.allForms.reduce((a, f) => a + f.fields.length, 0)} total fields`,
      location: 'various'
    });
  }

  // Check for grid/card sections from LLM interpretation
  const cardSections = interpretation.nodes.filter(n =>
    n.inferredRole.toLowerCase().includes('feature') ||
    n.inferredRole.toLowerCase().includes('card') ||
    n.inferredRole.toLowerCase().includes('grid') ||
    n.inferredRole.toLowerCase().includes('testimonial')
  );
  if (cardSections.length > 0) {
    components.push({
      type: 'card-grid',
      description: `${cardSections.length} card-based section(s)`,
      location: 'various'
    });
  }

  // Build navigation info
  const navigation: NavigationInfo | null = parsed.navigation.length > 0 ? {
    position: null,  // Cannot determine from HTML alone
    style: null,     // Cannot determine from HTML alone
    items: parsed.navigation,
  } : null;

  // Build motion intents
  const motionIntent: MotionIntent[] = interpretation.suggestedAnimations.map(anim => ({
    element: 'nodes',
    animation: anim,
    trigger: null,  // Don't guess load vs scroll
  }));

  return {
    sourceUrl,
    nodes,
    layout,
    components,
    navigation,
    forms: parsed.allForms,
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

/**
 * Traverse all nodes in the tree and apply a callback
 */
function traverseTree(nodes: RawDOMNode[], callback: (node: RawDOMNode) => void): void {
  function traverse(node: RawDOMNode): void {
    callback(node);
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const node of nodes) {
    traverse(node);
  }
}

/**
 * Collect all images from a node and its children
 */
function collectImages(node: RawDOMNode, images: ImageInfo[]): void {
  images.push(...node.images);
  for (const child of node.children) {
    collectImages(child, images);
  }
}

/**
 * Synthesize final prompt from Intermediate Representation
 */
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
  lines.push(`This landing page uses a **${ir.layout.type}** layout with **${ir.nodes.length}** significant sections.`);
  lines.push('');

  // Nodes detail (semantic sections)
  lines.push('## Sections');
  lines.push('Build the following sections in order:');
  lines.push('');

  ir.nodes.forEach((node, index) => {
    const confidenceMark = node.roleConfidence === 'low' ? ' (low confidence)' :
                           node.roleConfidence === 'medium' ? ' (medium confidence)' : '';
    lines.push(`### ${index + 1}. ${capitalizeFirst(node.type)} Section${confidenceMark}`);

    // Description (from LLM)
    if (node.description) {
      lines.push(`**Purpose:** ${node.description}`);
      lines.push('');
    }

    // Node info
    lines.push(`**Element:** \`<${node.tag}>\` (order: ${node.order}, depth: ${node.depth})`);
    lines.push('');

    // Visual Implementation Details (from CSS)
    if (node.cssProperties && Object.keys(node.cssProperties).length > 0) {
      lines.push('**Visual Implementation:**');

      // Position & Layout
      if (node.cssProperties['position'] && node.cssProperties['position'] !== 'static') {
        lines.push(`- Position: \`${node.cssProperties['position']}\``);
        if (node.cssProperties['top']) lines.push(`  - Top: \`${node.cssProperties['top']}\``);
        if (node.cssProperties['z-index']) lines.push(`  - Z-index: \`${node.cssProperties['z-index']}\``);
      }

      // Background
      const bg = node.cssProperties['background-color'] || node.cssProperties['background'];
      if (bg) {
        lines.push(`- Background: \`${bg}\``);
      }

      // Color
      if (node.cssProperties['color']) {
        lines.push(`- Text Color: \`${node.cssProperties['color']}\``);
      }

      // Layout System
      if (node.cssProperties['display']) {
        const display = node.cssProperties['display'];
        lines.push(`- Layout: \`${display}\``);

        if (display === 'grid' && node.cssProperties['grid-template-columns']) {
          lines.push(`  - Columns: \`${node.cssProperties['grid-template-columns']}\``);
        }

        if (display === 'flex') {
          if (node.cssProperties['flex-direction']) {
            lines.push(`  - Direction: \`${node.cssProperties['flex-direction']}\``);
          }
          if (node.cssProperties['justify-content']) {
            lines.push(`  - Justify: \`${node.cssProperties['justify-content']}\``);
          }
        }
      }

      // Spacing
      if (node.cssProperties['padding']) {
        lines.push(`- Padding: \`${node.cssProperties['padding']}\``);
      }

      // Visual Effects
      if (node.cssProperties['box-shadow']) {
        lines.push(`- Elevation: \`${node.cssProperties['box-shadow']}\``);
      }
      if (node.cssProperties['backdrop-filter']) {
        lines.push(`- Backdrop: \`${node.cssProperties['backdrop-filter']}\``);
      }
      if (node.cssProperties['border-radius']) {
        lines.push(`- Border Radius: \`${node.cssProperties['border-radius']}\``);
      }

      lines.push('');
    }

    // Include images
    if (node.images.length > 0) {
      lines.push(`**Images (${node.images.length}):**`);
      node.images.slice(0, 3).forEach(img => {
        lines.push(`- ${img.alt || 'Decorative image'}`);
      });
      if (node.images.length > 3) {
        lines.push(`- ... and ${node.images.length - 3} more images`);
      }
      lines.push('');
    }

    // Container info
    if (node.isContainer && node.childCount > 0) {
      lines.push(`- Contains **${node.childCount}** child elements`);
    }
    lines.push('');
  });

  // Navigation
  if (ir.navigation) {
    lines.push('## Navigation');

    // Only include position/style if known
    if (ir.navigation.position || ir.navigation.style) {
      const parts = [];
      if (ir.navigation.position) parts.push(`Position: **${ir.navigation.position}**`);
      if (ir.navigation.style) parts.push(`Style: **${ir.navigation.style}**`);
      lines.push(parts.join(', '));
      lines.push('');
    }

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
      const triggerText = motion.trigger ? ` (trigger: ${motion.trigger})` : ' (trigger: TBD)';
      lines.push(`- **${motion.animation}** on ${motion.element}${triggerText}`);
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
