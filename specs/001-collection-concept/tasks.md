# Tasks: Collection Concept

**Input**: Design documents from `/specs/001-collection-concept/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No automated tests requested. Manual testing only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Project structure**: `src/` at repository root (existing Node.js/TypeScript backend)
- **Migrations**: `migrations/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migrations and shared type definitions

- [ ] T001 Create PostgreSQL migration file `migrations/004_enhance_collections_table.sql` with ownership, visibility, soft-delete columns
- [ ] T002 Create PostgreSQL migration file `migrations/005_create_collection_stats.sql` with junction table, stats, and activity tables
- [ ] T003 [P] Create shared type definitions in `src/api/collection/collection.types.ts` (OwnerType, Visibility, Collection, CollectionProject, CollectionStats, CollectionActivity, DTOs)
- [ ] T004 [P] Extend repository interface in `src/shared/repositories/interfaces.ts` with new ICollectionRepository methods

---

## Phase 2: Foundational (Blocking Prerequisites)/

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Run database migrations to update collections table schema
- [ ] T006 Update MongoDB Collection schema in `src/api/collection/collection.model.ts` with new fields (ownerId, ownerType, visibility, clonedFromId, isDeleted, deletedAt)
- [ ] T007 [P] Create CollectionProject MongoDB model in `src/api/collection/collection-project.model.ts`
- [ ] T008 [P] Create CollectionStats MongoDB model in `src/api/collection/collection-stats.model.ts`
- [ ] T009 [P] Create CollectionActivity MongoDB model in `src/api/collection/collection-activity.model.ts`
- [ ] T010 Extend PostgreSQL repository in `src/shared/repositories/postgres/collection.repository.ts` with create, update, softDelete, restore methods
- [ ] T011 Extend MongoDB repository in `src/shared/repositories/mongodb/collection.repository.ts` with create, update, softDelete, restore methods
- [ ] T012 Create authorization middleware in `src/shared/middleware/collection-auth.middleware.ts` (canViewCollection, canModifyCollection)
- [ ] T013 [P] Create collection validators in `src/api/collection/collection.validator.ts` (createCollection, updateCollection, addProject, reorderProjects schemas)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Admin Creates and Manages Collections (Priority: P1) 🎯 MVP

**Goal**: Admin users can create themed collections, add/remove/reorder projects, mark as featured, and soft-delete collections

**Independent Test**: Create a collection via admin API, add projects, verify it appears in public gallery

### Implementation for User Story 1

- [ ] T014 [US1] Create admin collection controller in `src/api/admin/collections/admin-collection.controller.ts` with create, list, update, delete, restore handlers
- [ ] T015 [US1] Create admin collection validator in `src/api/admin/collections/admin-collection.validator.ts` with admin-specific schemas (featured flag)
- [ ] T016 [US1] Create admin collection router in `src/api/admin/collections/admin-collection.router.ts` with protected routes
- [ ] T017 [US1] Implement createSystemCollection method in `src/api/collection/collection.service.ts` (ownerType='system', visibility='public')
- [ ] T018 [US1] Implement addProject method in `src/api/collection/collection.service.ts` with duplicate prevention and position calculation
- [ ] T019 [US1] Implement removeProject method in `src/api/collection/collection.service.ts`
- [ ] T020 [US1] Implement reorderProjects method in `src/api/collection/collection.service.ts` with gap-based positioning
- [ ] T021 [US1] Implement updateCollection method in `src/api/collection/collection.service.ts` including featured toggle
- [ ] T022 [US1] Implement softDelete and restore methods in `src/api/collection/collection.service.ts`
- [ ] T023 [US1] Add admin collection routes to `src/api/admin/index.ts` and wire to main router
- [ ] T024 [US1] Implement PostgreSQL repository methods for add/remove/reorder projects in `src/shared/repositories/postgres/collection.repository.ts`
- [ ] T025 [US1] Implement MongoDB repository methods for add/remove/reorder projects in `src/shared/repositories/mongodb/collection.repository.ts`

**Checkpoint**: Admin can create/manage system collections via API

---

## Phase 4: User Story 3 - Visitor Browses and Discovers Collections (Priority: P1)

**Goal**: Visitors can browse public collections, view featured collections, search/filter, and view collection details with projects

**Independent Test**: Navigate to /api/collections, filter by tags, search, view collection detail page

### Implementation for User Story 3

- [ ] T026 [US3] Update getCollections in `src/api/collection/collection.controller.ts` with sorting, filtering, search parameters
- [ ] T027 [US3] Update getCollectionById in `src/api/collection/collection.controller.ts` to return projects in order
- [ ] T028 [US3] Implement full-text search in PostgreSQL repository `src/shared/repositories/postgres/collection.repository.ts` using tsvector
- [ ] T029 [US3] Implement full-text search in MongoDB repository `src/shared/repositories/mongodb/collection.repository.ts` using text index
- [ ] T030 [US3] Add search, sort, and filter parameters to `src/api/collection/collection.validator.ts`
- [ ] T031 [US3] Update public routes in `src/api/collection/collection.router.ts` with search and filter query params
- [ ] T032 [US3] Implement getPublicCollections service method in `src/api/collection/collection.service.ts` (visibility='public', isDeleted=false filter)
- [ ] T033 [US3] Add projectCount computed field to collection list responses in `src/api/collection/collection.service.ts`

**Checkpoint**: Public visitors can browse, search, and view collections

---

## Phase 5: User Story 2 - Gallery User Creates Personal Collections (Priority: P2)

**Goal**: Gallery users can create private/public collections, add projects, manage visibility, and clone public collections

**Independent Test**: Gallery user creates collection, adds project, toggles visibility, clones another user's public collection

### Implementation for User Story 2

- [ ] T034 [US2] Create gallery collection controller in `src/api/gallery/collections/gallery-collection.controller.ts` with CRUD, addProject, clone handlers
- [ ] T035 [US2] Create gallery collection validator in `src/api/gallery/collections/gallery-collection.validator.ts`
- [ ] T036 [US2] Create gallery collection router in `src/api/gallery/collections/gallery-collection.router.ts` with authenticated routes
- [ ] T037 [US2] Implement createUserCollection method in `src/api/collection/collection.service.ts` (ownerType='gallery_user', default private)
- [ ] T038 [US2] Implement collection limit checking in `src/api/collection/collection.service.ts` (50 free / 200 pro)
- [ ] T039 [US2] Implement getMyCollections method in `src/api/collection/collection.service.ts` filtered by ownerId
- [ ] T040 [US2] Implement toggleVisibility method in `src/api/collection/collection.service.ts`
- [ ] T041 [US2] Implement cloneCollection method in `src/api/collection/collection.service.ts` with deep copy
- [ ] T042 [US2] Implement unique title per owner validation in `src/api/collection/collection.service.ts`
- [ ] T043 [US2] Add gallery collection routes to `src/api/gallery/index.ts` and wire to main router
- [ ] T044 [US2] Implement findByOwner repository method in `src/shared/repositories/postgres/collection.repository.ts`
- [ ] T045 [US2] Implement findByOwner repository method in `src/shared/repositories/mongodb/collection.repository.ts`

**Checkpoint**: Gallery users can create and manage personal collections

---

## Phase 6: User Story 4 - Collection Statistics and Analytics (Priority: P3)

**Goal**: Track view counts with debouncing, clone counts, and provide statistics to owners

**Independent Test**: View a collection, verify view count increments (once per hour), view stats as owner

### Implementation for User Story 4

- [ ] T046 [US4] Implement view debouncing service in `src/api/collection/collection-stats.service.ts` using Redis
- [ ] T047 [US4] Implement incrementViewCount method in `src/api/collection/collection.service.ts` with debouncing
- [ ] T048 [US4] Add view count increment to getCollectionById in `src/api/collection/collection.controller.ts`
- [ ] T049 [US4] Implement incrementCloneCount method in `src/api/collection/collection.service.ts`
- [ ] T050 [US4] Implement getCollectionStats method in `src/api/collection/collection.service.ts`
- [ ] T051 [US4] Add GET /gallery/collections/:id/stats endpoint in `src/api/gallery/collections/gallery-collection.controller.ts`
- [ ] T052 [US4] Implement admin aggregate stats endpoint in `src/api/admin/collections/admin-collection.controller.ts`
- [ ] T053 [US4] Implement stats repository methods in `src/shared/repositories/postgres/collection.repository.ts`
- [ ] T054 [US4] Implement stats repository methods in `src/shared/repositories/mongodb/collection.repository.ts`

**Checkpoint**: Collection analytics are tracked and accessible

---

## Phase 7: User Story 5 - Collection Sharing and Embedding (Priority: P3)

**Goal**: Generate shareable URLs with Open Graph metadata and embed codes

**Independent Test**: Get share metadata for a collection, verify OG tags, test embed code

### Implementation for User Story 5

- [ ] T055 [US5] Implement getShareMetadata method in `src/api/collection/collection.service.ts`
- [ ] T056 [US5] Add GET /collections/:id/share endpoint in `src/api/collection/collection.controller.ts`
- [ ] T057 [US5] Generate embed code HTML snippet in share metadata response
- [ ] T058 [US5] Add share metadata validator in `src/api/collection/collection.validator.ts`

**Checkpoint**: Collections can be shared via URL with proper metadata

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, data integrity, and cleanup

- [ ] T059 Implement cascading project deletion handler in `src/api/project/project.service.ts` to remove from collections
- [ ] T060 Implement orphaned collection handling on user deletion in `src/api/gallery/gallery.service.ts`
- [ ] T061 Add collection activity logging throughout service methods in `src/api/collection/collection.service.ts`
- [ ] T062 [P] Add input sanitization for collection title/description (XSS prevention)
- [ ] T063 [P] Add rate limiting to collection creation endpoints
- [ ] T064 Implement 30-day permanent deletion cleanup job for soft-deleted collections
- [ ] T065 Manual testing: Run through quickstart.md validation scenarios
- [ ] T066 Update API documentation with new collection endpoints

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (Admin) and US3 (Visitor) are both P1 and can run in parallel
  - US2 (Gallery User) is P2, can start after P1 or in parallel
  - US4 (Analytics) and US5 (Sharing) are P3, can start after core stories
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Admin CRUD foundation
- **User Story 3 (P1)**: Can start after Foundational - Public browsing (benefits from US1 data)
- **User Story 2 (P2)**: Can start after Foundational - Reuses patterns from US1
- **User Story 4 (P3)**: Requires US1+US3 for collections to track - Analytics layer
- **User Story 5 (P3)**: Requires US3 public endpoints - Sharing metadata

### Within Each User Story

- Repository methods before service methods
- Service methods before controllers
- Controllers before routers
- Routers before integration to main app

### Parallel Opportunities

- T003 and T004 (types and interfaces) can run in parallel
- T007, T008, T009 (MongoDB models) can run in parallel
- T010 and T011 (repository extensions) can run in parallel after models
- T024 and T025 (project management repos) can run in parallel
- T028 and T029 (search implementations) can run in parallel
- T044 and T045 (findByOwner repos) can run in parallel
- T053 and T054 (stats repos) can run in parallel

---

## Parallel Example: Phase 2 Foundation

```bash
# After T005 (migrations) and T006 (Collection model update):
# Launch MongoDB models in parallel:
Task: "Create CollectionProject MongoDB model in src/api/collection/collection-project.model.ts"
Task: "Create CollectionStats MongoDB model in src/api/collection/collection-stats.model.ts"
Task: "Create CollectionActivity MongoDB model in src/api/collection/collection-activity.model.ts"

# Then launch repository extensions in parallel:
Task: "Extend PostgreSQL repository with CRUD methods"
Task: "Extend MongoDB repository with CRUD methods"
Task: "Create authorization middleware"
Task: "Create collection validators"
```

---

## Parallel Example: User Story 1 (Admin)

```bash
# After foundational phase, launch admin module setup in parallel:
Task: "Create admin collection controller"
Task: "Create admin collection validator"
Task: "Create admin collection router"

# Then service methods sequentially:
Task: "Implement createSystemCollection method"
Task: "Implement addProject method"
# ...and so on
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 3)

1. Complete Phase 1: Setup (migrations, types)
2. Complete Phase 2: Foundational (models, repos, middleware)
3. Complete Phase 3: User Story 1 (Admin CRUD)
4. Complete Phase 4: User Story 3 (Public browsing)
5. **STOP and VALIDATE**: Admin can create collections, visitors can browse
6. Deploy/demo if ready - **This is the MVP!**

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US3 → Admin + Public browsing → Deploy (MVP!)
3. Add US2 → Gallery user collections → Deploy
4. Add US4 → Analytics tracking → Deploy
5. Add US5 → Sharing features → Deploy
6. Polish → Production ready

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Admin)
   - Developer B: User Story 3 (Public browsing)
3. After P1 stories:
   - Developer A: User Story 2 (Gallery users)
   - Developer B: User Story 4 (Analytics)
4. Final: User Story 5 (Sharing) + Polish

---

## Summary

| Phase | Story | Tasks | Description |
|-------|-------|-------|-------------|
| 1 | Setup | T001-T004 | Migrations, types, interfaces |
| 2 | Foundational | T005-T013 | Models, repos, middleware |
| 3 | US1 (P1) | T014-T025 | Admin collection management |
| 4 | US3 (P1) | T026-T033 | Public browsing & discovery |
| 5 | US2 (P2) | T034-T045 | Gallery user collections |
| 6 | US4 (P3) | T046-T054 | Analytics & statistics |
| 7 | US5 (P3) | T055-T058 | Sharing & embedding |
| 8 | Polish | T059-T066 | Edge cases, cleanup |

**Total Tasks**: 66
**MVP Tasks** (Setup + Foundation + US1 + US3): 33 tasks
**Suggested First Milestone**: Complete through Phase 4 for functional MVP

---

## Notes

- [P] tasks = different files, no dependencies within same phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Manual testing per quickstart.md scenarios
