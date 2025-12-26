import { encode } from '@toon-format/toon';

// Mock types
interface RawDOMNode {
    order: number;
    tag: string;
    cssProperties: Record<string, string>;
    textContent?: string;
    images?: any[];
    children: RawDOMNode[];
    id?: string;
    className?: string;
    depth?: number;
    isContainer?: boolean;
}

// Logic from interpreter.ts
interface OptimizedNode {
    id: number;
    tag: string;
    css: number;
    txt?: string;
    img?: number;
    children?: OptimizedNode[];
}

function optimizeCSS(nodes: RawDOMNode[]): { cssMap: Record<number, any>, optimizedNodes: OptimizedNode[] } {
    const cssSignatureMap = new Map<string, number>();
    const cssIdMap: Record<number, any> = {};
    let nextCssId = 1;

    function getCssId(props: Record<string, string>): number {
        if (!props || Object.keys(props).length === 0) return 0;
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
        if (node.textContent) optimized.txt = node.textContent;
        if (node.children && node.children.length > 0) {
            optimized.children = node.children.map(transformNode);
        }
        return optimized;
    }

    const optimizedNodes = nodes.map(transformNode);
    return { cssMap: cssIdMap, optimizedNodes };
}

// Test Data
const cssRed = { color: 'red', display: 'flex' };
const cssBlue = { color: 'blue', position: 'absolute' };

const mockTree: RawDOMNode[] = [
    {
        order: 0, tag: 'div', cssProperties: cssRed, children: [
            { order: 1, tag: 'span', cssProperties: cssRed, children: [], textContent: 'Hello' }, // Repeat cssRed
            { order: 2, tag: 'span', cssProperties: cssBlue, children: [], textContent: 'World' }
        ]
    },
    {
        order: 3, tag: 'footer', cssProperties: cssRed, children: [] // Repeat cssRed again
    }
];

// Run
const { cssMap, optimizedNodes } = optimizeCSS(mockTree);
const context = {
    cssMap,
    tree: optimizedNodes
};

console.log('--- TOON Output ---');
console.log(encode(context));
console.log('-------------------');
console.log('CSS Map Keys:', Object.keys(cssMap));
