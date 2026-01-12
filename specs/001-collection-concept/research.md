# Research: Collection Concept

**Branch**: `001-collection-concept` | **Date**: 2026-01-12

## Overview

This document captures research findings and technical decisions for implementing the Collection Concept feature. All items marked as "NEEDS CLARIFICATION" in the technical context have been resolved through codebase analysis and best practices research.

---

## 1. Collection-Project Ordering Strategy

### Decision
Use a **position column with gap-based numbering** (positions: 1000, 2000, 3000...) in the junction table.

### Rationale
- Allows insertions between items without renumbering all positions
- Simple to implement with PostgreSQL and MongoDB
- Supports drag-and-drop reordering with minimal database writes
- Gap of 1000 allows ~1000 insertions between adjacent items before rebalancing needed

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Linked list (next_id) | Complex queries for ordered retrieval |
| Array index | Requires renumbering on every insert |
| Fractional positions | Precision issues over time |

### Implementation Notes
- Default position: `MAX(position) + 1000` or `1000` if empty
- Rebalance trigger: when gap < 10, renumber all positions
- PostgreSQL: `ORDER BY position ASC`
- MongoDB: `$sort: { position: 1 }`

---

## 2. Soft Delete Pattern

### Decision
Use **deleted_at timestamp + is_deleted boolean** pattern, consistent with existing codebase patterns.

### Rationale
- Codebase already uses timestamps for tracking (created_at, updated_at)
- Boolean flag enables efficient filtering without NULL checks
- Timestamp preserves deletion time for 30-day restore window
- Supports scheduled cleanup job for permanent deletion

### Implementation Notes
```sql
-- PostgreSQL
ALTER TABLE collections ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE collections ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- Queries automatically filter: WHERE is_deleted = FALSE
-- Restore: SET deleted_at = NULL, is_deleted = FALSE
-- Permanent delete: DELETE WHERE deleted_at < NOW() - INTERVAL '30 days'
```

---

## 3. View Count Debouncing

### Decision
Use **Redis-based debouncing** with 1-hour TTL per user-collection pair.

### Rationale
- Project already includes ioredis 5.9.0 dependency
- Redis provides atomic operations and automatic TTL expiration
- Scales horizontally for high traffic
- Falls back gracefully if Redis unavailable (count anyway)

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Database-only with timestamp check | Additional query per view |
| In-memory Map | Lost on server restart, no horizontal scaling |
| Cookie-based | Client can clear cookies, less reliable |

### Implementation Notes
```typescript
// Key format: collection:view:{collectionId}:{visitorId}
// visitorId = userId (authenticated) or IP hash (anonymous)
const key = `collection:view:${collectionId}:${visitorId}`;
const alreadyViewed = await redis.get(key);
if (!alreadyViewed) {
  await redis.setex(key, 3600, '1'); // 1 hour TTL
  await incrementViewCount(collectionId);
}
```

---

## 4. Collection Cloning Strategy

### Decision
**Deep copy with new IDs** - create new collection with copied metadata and project references.

### Rationale
- User expects independent copy they can modify
- Project references are IDs only (no data duplication)
- Maintains data integrity if original is deleted
- Clone count tracked on source collection for analytics

### Implementation Notes
```typescript
async cloneCollection(sourceId: string, userId: string): Promise<Collection> {
  const source = await this.findById(sourceId);

  // Verify source is public or user is owner
  if (source.visibility !== 'public' && source.ownerId !== userId) {
    throw new ForbiddenError('Cannot clone private collection');
  }

  // Create new collection
  const clone = await this.create({
    title: `${source.title} (Copy)`,
    description: source.description,
    thumbnail: source.thumbnail,
    tags: [...source.tags],
    projectIds: [...source.projectIds], // Copy references
    ownerId: userId,
    ownerType: 'gallery_user',
    visibility: 'private', // Clones start as private
    clonedFromId: sourceId
  });

  // Increment clone count on source
  await this.incrementStat(sourceId, 'clones');

  return clone;
}
```

---

## 5. Ownership Model Implementation

### Decision
Use **polymorphic ownership** with `owner_type` discriminator column.

### Rationale
- Clarification confirmed: admin collections are system-owned, gallery user collections are user-owned
- Single collections table with ownership context
- owner_id is NULL for system-owned (admin) collections
- Enables unified queries with ownership filtering

### Implementation Notes
```sql
ALTER TABLE collections ADD COLUMN owner_id VARCHAR(255) NULL;
ALTER TABLE collections ADD COLUMN owner_type VARCHAR(20) NOT NULL DEFAULT 'system';
-- owner_type: 'system' (admin-created) | 'gallery_user' (user-created)

-- System-owned: owner_id IS NULL, owner_type = 'system'
-- User-owned: owner_id = gallery_user.id, owner_type = 'gallery_user'
```

---

## 6. Authorization Middleware Pattern

### Decision
Implement **collection-specific middleware** that checks ownership and visibility.

### Rationale
- Clarification confirmed: strict owner-only modification with admin override
- Middleware pattern already used for auth in codebase
- Separates authorization logic from business logic
- Reusable across multiple endpoints

### Implementation Notes
```typescript
// middleware/collection-auth.middleware.ts
export const canModifyCollection = asyncHandler(async (req, res, next) => {
  const collection = await collectionService.findById(req.params.id);
  if (!collection) throw new NotFoundError('Collection not found');

  const user = req.user;

  // Admin override
  if (user.role === 'admin' && user.permissions.includes('collections.manage')) {
    return next();
  }

  // Owner check for gallery user collections
  if (collection.ownerType === 'gallery_user') {
    if (collection.ownerId !== user.id) {
      throw new ForbiddenError('Not authorized to modify this collection');
    }
  }

  // System collections: any admin with permission can edit
  if (collection.ownerType === 'system') {
    if (!user.permissions.includes('collections.manage')) {
      throw new ForbiddenError('Admin permission required');
    }
  }

  next();
});
```

---

## 7. Full-Text Search Implementation

### Decision
Use **PostgreSQL tsvector** for primary database, **MongoDB text index** for alternative.

### Rationale
- Spec assumption: "Full-text search will leverage existing database capabilities"
- PostgreSQL already used for other entities
- No need for external search service (Elasticsearch) at current scale
- Can migrate to dedicated search later if needed

### Implementation Notes
```sql
-- PostgreSQL
ALTER TABLE collections ADD COLUMN search_vector tsvector;

CREATE INDEX idx_collections_search ON collections USING GIN(search_vector);

-- Update trigger
CREATE OR REPLACE FUNCTION collections_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_collections_search
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION collections_search_trigger();
```

```typescript
// MongoDB
CollectionSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text'
}, {
  weights: { title: 10, description: 5, tags: 3 }
});
```

---

## 8. Collection Limits Enforcement

### Decision
**Check at service layer** before create/add operations.

### Rationale
- Limits are business rules (50 free / 200 pro)
- Database constraints can't easily express tier-based limits
- Service layer has access to user subscription context
- Clear error messages for limit violations

### Implementation Notes
```typescript
async createCollection(userId: string, data: CreateCollectionDTO): Promise<Collection> {
  const user = await galleryUserService.findById(userId);
  const currentCount = await this.countByOwner(userId);

  const limit = user.subscriptionTier === 'pro' ? 200 : 50;

  if (currentCount >= limit) {
    throw new LimitExceededError(
      `Collection limit reached (${limit}). Upgrade to Pro for more collections.`
    );
  }

  return this.repository.create({ ...data, ownerId: userId });
}
```

---

## Summary

| Topic | Decision | Status |
|-------|----------|--------|
| Project ordering | Gap-based positions (1000 increments) | Resolved |
| Soft delete | deleted_at + is_deleted pattern | Resolved |
| View debouncing | Redis with 1-hour TTL | Resolved |
| Cloning | Deep copy with new IDs | Resolved |
| Ownership model | Polymorphic with owner_type | Resolved |
| Authorization | Middleware with owner/admin checks | Resolved |
| Full-text search | PostgreSQL tsvector / MongoDB text | Resolved |
| Limits enforcement | Service layer validation | Resolved |

All research items resolved. Ready for Phase 1 design.
