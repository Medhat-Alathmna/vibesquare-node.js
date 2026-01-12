# Data Model: Collection Concept

**Branch**: `001-collection-concept` | **Date**: 2026-01-12

## Overview

This document defines the data model for the Collection Concept feature, including entities, relationships, validation rules, and state transitions.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              COLLECTIONS                                 │
└─────────────────────────────────────────────────────────────────────────┘
         │                          │                          │
         │ 1:N                      │ 1:N                      │ 1:1
         ▼                          ▼                          ▼
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ COLLECTION_     │    │ COLLECTION_         │    │ COLLECTION_         │
│ PROJECTS        │    │ ACTIVITY            │    │ STATS               │
│ (junction)      │    │ (audit log)         │    │ (analytics)         │
└─────────────────┘    └─────────────────────┘    └─────────────────────┘
         │
         │ N:1
         ▼
┌─────────────────┐
│ PROJECTS        │
│ (existing)      │
└─────────────────┘

┌─────────────────┐
│ GALLERY_USERS   │◄──── owner_id (when owner_type = 'gallery_user')
│ (existing)      │
└─────────────────┘
```

---

## Entities

### 1. Collection (Enhanced)

The core entity representing a curated group of projects.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID/String | PK, unique, indexed | Unique identifier |
| title | String | Required, 3-100 chars | Collection name |
| description | String | Required, 10-1000 chars | Detailed description |
| thumbnail | String | Required | Image URL or file reference |
| tags | String[] | Max 10 items | Categorization tags |
| owner_id | UUID/String | Nullable, indexed | Gallery user ID (null for system) |
| owner_type | Enum | Required, default 'system' | 'system' \| 'gallery_user' |
| visibility | Enum | Required, default varies | 'private' \| 'public' |
| featured | Boolean | Default false, indexed | Homepage featured flag |
| cloned_from_id | UUID/String | Nullable | Source collection if cloned |
| is_deleted | Boolean | Default false | Soft delete flag |
| deleted_at | Timestamp | Nullable | When soft-deleted |
| created_at | Timestamp | Auto | Creation timestamp |
| updated_at | Timestamp | Auto | Last update timestamp |
| search_vector | tsvector | Generated | Full-text search (PostgreSQL) |

**Validation Rules**:
- Title: 3-100 characters, trimmed, unique per owner
- Description: 10-1000 characters
- Tags: max 10 items, each 1-50 characters, lowercase
- Thumbnail: valid URL or file ID format
- Visibility defaults: 'public' for system, 'private' for gallery_user

**Indexes**:
- Primary: `id`
- Composite: `(owner_id, owner_type)` for user's collections
- Filter: `featured = true` partial index
- Filter: `is_deleted = false` for active queries
- Full-text: `search_vector` GIN index

---

### 2. CollectionProject (Junction Table)

Represents a project's membership in a collection with ordering.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID/String | PK, unique | Unique identifier |
| collection_id | UUID/String | FK, indexed, required | Parent collection |
| project_id | UUID/String | FK, indexed, required | Referenced project |
| position | Integer | Required, default 1000 | Sort order (gap-based) |
| added_at | Timestamp | Auto | When project was added |
| added_by | UUID/String | Nullable | User who added (if tracked) |
| notes | String | Nullable, max 500 | Curator's notes (optional) |

**Validation Rules**:
- Unique constraint: `(collection_id, project_id)` - no duplicates
- Position: positive integer, default MAX(position) + 1000 or 1000
- Notes: optional, max 500 characters

**Indexes**:
- Primary: `id`
- Composite: `(collection_id, position)` for ordered retrieval
- Unique: `(collection_id, project_id)` for duplicate prevention

---

### 3. CollectionStats

Aggregate statistics for collection analytics.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID/String | PK, unique | Unique identifier |
| collection_id | UUID/String | FK, unique, indexed | Parent collection |
| views | Integer | Default 0 | Total view count |
| unique_visitors | Integer | Default 0 | Unique visitor count |
| clones | Integer | Default 0 | Times cloned |
| project_clicks | Integer | Default 0 | Clicks to projects |
| last_viewed_at | Timestamp | Nullable | Most recent view |
| updated_at | Timestamp | Auto | Last stats update |

**Validation Rules**:
- All counts: non-negative integers
- One-to-one with collection

**Indexes**:
- Primary: `id`
- Unique: `collection_id`

---

### 4. CollectionActivity

Audit log for collection changes.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID/String | PK, unique | Unique identifier |
| collection_id | UUID/String | FK, indexed | Related collection |
| action | Enum | Required | Action type |
| actor_id | UUID/String | Nullable | User who performed action |
| actor_type | Enum | Required | 'admin' \| 'gallery_user' \| 'system' |
| details | JSONB | Nullable | Action-specific metadata |
| created_at | Timestamp | Auto | When action occurred |

**Action Types**:
- `created` - Collection created
- `updated` - Metadata updated
- `project_added` - Project added to collection
- `project_removed` - Project removed
- `project_reordered` - Projects reordered
- `visibility_changed` - Visibility toggled
- `featured_changed` - Featured status toggled
- `cloned` - Collection was cloned
- `deleted` - Soft deleted
- `restored` - Restored from deletion

**Indexes**:
- Primary: `id`
- Composite: `(collection_id, created_at DESC)` for history retrieval
- Filter: `action` for filtering by type

---

## State Transitions

### Collection Lifecycle

```
                 ┌─────────────────┐
                 │     DRAFT       │ (implicit - no projects)
                 └────────┬────────┘
                          │ add first project
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        ACTIVE                                │
│  ┌─────────────┐              ┌─────────────┐               │
│  │   PRIVATE   │◄────────────►│   PUBLIC    │               │
│  │  (default   │  visibility  │             │               │
│  │  for users) │   toggle     │             │               │
│  └─────────────┘              └─────────────┘               │
└────────────────────────────┬────────────────────────────────┘
                             │ soft delete
                             ▼
                 ┌─────────────────┐
                 │    DELETED      │ (30-day retention)
                 └────────┬────────┘
                          │ restore OR 30 days expire
           ┌──────────────┴──────────────┐
           ▼                             ▼
  ┌─────────────────┐         ┌─────────────────┐
  │    RESTORED     │         │   PERMANENTLY   │
  │   (→ ACTIVE)    │         │    DELETED      │
  └─────────────────┘         └─────────────────┘
```

### Visibility Rules

| Owner Type | Default Visibility | Can Change To |
|------------|-------------------|---------------|
| system | public | N/A (always public) |
| gallery_user | private | public, private |

---

## Database Migrations

### PostgreSQL Migration: 004_enhance_collections_table.sql

```sql
-- Add ownership columns
ALTER TABLE collections ADD COLUMN IF NOT EXISTS owner_id VARCHAR(255) NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) NOT NULL DEFAULT 'system';
ALTER TABLE collections ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public';
ALTER TABLE collections ADD COLUMN IF NOT EXISTS cloned_from_id VARCHAR(255) NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add check constraint for owner_type
ALTER TABLE collections ADD CONSTRAINT chk_owner_type
  CHECK (owner_type IN ('system', 'gallery_user'));

-- Add check constraint for visibility
ALTER TABLE collections ADD CONSTRAINT chk_visibility
  CHECK (visibility IN ('private', 'public'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_collections_featured ON collections(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(is_deleted) WHERE is_deleted = FALSE;

-- Add full-text search
ALTER TABLE collections ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_collections_search ON collections USING GIN(search_vector);

-- Create search vector update trigger
CREATE OR REPLACE FUNCTION update_collection_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_collection_search_update
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_collection_search_vector();
```

### PostgreSQL Migration: 005_create_collection_stats.sql

```sql
-- Collection Projects junction table
CREATE TABLE IF NOT EXISTS collection_projects (
  id VARCHAR(255) PRIMARY KEY,
  collection_id VARCHAR(255) NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL DEFAULT 1000,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  added_by VARCHAR(255) NULL,
  notes VARCHAR(500) NULL,
  UNIQUE(collection_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_projects_order ON collection_projects(collection_id, position);

-- Collection Stats table
CREATE TABLE IF NOT EXISTS collection_stats (
  id VARCHAR(255) PRIMARY KEY,
  collection_id VARCHAR(255) NOT NULL UNIQUE REFERENCES collections(id) ON DELETE CASCADE,
  views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  clones INTEGER NOT NULL DEFAULT 0,
  project_clicks INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Collection Activity table
CREATE TABLE IF NOT EXISTS collection_activity (
  id VARCHAR(255) PRIMARY KEY,
  collection_id VARCHAR(255) NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor_id VARCHAR(255) NULL,
  actor_type VARCHAR(20) NOT NULL,
  details JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collection_activity_history
  ON collection_activity(collection_id, created_at DESC);
```

---

## MongoDB Schema Updates

### Collection Schema (collection.model.ts)

```typescript
const CollectionSchema = new Schema<ICollection>({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, minlength: 3, maxlength: 100 },
  description: { type: String, required: true, minlength: 10, maxlength: 1000 },
  thumbnail: { type: String, required: true },
  tags: {
    type: [String],
    validate: [v => v.length <= 10, 'Max 10 tags allowed'],
    index: true
  },
  ownerId: { type: String, default: null, index: true },
  ownerType: {
    type: String,
    enum: ['system', 'gallery_user'],
    default: 'system',
    required: true
  },
  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'public',
    required: true
  },
  featured: { type: Boolean, default: false, index: true },
  clonedFromId: { type: String, default: null },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null }
}, {
  timestamps: true
});

// Text search index
CollectionSchema.index(
  { title: 'text', description: 'text', tags: 'text' },
  { weights: { title: 10, description: 5, tags: 3 } }
);

// Compound indexes
CollectionSchema.index({ ownerId: 1, ownerType: 1 });
CollectionSchema.index({ isDeleted: 1, visibility: 1 });
```

---

## TypeScript Interfaces

```typescript
// src/api/collection/collection.types.ts

export type OwnerType = 'system' | 'gallery_user';
export type Visibility = 'private' | 'public';
export type CollectionAction =
  | 'created' | 'updated' | 'project_added' | 'project_removed'
  | 'project_reordered' | 'visibility_changed' | 'featured_changed'
  | 'cloned' | 'deleted' | 'restored';

export interface Collection {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  tags: string[];
  ownerId: string | null;
  ownerType: OwnerType;
  visibility: Visibility;
  featured: boolean;
  clonedFromId: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionProject {
  id: string;
  collectionId: string;
  projectId: string;
  position: number;
  addedAt: Date;
  addedBy: string | null;
  notes: string | null;
}

export interface CollectionStats {
  id: string;
  collectionId: string;
  views: number;
  uniqueVisitors: number;
  clones: number;
  projectClicks: number;
  lastViewedAt: Date | null;
  updatedAt: Date;
}

export interface CollectionActivity {
  id: string;
  collectionId: string;
  action: CollectionAction;
  actorId: string | null;
  actorType: 'admin' | 'gallery_user' | 'system';
  details: Record<string, any> | null;
  createdAt: Date;
}

// DTOs
export interface CreateCollectionDTO {
  title: string;
  description: string;
  thumbnail: string;
  tags?: string[];
  visibility?: Visibility;
}

export interface UpdateCollectionDTO {
  title?: string;
  description?: string;
  thumbnail?: string;
  tags?: string[];
  visibility?: Visibility;
  featured?: boolean;
}

export interface AddProjectDTO {
  projectId: string;
  position?: number;
  notes?: string;
}

export interface ReorderProjectsDTO {
  projectIds: string[]; // Ordered list of project IDs
}
```

---

## Data Volume Estimates

| Entity | Expected Volume | Growth Rate |
|--------|-----------------|-------------|
| Collections | 1,000 - 10,000 | 100/month |
| CollectionProjects | 10,000 - 100,000 | 1,000/month |
| CollectionStats | 1:1 with collections | Same as collections |
| CollectionActivity | 10x collections | 1,000/month |

**Performance Considerations**:
- CollectionProjects: Consider partitioning if > 1M rows
- CollectionActivity: Implement retention policy (keep 90 days, archive older)
- Stats updates: Batch writes every 5 minutes to reduce write load
