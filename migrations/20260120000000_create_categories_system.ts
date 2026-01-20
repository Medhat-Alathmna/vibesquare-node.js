import { Knex } from 'knex';

/**
 * Migration: Create Categories System
 * Description: Creates categories table and junction tables for many-to-many relationships
 * Author: VibeSquare Development Team
 * Date: 2026-01-20
 */

export async function up(knex: Knex): Promise<void> {
  // ============================================
  // 1. CREATE CATEGORIES TABLE
  // ============================================
  await knex.schema.createTable('categories', (table) => {
    // Primary Key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Core Fields
    table.string('name', 100).notNullable();
    table.string('slug', 100).notNullable();

    // Status Fields
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('deleted_at').nullable();

    // Timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Comments
    table.comment('Categories for organizing projects and collections. Supports soft delete and active/inactive states.');
  });

  // Add column comments
  await knex.raw(`
    COMMENT ON COLUMN categories.id IS 'Unique identifier (UUID)';
    COMMENT ON COLUMN categories.name IS 'Display name of the category (unique when not deleted)';
    COMMENT ON COLUMN categories.slug IS 'URL-friendly slug (auto-generated from name)';
    COMMENT ON COLUMN categories.is_active IS 'Whether the category is active and visible';
    COMMENT ON COLUMN categories.deleted_at IS 'Timestamp of soft delete (NULL = not deleted)';
  `);

  // ============================================
  // 2. CREATE UNIQUE INDEXES (Exclude Soft-Deleted)
  // ============================================

  // Unique name constraint (case-insensitive, excluding soft-deleted)
  await knex.raw(`
    CREATE UNIQUE INDEX idx_categories_name_active
    ON categories(LOWER(name))
    WHERE deleted_at IS NULL
  `);

  await knex.raw(`
    COMMENT ON INDEX idx_categories_name_active IS
    'Ensures category names are unique (case-insensitive) when not soft-deleted'
  `);

  // Unique slug constraint (excluding soft-deleted)
  await knex.raw(`
    CREATE UNIQUE INDEX idx_categories_slug_active
    ON categories(slug)
    WHERE deleted_at IS NULL
  `);

  await knex.raw(`
    COMMENT ON INDEX idx_categories_slug_active IS
    'Ensures slugs are unique when not soft-deleted'
  `);

  // ============================================
  // 3. CREATE PERFORMANCE INDEXES
  // ============================================

  // Index for is_active queries
  await knex.raw(`
    CREATE INDEX idx_categories_is_active
    ON categories(is_active)
    WHERE deleted_at IS NULL
  `);

  await knex.raw(`
    COMMENT ON INDEX idx_categories_is_active IS
    'Optimizes queries filtering by active status'
  `);

  // Index for soft-deleted records
  await knex.raw(`
    CREATE INDEX idx_categories_deleted_at
    ON categories(deleted_at)
    WHERE deleted_at IS NOT NULL
  `);

  await knex.raw(`
    COMMENT ON INDEX idx_categories_deleted_at IS
    'Optimizes queries for soft-deleted records'
  `);

  // Index for name searches
  await knex.raw(`
    CREATE INDEX idx_categories_name
    ON categories(name)
    WHERE deleted_at IS NULL
  `);

  await knex.raw(`
    COMMENT ON INDEX idx_categories_name IS
    'Optimizes category name searches and lookups'
  `);

  // ============================================
  // 4. CREATE PROJECT-CATEGORY JUNCTION TABLE
  // ============================================
  await knex.schema.createTable('project_categories', (table) => {
    // Foreign Keys
    table.string('project_id', 100).notNullable();
    table.uuid('category_id').notNullable();

    // Timestamp
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Composite Primary Key
    table.primary(['project_id', 'category_id']);

    // Foreign Key Constraints
    table
      .foreign('project_id')
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');

    table
      .foreign('category_id')
      .references('id')
      .inTable('categories')
      .onDelete('CASCADE');

    // Table comment
    table.comment(
      'Junction table for many-to-many relationship between projects and categories. CASCADE deletes ensure orphaned records are cleaned up.'
    );
  });

  // Create indexes for junction table
  await knex.schema.table('project_categories', (table) => {
    table.index('project_id', 'idx_project_categories_project');
    table.index('category_id', 'idx_project_categories_category');
  });

  await knex.raw(`
    COMMENT ON INDEX idx_project_categories_project IS
    'Optimizes lookups of categories for a specific project';
    COMMENT ON INDEX idx_project_categories_category IS
    'Optimizes lookups of projects in a specific category';
  `);

  // ============================================
  // 5. CREATE COLLECTION-CATEGORY JUNCTION TABLE
  // ============================================
  await knex.schema.createTable('collection_categories', (table) => {
    // Foreign Keys
    table.string('collection_id', 100).notNullable();
    table.uuid('category_id').notNullable();

    // Timestamp
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // Composite Primary Key
    table.primary(['collection_id', 'category_id']);

    // Foreign Key Constraints
    table
      .foreign('collection_id')
      .references('id')
      .inTable('collections')
      .onDelete('CASCADE');

    table
      .foreign('category_id')
      .references('id')
      .inTable('categories')
      .onDelete('CASCADE');

    // Table comment
    table.comment(
      'Junction table for many-to-many relationship between collections and categories. CASCADE deletes ensure orphaned records are cleaned up.'
    );
  });

  // Create indexes for junction table
  await knex.schema.table('collection_categories', (table) => {
    table.index('collection_id', 'idx_collection_categories_collection');
    table.index('category_id', 'idx_collection_categories_category');
  });

  await knex.raw(`
    COMMENT ON INDEX idx_collection_categories_collection IS
    'Optimizes lookups of categories for a specific collection';
    COMMENT ON INDEX idx_collection_categories_category IS
    'Optimizes lookups of collections in a specific category';
  `);

  // ============================================
  // 6. CREATE UPDATE TIMESTAMP TRIGGER
  // ============================================

  // Function to update updated_at timestamp
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_categories_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await knex.raw(`
    COMMENT ON FUNCTION update_categories_updated_at() IS
    'Automatically updates the updated_at timestamp when a category is modified'
  `);

  // Trigger to automatically update updated_at on UPDATE
  await knex.raw(`
    CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_categories_updated_at()
  `);

  console.log('✓ Migration: Categories system tables created successfully');
  console.log('  - categories table: CREATED');
  console.log('  - project_categories junction table: CREATED');
  console.log('  - collection_categories junction table: CREATED');
  console.log('  - All indexes and constraints: CREATED');
}

/**
 * Rollback migration
 */
export async function down(knex: Knex): Promise<void> {
  // Drop trigger and function
  await knex.raw('DROP TRIGGER IF EXISTS trigger_categories_updated_at ON categories');
  await knex.raw('DROP FUNCTION IF EXISTS update_categories_updated_at()');

  // Drop junction tables (order matters due to foreign keys)
  await knex.schema.dropTableIfExists('collection_categories');
  await knex.schema.dropTableIfExists('project_categories');

  // Drop main table
  await knex.schema.dropTableIfExists('categories');

  console.log('✓ Rollback: Categories system tables dropped successfully');
}
