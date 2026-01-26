/**
 * Toon Compression Tests
 *
 * Manual test file to verify Toon compression functionality
 * Run with: ts-node src/shared/utils/__tests__/toon-compression.test.ts
 */

import {
  compressJSON,
  decompressJSON,
  getCompressionStats,
  smartCompress,
} from '../toon-compression';

// Test data similar to Visual Pipeline debug output
const testData = {
  agentOutputs: {
    layoutAnalysis: {
      data: {
        sections: [
          {
            type: 'header',
            position: 'top',
            content: 'Navigation bar with logo and menu items',
          },
          {
            type: 'hero',
            position: 'center-top',
            content: 'Large banner with headline and CTA button',
          },
          {
            type: 'features',
            position: 'middle',
            content: 'Three-column feature showcase',
          },
          {
            type: 'footer',
            position: 'bottom',
            content: 'Footer with links and social media',
          },
        ],
        layoutPattern: 'hero-with-features',
      },
    },
    componentIdentification: {
      data: {
        components: [
          { type: 'button', count: 5, details: 'Primary and secondary buttons' },
          { type: 'input', count: 3, details: 'Email and search inputs' },
          { type: 'card', count: 6, details: 'Feature cards with icons' },
          { type: 'modal', count: 2, details: 'Login and contact modals' },
        ],
      },
    },
    designSystem: {
      data: {
        colors: {
          primary: '#3B82F6',
          secondary: '#10B981',
          accent: '#F59E0B',
          background: '#FFFFFF',
          text: '#1F2937',
        },
        fonts: {
          heading: 'Inter, sans-serif',
          body: 'System UI, sans-serif',
        },
        visualTone: 'modern-professional',
      },
    },
  },
  metadata: {
    sourceUrl: 'https://example.com',
    nodesFound: 152,
    layoutType: 'marketing-page',
    difficulty: 'medium',
    language: 'en',
    processingTimeMs: 3245,
    agentsUsed: ['layoutAnalyzer', 'componentIdentifier', 'designExtractor'],
    fallbackTriggered: false,
  },
  visualResults: {
    finalPrompt: 'Build a modern marketing landing page with hero section...',
    userQuestions: [
      'Should the navigation be sticky on scroll?',
      'Do you want animations on the feature cards?',
    ],
  },
};

console.log('🧪 Testing Toon Compression\n');
console.log('=' .repeat(50));

// Test 1: Basic Compression
console.log('\n📦 Test 1: Basic Compression & Decompression');
console.log('-'.repeat(50));
try {
  const compressed = compressJSON(testData);
  console.log('✅ Compression successful');
  console.log(`   Compressed data length: ${compressed.length} characters`);

  const decompressed = decompressJSON(compressed);
  console.log('✅ Decompression successful');

  const isEqual = JSON.stringify(testData) === JSON.stringify(decompressed);
  console.log(`   Data integrity: ${isEqual ? '✅ PASSED' : '❌ FAILED'}`);
} catch (error) {
  console.error('❌ Test failed:', error);
}

// Test 2: Compression Stats
console.log('\n📊 Test 2: Compression Statistics');
console.log('-'.repeat(50));
try {
  const compressed = compressJSON(testData);
  const stats = getCompressionStats(testData, compressed);

  console.log(`   Original size:     ${stats.originalSize} bytes`);
  console.log(`   Compressed size:   ${stats.compressedSize} bytes`);
  console.log(`   Saved:             ${stats.savedBytes} bytes (${stats.savedPercentage})`);
  console.log(`   Compression ratio: ${stats.compressionRatio}`);
} catch (error) {
  console.error('❌ Test failed:', error);
}

// Test 3: Smart Compression
console.log('\n🧠 Test 3: Smart Compression (with threshold)');
console.log('-'.repeat(50));
try {
  const result = smartCompress(testData, 0.7); // Only compress if saves 30%+

  console.log(`   Compressed: ${result.compressed ? '✅ Yes' : '❌ No'}`);
  console.log(`   Stats:`, result.stats);
} catch (error) {
  console.error('❌ Test failed:', error);
}

// Test 4: Small Data (might not compress well)
console.log('\n🔬 Test 4: Small Data Compression');
console.log('-'.repeat(50));
const smallData = { name: 'test', value: 123 };
try {
  const compressed = compressJSON(smallData);
  const stats = getCompressionStats(smallData, compressed);

  console.log(`   Original size:     ${stats.originalSize} bytes`);
  console.log(`   Compressed size:   ${stats.compressedSize} bytes`);
  console.log(`   Saved:             ${stats.savedBytes} bytes (${stats.savedPercentage})`);
} catch (error) {
  console.error('❌ Test failed:', error);
}

// Test 5: Large nested data
console.log('\n📈 Test 5: Large Nested Data');
console.log('-'.repeat(50));
const largeData = {
  items: Array.from({ length: 100 }, (_, i) => ({
    id: `item-${i}`,
    name: `Item ${i}`,
    description: 'This is a detailed description of the item with lots of text',
    metadata: {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tags: ['tag1', 'tag2', 'tag3'],
      nested: {
        level1: { level2: { level3: { value: 'deep' } } },
      },
    },
  })),
};

try {
  const compressed = compressJSON(largeData);
  const stats = getCompressionStats(largeData, compressed);

  console.log(`   Original size:     ${stats.originalSize} bytes`);
  console.log(`   Compressed size:   ${stats.compressedSize} bytes`);
  console.log(`   Saved:             ${stats.savedBytes} bytes (${stats.savedPercentage})`);
  console.log(`   Compression ratio: ${stats.compressionRatio}`);
} catch (error) {
  console.error('❌ Test failed:', error);
}

console.log('\n' + '='.repeat(50));
console.log('✨ All tests completed!\n');
