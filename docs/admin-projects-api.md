# Admin Projects API Documentation

## Base URL
```
/api/admin/projects
```

## Authentication
All endpoints require:
- Bearer token in Authorization header
- Admin panel access
- Specific permission for each endpoint

---

## Endpoints

### 1. List Projects
```
GET /api/admin/projects
```

**Permission Required:** `projects.read`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |
| search | string | - | Search in title/description |
| framework | string | - | Filter by framework |
| category | string | - | Filter by category |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "title": "Project Title",
        "description": "Full description",
        "shortDescription": "Short desc",
        "thumbnail": "https://...",
        "screenshots": ["https://..."],
        "demoUrl": "https://...",
        "downloadUrl": "https://...",
        "prompt": {
          "text": "Create a...",
          "model": "gpt-4",
          "version": "1.0",
          "parameters": {}
        },
        "framework": "React",
        "tags": ["responsive", "dark-mode"],
        "styles": ["modern", "minimal"],
        "category": "Dashboard",
        "likes": 0,
        "views": 0,
        "downloads": 0,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "builder": {
          "userId": "user-id",
          "name": "John Doe",
          "avatarUrl": "https://..."
        },
        "builderSocialLinks": {
          "github": "https://github.com/...",
          "twitter": "https://twitter.com/...",
          "linkedin": "https://linkedin.com/...",
          "portfolio": "https://..."
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasMore": true
    }
  },
  "message": "Success"
}
```

---

### 2. Get Project by ID
```
GET /api/admin/projects/:id
```

**Permission Required:** `projects.read`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Project UUID |

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "title": "Project Title",
    "description": "Full description",
    "shortDescription": "Short desc",
    "thumbnail": "https://...",
    "screenshots": ["https://..."],
    "demoUrl": "https://...",
    "downloadUrl": "https://...",
    "prompt": {
      "text": "Create a...",
      "model": "gpt-4"
    },
    "framework": "React",
    "tags": ["responsive"],
    "styles": ["modern"],
    "category": "Dashboard",
    "likes": 10,
    "views": 100,
    "downloads": 5,
    "codeFiles": [
      {
        "filename": "App.tsx",
        "language": "typescript",
        "content": "...",
        "path": "src/App.tsx"
      }
    ],
    "builder": {
      "userId": "user-id",
      "name": "John Doe",
      "avatarUrl": "https://..."
    },
    "builderSocialLinks": {
      "github": "https://github.com/..."
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Success"
}
```

---

### 3. Create Project
```
POST /api/admin/projects
```

**Permission Required:** `projects.create`

**Request Body:**
```json
{
  "title": "My Project",
  "description": "Full description of the project...",
  "shortDescription": "Short description for cards",
  "thumbnail": "https://example.com/image.png",
  "screenshots": ["https://example.com/screen1.png", "https://example.com/screen2.png"],
  "demoUrl": "https://demo.example.com",
  "downloadUrl": "https://download.example.com/project.zip",
  "prompt": {
    "text": "Create a modern dashboard with...",
    "model": "gpt-4",
    "version": "1.0",
    "parameters": {}
  },
  "framework": "React",
  "tags": ["responsive", "dark-mode", "tailwind"],
  "styles": ["modern", "minimal"],
  "category": "Dashboard",
  "codeFiles": [
    {
      "filename": "App.tsx",
      "language": "typescript",
      "content": "import React from 'react'...",
      "path": "src/App.tsx"
    }
  ],
  "builder": {
    "userId": "optional-gallery-user-id",
    "name": "John Doe",
    "avatarUrl": "https://example.com/avatar.png"
  },
  "builderSocialLinks": {
    "github": "https://github.com/johndoe",
    "twitter": "https://twitter.com/johndoe",
    "linkedin": "https://linkedin.com/in/johndoe",
    "portfolio": "https://johndoe.com"
  }
}
```

**Required Fields:**
- `title` (string, 1-200 chars)
- `description` (string)
- `shortDescription` (string, 1-500 chars)
- `thumbnail` (string, valid URL)
- `prompt` (object with `text` and `model`)
- `framework` (enum: Angular, React, Vue, Svelte, Next.js, Nuxt.js, Vanilla)
- `category` (enum: Dashboard, Landing Page, E-commerce, Portfolio, Blog, Admin Panel, SaaS, Other)

**Optional Fields:**
- `screenshots` (array of URLs)
- `demoUrl` (string, valid URL)
- `downloadUrl` (string, valid URL)
- `tags` (array of strings)
- `styles` (array of strings)
- `codeFiles` (array of code file objects)
- `builder` (object)
- `builderSocialLinks` (object)

**Response (201 Created):**
```json
{
  "statusCode": 201,
  "data": {
    "id": "generated-uuid",
    "title": "My Project",
    "likes": 0,
    "views": 0,
    "downloads": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Project created successfully"
}
```

---

### 4. Update Project
```
PATCH /api/admin/projects/:id
```

**Permission Required:** `projects.update`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Project UUID |

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "shortDescription": "Updated short desc",
  "thumbnail": "https://new-image.com/img.png",
  "screenshots": ["https://..."],
  "demoUrl": "https://...",
  "downloadUrl": "https://...",
  "prompt": {
    "text": "Updated prompt...",
    "model": "gpt-4"
  },
  "framework": "Vue",
  "tags": ["new-tag"],
  "styles": ["new-style"],
  "category": "Portfolio",
  "codeFiles": [],
  "builder": {
    "name": "Jane Doe"
  },
  "builderSocialLinks": {
    "github": "https://github.com/janedoe"
  }
}
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "title": "Updated Title",
    "updatedAt": "2024-01-02T00:00:00.000Z"
  },
  "message": "Project updated successfully"
}
```

---

### 5. Delete Project
```
DELETE /api/admin/projects/:id
```

**Permission Required:** `projects.delete`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Project UUID |

**Response:**
```json
{
  "statusCode": 200,
  "data": null,
  "message": "Project deleted successfully"
}
```

---

## Enums

### Framework
```typescript
type Framework = 'Angular' | 'React' | 'Vue' | 'Svelte' | 'Next.js' | 'Nuxt.js' | 'Vanilla';
```

### Category
```typescript
type Category = 'Dashboard' | 'Landing Page' | 'E-commerce' | 'Portfolio' | 'Blog' | 'Admin Panel' | 'SaaS' | 'Other';
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation error message",
  "success": false
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Authentication required",
  "success": false
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "success": false
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Project not found",
  "success": false
}
```

---

## TypeScript Interfaces

```typescript
interface Builder {
  userId?: string;
  name: string;
  avatarUrl?: string;
}

interface BuilderSocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  portfolio?: string;
}

interface Prompt {
  text: string;
  model: string;
  version?: string;
  parameters?: Record<string, any>;
}

interface CodeFile {
  filename: string;
  language: string;
  content: string;
  path?: string;
}

interface CreateProjectDTO {
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  screenshots?: string[];
  demoUrl?: string;
  downloadUrl?: string;
  prompt: Prompt;
  framework: Framework;
  tags?: string[];
  styles?: string[];
  category: Category;
  codeFiles?: CodeFile[];
  builder?: Builder;
  builderSocialLinks?: BuilderSocialLinks;
}

interface UpdateProjectDTO {
  title?: string;
  description?: string;
  shortDescription?: string;
  thumbnail?: string;
  screenshots?: string[];
  demoUrl?: string;
  downloadUrl?: string;
  prompt?: Prompt;
  framework?: Framework;
  tags?: string[];
  styles?: string[];
  category?: Category;
  codeFiles?: CodeFile[];
  builder?: Builder;
  builderSocialLinks?: BuilderSocialLinks;
}
```
