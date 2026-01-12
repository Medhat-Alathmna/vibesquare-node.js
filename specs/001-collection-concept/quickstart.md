# Quickstart: Collection Concept

**Branch**: `001-collection-concept` | **Date**: 2026-01-12

## Overview

This guide provides a quick reference for implementing the Collection Concept feature. It covers setup, key implementation patterns, and testing approaches.

---

## Prerequisites

1. **Environment Setup**
   - Node.js 18+ installed
   - PostgreSQL or MongoDB running
   - Redis running (for view debouncing)
   - Environment variables configured

2. **Dependencies** (already in package.json)
   - express, mongoose, pg, ioredis, joi, uuid

3. **Branch**
   ```bash
   git checkout 001-collection-concept
   ```

---

## Quick Implementation Steps

### Step 1: Run Database Migrations

```bash
# PostgreSQL
psql -d vibesquare -f migrations/004_enhance_collections_table.sql
psql -d vibesquare -f migrations/005_create_collection_stats.sql
```

### Step 2: Update MongoDB Schema (if using MongoDB)

Update `src/api/collection/collection.model.ts` with new fields:
- ownerId, ownerType, visibility, clonedFromId, isDeleted, deletedAt

### Step 3: Extend Repository Interface

```typescript
// src/shared/repositories/interfaces.ts
export interface ICollectionRepository {
  // Existing methods
  findAll(page: number, limit: number): Promise<CollectionsResult>;
  findById(id: string): Promise<CollectionData | null>;
  findFeatured(): Promise<CollectionData[]>;
  findProjectsByCollectionId(projectIds: string[]): Promise<ProjectData[]>;

  // NEW methods
  create(data: CreateCollectionDTO): Promise<CollectionData>;
  update(id: string, data: UpdateCollectionDTO): Promise<CollectionData | null>;
  softDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<CollectionData | null>;
  permanentDelete(id: string): Promise<boolean>;

  findByOwner(ownerId: string, options: QueryOptions): Promise<CollectionsResult>;
  search(query: string, options: QueryOptions): Promise<CollectionsResult>;

  addProject(collectionId: string, projectId: string, position?: number): Promise<void>;
  removeProject(collectionId: string, projectId: string): Promise<void>;
  reorderProjects(collectionId: string, projectIds: string[]): Promise<void>;

  incrementStat(id: string, field: 'views' | 'clones' | 'projectClicks'): Promise<void>;
  getStats(id: string): Promise<CollectionStats>;

  clone(sourceId: string, ownerId: string): Promise<CollectionData>;
}
```

### Step 4: Create Type Definitions

```typescript
// src/api/collection/collection.types.ts
export type OwnerType = 'system' | 'gallery_user';
export type Visibility = 'private' | 'public';

export interface CreateCollectionDTO {
  title: string;
  description: string;
  thumbnail: string;
  tags?: string[];
  visibility?: Visibility;
  ownerId?: string;
  ownerType?: OwnerType;
}

export interface UpdateCollectionDTO {
  title?: string;
  description?: string;
  thumbnail?: string;
  tags?: string[];
  visibility?: Visibility;
  featured?: boolean;
}
```

### Step 5: Implement Authorization Middleware

```typescript
// src/shared/middleware/collection-auth.middleware.ts
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import httpStatus from 'http-status';
import { collectionService } from '../../api/collection/collection.service';

export const canViewCollection = asyncHandler(async (req, res, next) => {
  const collection = await collectionService.findById(req.params.id);
  if (!collection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
  }

  // Public collections viewable by anyone
  if (collection.visibility === 'public') {
    req.collection = collection;
    return next();
  }

  // Private collections require auth
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  // Owner can view their own private collections
  if (collection.ownerId === req.user.id) {
    req.collection = collection;
    return next();
  }

  // Admins can view any collection
  if (req.user.role === 'admin') {
    req.collection = collection;
    return next();
  }

  throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
});

export const canModifyCollection = asyncHandler(async (req, res, next) => {
  const collection = await collectionService.findById(req.params.id);
  if (!collection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
  }

  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  // Admin override for moderation
  if (req.user.role === 'admin') {
    req.collection = collection;
    return next();
  }

  // System collections: admin only
  if (collection.ownerType === 'system') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Admin permission required');
  }

  // User collections: owner only
  if (collection.ownerId !== req.user.id) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized');
  }

  req.collection = collection;
  next();
});
```

### Step 6: Add Routes

```typescript
// src/api/collection/collection.router.ts (extend existing)
import { Router } from 'express';
import { galleryAuth, adminAuth } from '../../shared/middleware/auth';
import { canViewCollection, canModifyCollection } from '../../shared/middleware/collection-auth.middleware';
import * as controller from './collection.controller';

const router = Router();

// Public routes
router.get('/', controller.getCollections);
router.get('/featured', controller.getFeaturedCollections);
router.get('/:id', canViewCollection, controller.getCollectionById);
router.get('/:id/share', canViewCollection, controller.getShareMetadata);

export default router;

// src/api/gallery/collections/gallery-collection.router.ts (new)
const galleryCollectionRouter = Router();

galleryCollectionRouter.use(galleryAuth);
galleryCollectionRouter.get('/', controller.getMyCollections);
galleryCollectionRouter.post('/', controller.createCollection);
galleryCollectionRouter.get('/:id', canModifyCollection, controller.getCollectionById);
galleryCollectionRouter.patch('/:id', canModifyCollection, controller.updateCollection);
galleryCollectionRouter.delete('/:id', canModifyCollection, controller.deleteCollection);
galleryCollectionRouter.post('/:id/projects', canModifyCollection, controller.addProject);
galleryCollectionRouter.delete('/:id/projects/:projectId', canModifyCollection, controller.removeProject);
galleryCollectionRouter.put('/:id/projects/reorder', canModifyCollection, controller.reorderProjects);
galleryCollectionRouter.post('/:id/clone', controller.cloneCollection);
galleryCollectionRouter.get('/:id/stats', canModifyCollection, controller.getStats);

export default galleryCollectionRouter;
```

### Step 7: Implement View Debouncing

```typescript
// src/api/collection/collection.service.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async recordView(collectionId: string, visitorId: string): Promise<void> {
  const key = `collection:view:${collectionId}:${visitorId}`;
  const alreadyViewed = await redis.get(key);

  if (!alreadyViewed) {
    await redis.setex(key, 3600, '1'); // 1 hour TTL
    await this.repository.incrementStat(collectionId, 'views');
  }
}
```

---

## Testing Checklist

### Unit Tests
- [ ] Collection CRUD operations
- [ ] Ownership validation
- [ ] Visibility rules
- [ ] Duplicate project prevention
- [ ] Collection limits enforcement

### Integration Tests
- [ ] Create collection flow (gallery user)
- [ ] Add/remove/reorder projects
- [ ] Clone public collection
- [ ] Admin override for moderation
- [ ] View count debouncing

### Manual Tests
- [ ] Create collection via API
- [ ] Add project from project detail page
- [ ] Toggle visibility private/public
- [ ] Clone another user's public collection
- [ ] Admin feature a collection

---

## Key Files to Modify

| File | Action |
|------|--------|
| `src/api/collection/collection.model.ts` | Extend schema |
| `src/api/collection/collection.service.ts` | Add CRUD, clone, stats |
| `src/api/collection/collection.controller.ts` | New endpoint handlers |
| `src/api/collection/collection.validator.ts` | New validation schemas |
| `src/api/collection/collection.router.ts` | New routes |
| `src/api/collection/collection.types.ts` | NEW: Type definitions |
| `src/shared/repositories/interfaces.ts` | Extend interface |
| `src/shared/repositories/postgres/collection.repository.ts` | Implement new methods |
| `src/shared/repositories/mongodb/collection.repository.ts` | Implement new methods |
| `src/shared/middleware/collection-auth.middleware.ts` | NEW: Authorization |
| `src/api/admin/collections/*` | NEW: Admin endpoints |
| `src/api/gallery/collections/*` | NEW: Gallery user endpoints |
| `migrations/004_enhance_collections_table.sql` | NEW: Schema migration |
| `migrations/005_create_collection_stats.sql` | NEW: Stats tables |

---

## Common Patterns

### Check Collection Limit
```typescript
const MAX_FREE = 50;
const MAX_PRO = 200;

async checkLimit(userId: string): Promise<void> {
  const user = await galleryUserService.findById(userId);
  const count = await this.repository.countByOwner(userId);
  const limit = user.subscriptionTier === 'pro' ? MAX_PRO : MAX_FREE;

  if (count >= limit) {
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      `Collection limit reached (${limit}). Upgrade for more.`
    );
  }
}
```

### Gap-Based Reordering
```typescript
async reorderProjects(collectionId: string, projectIds: string[]): Promise<void> {
  const GAP = 1000;
  const updates = projectIds.map((id, index) => ({
    projectId: id,
    position: (index + 1) * GAP
  }));

  await this.repository.updatePositions(collectionId, updates);
}
```

### Cascade Delete Handler
```typescript
// When a project is deleted, remove from all collections
async onProjectDeleted(projectId: string): Promise<void> {
  await this.repository.removeProjectFromAll(projectId);
}
```

---

## Environment Variables

```env
# Required for view debouncing
REDIS_URL=redis://localhost:6379

# Existing (no changes needed)
DB_TYPE=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=vibesquare
POSTGRES_PASSWORD=secret
POSTGRES_DATABASE=vibesquare
```

---

## Next Steps

After implementing core functionality:

1. Run `/speckit.tasks` to generate detailed task breakdown
2. Implement P1 user stories first (Admin CRUD, Public browsing)
3. Add P2 features (Gallery user collections)
4. Add P3 features (Analytics, Sharing)
