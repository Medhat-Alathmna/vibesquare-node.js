import { Knex } from 'knex';

/**
 * Migration: Add pipeline type tracking and PRD linkage to gallery_analyses
 *
 * Purpose: Enable V2.5 pipeline support in gallery endpoints by:
 * - Adding pipeline_type column to track which pipeline was used (v1, v2, v2.5)
 * - Adding prd_id foreign key to link analysis with generated PRD
 * - Adding 'partial' status for partial pipeline failures
 *
 * Changes:
 * 1. Add pipeline_type column (VARCHAR(10), default 'v1')
 * 2. Add prd_id column (UUID, nullable, foreign key to prds.id)
 * 3. Update status constraint to include 'partial'
 * 4. Add performance indexes
 */

export async function up(knex: Knex): Promise<void> {
  console.log('[Migration] Adding pipeline support to gallery_analyses table...');

  // 1. Add pipeline_type column
  await knex.schema.alterTable('gallery_analyses', (table) => {
    table.string('pipeline_type', 10).defaultTo('v1').notNullable().comment('Pipeline version used: v1, v2, or v2.5');
  });
  console.log('[Migration] Added pipeline_type column');

  // 2. Add prd_id column (foreign key to prds table)
  await knex.schema.alterTable('gallery_analyses', (table) => {
    table.uuid('prd_id').nullable().comment('Reference to PRD record (for v2.5 analyses)');
    table.foreign('prd_id').references('id').inTable('prds').onDelete('SET NULL');
  });
  console.log('[Migration] Added prd_id column with foreign key');

  // 3. Update status constraint to include 'partial'
  // First, drop the existing constraint
  await knex.schema.raw(`
    ALTER TABLE gallery_analyses
    DROP CONSTRAINT IF EXISTS gallery_analyses_status_check
  `);

  // Add new constraint with 'partial' status
  await knex.schema.raw(`
    ALTER TABLE gallery_analyses
    ADD CONSTRAINT gallery_analyses_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial'))
  `);
  console.log('[Migration] Updated status constraint to include partial');

  // 4. Create indexes for performance
  await knex.schema.raw(
    'CREATE INDEX idx_gallery_analyses_pipeline_type ON gallery_analyses(pipeline_type)'
  );
  console.log('[Migration] Created index on pipeline_type');

  await knex.schema.raw(
    'CREATE INDEX idx_gallery_analyses_prd_id ON gallery_analyses(prd_id) WHERE prd_id IS NOT NULL'
  );
  console.log('[Migration] Created index on prd_id');

  console.log('[Migration] Successfully added pipeline support to gallery_analyses table');
}

export async function down(knex: Knex): Promise<void> {
  console.log('[Migration] Rolling back pipeline support from gallery_analyses table...');

  // Drop indexes
  await knex.schema.raw('DROP INDEX IF EXISTS idx_gallery_analyses_prd_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_gallery_analyses_pipeline_type');
  console.log('[Migration] Dropped indexes');

  // Restore original status constraint
  await knex.schema.raw(`
    ALTER TABLE gallery_analyses
    DROP CONSTRAINT IF EXISTS gallery_analyses_status_check
  `);

  await knex.schema.raw(`
    ALTER TABLE gallery_analyses
    ADD CONSTRAINT gallery_analyses_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
  `);
  console.log('[Migration] Restored original status constraint');

  // Drop columns
  await knex.schema.alterTable('gallery_analyses', (table) => {
    table.dropColumn('prd_id');
    table.dropColumn('pipeline_type');
  });
  console.log('[Migration] Dropped prd_id and pipeline_type columns');

  console.log('[Migration] Successfully rolled back pipeline support from gallery_analyses table');
}
