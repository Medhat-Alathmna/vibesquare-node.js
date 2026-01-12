# Implementation Plan: Collection Concept

**Branch**: `001-collection-concept` | **Date**: 2026-01-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-collection-concept/spec.md`

## Summary

Implement a comprehensive Collection system that enables both admin users and gallery users to create, manage, and share curated groups of projects. The feature extends the existing minimal collection implementation with ownership models, visibility controls, analytics, search/discovery, and cloning capabilities. The technical approach leverages the existing dual-database repository pattern (PostgreSQL/MongoDB), Express REST API structure, and authentication systems.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node.js (ES2022 target)
**Primary Dependencies**: Express 5.2.1, Mongoose 9.0.1, pg 8.16.3, Joi 18.0.2, Zod 4.3.5
**Storage**: PostgreSQL (primary), MongoDB (alternative via DB_TYPE env)
**Testing**: Manual testing (no test framework configured - recommend adding Jest)
**Target Platform**: Linux server (Node.js API backend)
**Project Type**: Web application (backend API only)
**Performance Goals**: 2 second page load for collection browse (SC-002), 10,000 concurrent users (SC-006)
**Constraints**: <60 seconds to create collection and add first project (SC-001)
**Scale/Scope**: 100 projects per collection max, 50-200 collections per gallery user (tier-based)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: No project-specific constitution defined (template only). Proceeding with standard best practices.

**Applied Principles**:
- Repository Pattern: Already in use - extend for new collection features
- Dual-database support: Maintain PostgreSQL + MongoDB implementations
- Existing authentication: Leverage admin and gallery user auth systems
- API consistency: Follow existing Express router/controller/service patterns

## Project Structure

### Documentation (this feature)

```text
specs/001-collection-concept/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── api/
│   ├── collection/                    # Existing - to be extended
│   │   ├── collection.model.ts        # Existing MongoDB model - extend
│   │   ├── collection.service.ts      # Existing - extend with CRUD, clone, stats
│   │   ├── collection.controller.ts   # Existing - extend with new endpoints
│   │   ├── collection.validator.ts    # Existing - extend with new validations
│   │   ├── collection.router.ts       # Existing - extend with new routes
│   │   └── collection.types.ts        # NEW: TypeScript interfaces/DTOs
│   ├── admin/
│   │   └── collections/               # NEW: Admin collection management
│   │       ├── admin-collection.controller.ts
│   │       ├── admin-collection.router.ts
│   │       └── admin-collection.validator.ts
│   └── gallery/
│       └── collections/               # NEW: Gallery user collection endpoints
│           ├── gallery-collection.controller.ts
│           ├── gallery-collection.router.ts
│           └── gallery-collection.validator.ts
├── shared/
│   ├── repositories/
│   │   ├── interfaces.ts              # Extend ICollectionRepository
│   │   ├── postgres/
│   │   │   └── collection.repository.ts  # Extend with new methods
│   │   └── mongodb/
│   │       └── collection.repository.ts  # Extend with new methods
│   ├── middleware/
│   │   └── collection-auth.middleware.ts # NEW: Collection access control
│   └── types/
│       └── collection.types.ts        # NEW: Shared collection types

migrations/
├── 004_enhance_collections_table.sql  # NEW: Add ownership, visibility, soft-delete
└── 005_create_collection_stats.sql    # NEW: Analytics tables
```

**Structure Decision**: Extend existing single-project backend structure. Collection feature spans admin API (system-owned collections), gallery API (user-owned collections), and public API (discovery/viewing). Repository pattern maintained for dual-database support.

## Complexity Tracking

> No constitution violations identified. Standard feature extension within existing architecture.

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| Extend existing collection module | Builds on existing foundation | New module would duplicate code |
| Junction table for collection-projects | Enables ordering, metadata per membership | Array field limits flexibility |
| Separate stats table | Decouples analytics from core entity | Embedded stats adds write contention |
