# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

**Development**
- `npm run dev` - Start development server with hot-reload (ts-node-dev)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled server

**Database**
- `npm run migrate:latest` - Apply pending migrations
- `npm run migrate:status` - Check migration status
- `npm run migrate:rollback` - Revert last migration
- `npm run migrate:make <name>` - Create new migration
- `npm run seed` - Seed database with initial data
- `npm run seed:auth` - Seed authentication-related data
- `npm run seed:all` - Run all seeds

**Entry Point**
- `src/server.ts` - Main server entry point
- `src/app.ts` - Express app configuration

## Architecture Overview

### High-Level Structure

This is a sophisticated Node.js/TypeScript backend for an AI-powered code generation platform. The codebase follows a modular, layered architecture:

```
src/
├── api/                    # API modules (organized by feature)
├── config/                 # Centralized configuration
├── middleware/             # Express middleware chain
├── jobs/                   # Background jobs (quota reset)
├── shared/
│   ├── repositories/       # Database access layer (dual-mode: PostgreSQL/MongoDB)
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
└── server.ts              # Entry point
```

### Core Architectural Patterns

#### 1. **API Module Structure**
Each API module follows a consistent pattern:
- `*.router.ts` - Route definitions with middleware
- `*.controller.ts` - Request handlers (wraps errors with asyncHandler)
- `*.service.ts` - Business logic
- `*.validator.ts` - Joi schema validation
- `*.types.ts` - TypeScript interfaces
- `services/` - Specialized service classes
- `models/` - MongoDB models (if applicable)

Example: `/api/auth/`, `/api/project/`, `/api/analyze/`

#### 2. **Repository Pattern (Database Abstraction)**
- **Interface-based**: Define `IProjectRepository` interface
- **Dual-database support**: PostgreSQL primary, MongoDB fallback via `DB_TYPE` env variable
- **Implementations**: `PostgresProjectRepository`, `MongoDBProjectRepository`
- **Usage**: Get repository via `getProjectRepository()` helper function
- **Connection pooling**: Lazy initialization for PostgreSQL connections
- **DTO mapping**: Mapper functions convert database rows to DTOs

Key files:
- `src/shared/repositories/interfaces.ts` - All repository interfaces
- `src/shared/repositories/postgres/` - PostgreSQL implementations
- `src/shared/repositories/mongodb/` - MongoDB implementations

#### 3. **Middleware Chain (Authentication & Authorization)**
Applied per route in routers:

```typescript
// Basic authentication
authenticate(required: boolean) // JWT verification with optional flag

// Role & permission based
requireAdminAccess() // Admin panel only
requireRole(roleName: string) // Single role check
requirePermission(permissions: string[], requireAll?: boolean) // Fine-grained permissions
requireSubscription(tiers: string[]) // Subscription tier validation
requireEmailVerified() // Email verification check
```

Implementation: `src/middleware/auth.middleware.ts`

#### 4. **Error Handling & Responses**
- **Error converter**: Normalizes all errors to `ApiError` class
- **Consistent responses**:
  ```typescript
  // Success: { success: true, statusCode: 200, data: {...}, message: "..." }
  // Error: { success: false, statusCode: 400, message: "...", stack: "..." }
  ```
- **Controller pattern**: Wrap async functions with `asyncHandler` to catch errors
- **Global handler**: `error.middleware.ts` catches all uncaught errors

Utilities:
- `src/shared/utils/response.ts` - ApiResponse, ApiError classes
- `src/shared/utils/asyncHandler.ts` - Express async error wrapper

#### 5. **Request Validation**
- Use Joi schema validators
- Validation middleware: `validate(schema)` middleware checks body/query/params
- Place validators in `{module}.validator.ts` files
- Apply in router: `router.post('/', validate(createSchema), controller.method)`

#### 6. **Configuration & Environment**
- **Runtime validation**: `src/config/env.ts` validates all env vars with Joi
- **Supported vars**: DB_TYPE, JWT_SECRET, DATABASE_URL, AWS keys, OpenAI keys, SendGrid, Stripe, etc.
- **Key insight**: Environment is validated at server startup, so all services can trust env values are valid

### Critical Modules & Their Responsibilities

#### **Authentication** (`/api/auth`)
- JWT token management (access + refresh tokens)
- Email verification flow
- Password reset with secure tokens
- Rate limiting: 5 attempts/15 minutes on auth endpoints
- Services: `auth.service.ts`, `token.service.ts`, `email.service.ts`, `password.service.ts`

#### **Analyze** (`/api/analyze`) - Multi-Pipeline AI Architecture
Three analysis versions with increasing complexity:

1. **V1** (`v1/`) - Simple LLM analysis
   - Single LLM call to analyze URL
   - Basic output

2. **V2** (`v2/`) - Multi-Agent Visual Analysis (LangGraph orchestrated)
   - Agents (parallel execution in graph):
     - Layout Analyzer
     - Component Identifier
     - Design System Extractor
     - Conflict Resolver
     - Prompt Synthesizer
   - Outputs: Structured design analysis
   - Config: `src/api/analyze/v2/core/agent-config.ts`

3. **V2.5** (`v2-5/`) - Technical + Visual Architecture Analysis
   - Generates PRD with architecture recommendations
   - **Technical agents** (layered approach):
     - **Layer 0**: Identity agent (identifies tech stack)
     - **Layer 1**: Database agent
     - **Layer 2**: Backend, Security, Testing, DevOps agents (parallel)
     - **Layer 3**: PRD Validator, QA Agent (sequential with iteration)
   - **Visual agents**: UI/UX analysis
   - Outputs: Database schema, backend architecture, security recommendations, PRD markdown

Key files:
- `src/api/analyze/technical/core/technical-agent-config.ts` - Agent definitions
- `src/api/analyze/technical/agents/` - Individual agent implementations
- `src/api/analyze/v2-5/prd-synthesizer.ts` - PRD generation

#### **Gallery** (`/api/gallery`)
- User profiles and authentication
- Favorites management
- Token quota tracking (tracks LLM token usage per user)
- Subscription tier management
- Gallery-specific analysis endpoints

#### **Admin** (`/api/admin`)
- User management and role assignment
- RBAC permission matrix system
- Project moderation
- Gallery user administration

#### **Projects & Collections** (`/api/project`, `/api/collection`)
- Full CRUD for design projects
- Category relationships (many-to-many mappings)
- Search with pagination and filtering
- Stats tracking (views, likes, downloads)

#### **File Upload** (`/api/upload`)
- S3 integration with presigned URLs
- Multer + Multer-S3 for streaming uploads
- File validation and categorization

### Database Layer

**Dual-Database Architecture:**
- Set via `DB_TYPE` environment variable (defaults to PostgreSQL)
- PostgreSQL: Primary production database
  - Connection pooling with `pg` driver
  - Knex for migrations and query building
  - SSL support for production
- MongoDB: Alternative/fallback option
  - Mongoose for schema management
  - Full ODM capabilities

**Key Files:**
- `src/config/database.ts` - Connection setup
- `knexfile.ts` - Migration configuration
- `migrations/` - SQL migration files
- `src/shared/repositories/` - DAO layer

**Running Migrations:**
- `npm run migrate:latest` - Apply all pending migrations
- `npm run migrate:make <name>` - Create new migration (generates TypeScript file in `migrations/`)

### Background Jobs

**Quota Reset Job** (`src/jobs/quota-reset.job.ts`)
- Scheduled job to reset user token quotas
- Configured in server startup
- Runs at configured intervals

### Key Dependencies & Their Purpose

**Core Framework**
- `express` 5.2.1 - Web framework
- `typescript` 5.9.3 - Type safety

**Database**
- `pg` - PostgreSQL client
- `mongoose` - MongoDB ODM
- `knex` - Query builder & migrations

**Authentication & Security**
- `jsonwebtoken` - JWT implementation
- `bcrypt` - Password hashing (10-14 rounds configurable)
- `helmet` - Security headers
- `cors` - CORS with credentials support
- `express-rate-limit` - Rate limiting

**AI/LLM Integration**
- `@langchain/core` - LangChain base
- `@langchain/langgraph` - Multi-agent orchestration
- `@langchain/openai` - OpenAI integration
- `@langchain/google-genai` - Google Generative AI
- `@google/generative-ai` - Direct Google AI API
- `openai` - OpenAI SDK
- `ioredis` - Redis for state management

**Validation & Types**
- `joi` - Schema validation
- `zod` - Type validation (alternative)

**File Handling & Cloud**
- `aws-sdk` - S3 integration
- `multer` + `multer-s3` - File upload handling
- `@toon-format/toon` - Compression for analysis output

**Utilities**
- `morgan` - HTTP logging
- `compression` - Response compression
- `cookie-parser` - Cookie handling
- `dotenv` - Environment loading

## Important Implementation Details

### Handling Database Selection
When working with database operations, always check how the code uses the repository pattern:

```typescript
// Good: Uses abstraction layer
const repo = getProjectRepository();
const projects = await repo.findAll(options);

// This automatically routes to PostgreSQL or MongoDB based on DB_TYPE
```

When adding new database features:
1. Define interface in `src/shared/repositories/interfaces.ts`
2. Implement for both PostgreSQL and MongoDB
3. Export via factory function

### Quota/Token Tracking
- Gallery users have token quotas (tracks LLM API usage)
- Used by analyze endpoints to rate-limit API calls
- Reset via background job at configured intervals
- Check `src/api/gallery/quota.service.ts`

### AI Agent Architecture (V2.5)
The technical analysis pipeline uses a layered agent approach:
- **Layer 0** identifies the technology stack
- **Layer 1** infers database structure
- **Layer 2** runs 4 agents in parallel (Backend, Security, Testing, DevOps)
- **Layer 3** validates PRD and performs QA with iteration

This is orchestrated via LangGraph state machine. Examine `src/api/analyze/v2-5/` for the full flow.

### Email & Communication
- SendGrid for transactional emails
- Password reset, email verification tokens use signed JWTs
- Token expiration configurable via env vars

### Rate Limiting
- Global: 100 requests / 15 minutes
- Auth endpoints: 5 attempts / 15 minutes
- Configured in `src/app.ts` and individual routers
- Uses `express-rate-limit`

### CORS Configuration
- Credentials allowed (for authentication cookies)
- Configurable allowed origins via `src/config/cors.ts`
- Set via environment variables

## Common Development Tasks

**Adding a New API Endpoint:**
1. Create module folder in `src/api/{module}/`
2. Create `{module}.router.ts` with route definitions
3. Create `{module}.controller.ts` with request handlers (use asyncHandler)
4. Create `{module}.service.ts` with business logic
5. Create `{module}.validator.ts` with Joi schemas
6. Create `{module}.types.ts` with TypeScript interfaces
7. Register router in `src/app.ts`

**Adding Database Access:**
1. Add interface to `src/shared/repositories/interfaces.ts`
2. Implement in `PostgresProjectRepository` and `MongoDBProjectRepository`
3. Use factory function: `getProjectRepository()` in services

**Debugging LLM Agent Pipelines:**
- Enable debug logging via environment variable
- Check `src/api/analyze/v2-5/` for state transitions
- Use LangGraph visualization tools for agent flow
- Review `@toon-format/toon` compression data for detailed analysis outputs

**TypeScript Compilation:**
- `npm run build` compiles to `dist/`
- Check `tsconfig.json` for strict mode and target settings
- Target: ES2022

## Git Branch Information

- Current branch: `test`
- Main branch: `main`
- Use main for PRs

## Notes for Future Development

1. **Strict TypeScript**: Project uses strict mode - all types must be explicit
2. **Error-First Design**: Always wrap async route handlers with `asyncHandler`
3. **Repository Pattern**: Never query database directly in services - always use repository abstractions
4. **Validation First**: Validate all external inputs with Joi before processing
5. **Environment-Driven**: Trust that environment variables are valid (validated at startup)
6. **Consistent Response Format**: Always use ApiResponse and ApiError classes for consistent API responses
7. **Dual-Database Awareness**: When modifying repositories, implement changes for both PostgreSQL and MongoDB
