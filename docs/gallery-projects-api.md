# Gallery Projects API Documentation (Public)

## Base URL
```
/api/projects
```

## Authentication
No authentication required for these endpoints.

---

## Endpoints

### 1. List Projects
```
GET /api/projects
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 12 | Items per page (max 50) |
| framework | string | - | Filter by framework |
| category | string | - | Filter by category |
| tags | string | - | Filter by tags (comma-separated) |
| sortBy | string | recent | Sort option |

**sortBy Options:**
- `recent` - الأحدث
- `popular` - الأكثر مشاهدة
- `mostLiked` - الأكثر إعجاباً
- `mostDownloaded` - الأكثر تحميلاً

**Example Request:**
```
GET /api/projects?page=1&limit=12&framework=React&category=Dashboard&sortBy=popular
```

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
        "shortDescription": "Short desc for cards",
        "thumbnail": "https://example.com/image.png",
        "screenshots": ["https://...", "https://..."],
        "demoUrl": "https://demo.example.com",
        "downloadUrl": "https://...",
        "prompt": {
          "text": "Create a...",
          "model": "gpt-4",
          "version": "1.0"
        },
        "framework": "React",
        "tags": ["responsive", "dark-mode"],
        "styles": ["modern", "minimal"],
        "category": "Dashboard",
        "likes": 150,
        "views": 1200,
        "downloads": 45,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "builder": {
          "userId": "user-id",
          "name": "John Doe",
          "avatarUrl": "https://..."
        },
        "builderSocialLinks": {
          "github": "https://github.com/johndoe",
          "twitter": "https://twitter.com/johndoe"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 12,
      "total": 100,
      "totalPages": 9,
      "hasMore": true
    }
  },
  "message": "Projects retrieved successfully"
}
```

---

### 2. Search Projects
```
GET /api/projects/search
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| q | string | - | Search query (min 2 chars) |
| frameworks | string | - | Filter by frameworks (comma-separated) |
| categories | string | - | Filter by categories (comma-separated) |
| tags | string | - | Filter by tags (comma-separated) |
| sortBy | string | recent | Sort option |
| page | number | 1 | Page number |
| limit | number | 12 | Items per page (max 50) |

**Example Request:**
```
GET /api/projects/search?q=dashboard&frameworks=React,Vue&categories=Dashboard,Admin Panel&sortBy=popular
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "projects": [...],
    "pagination": {
      "page": 1,
      "limit": 12,
      "total": 25,
      "totalPages": 3,
      "hasMore": true
    }
  },
  "message": "Search completed successfully"
}
```

---

### 3. Get Project by ID
```
GET /api/projects/:id
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Project UUID |

**Example Request:**
```
GET /api/projects/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Modern Dashboard",
    "description": "A fully responsive admin dashboard built with React and Tailwind CSS...",
    "shortDescription": "Modern admin dashboard with dark mode",
    "thumbnail": "https://example.com/thumbnail.png",
    "screenshots": [
      "https://example.com/screen1.png",
      "https://example.com/screen2.png"
    ],
    "demoUrl": "https://demo.example.com",
    "downloadUrl": "https://download.example.com/project.zip",
    "prompt": {
      "text": "Create a modern admin dashboard with sidebar navigation, charts, and dark mode support",
      "model": "gpt-4",
      "version": "1.0",
      "parameters": {}
    },
    "framework": "React",
    "tags": ["responsive", "dark-mode", "tailwind", "charts"],
    "styles": ["modern", "minimal", "glassmorphism"],
    "category": "Dashboard",
    "likes": 150,
    "views": 1200,
    "downloads": 45,
    "codeFiles": [
      {
        "filename": "App.tsx",
        "language": "typescript",
        "content": "import React from 'react'...",
        "path": "src/App.tsx"
      },
      {
        "filename": "Dashboard.tsx",
        "language": "typescript",
        "content": "...",
        "path": "src/components/Dashboard.tsx"
      }
    ],
    "builder": {
      "userId": "user-123",
      "name": "John Doe",
      "avatarUrl": "https://example.com/avatar.png"
    },
    "builderSocialLinks": {
      "github": "https://github.com/johndoe",
      "twitter": "https://twitter.com/johndoe",
      "linkedin": "https://linkedin.com/in/johndoe",
      "portfolio": "https://johndoe.dev"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T00:00:00.000Z"
  },
  "message": "Project retrieved successfully"
}
```

---

### 4. Record View
```
POST /api/projects/:id/view
```

**Description:** Increment view counter for a project.

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "views": 1201
  },
  "message": "View recorded"
}
```

---

### 5. Record Like
```
POST /api/projects/:id/like
```

**Description:** Increment like counter for a project.

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "likes": 151
  },
  "message": "Like recorded"
}
```

---

### 6. Record Download
```
POST /api/projects/:id/download
```

**Description:** Increment download counter for a project.

**Response:**
```json
{
  "statusCode": 200,
  "data": {
    "downloads": 46
  },
  "message": "Download recorded"
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

### SortOption
```typescript
type SortOption = 'recent' | 'popular' | 'mostLiked' | 'mostDownloaded';
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

interface Project {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  screenshots: string[];
  demoUrl?: string;
  downloadUrl?: string;
  prompt: Prompt;
  framework: Framework;
  tags: string[];
  styles: string[];
  category: Category;
  likes: number;
  views: number;
  downloads: number;
  codeFiles: CodeFile[];
  builder?: Builder;
  builderSocialLinks?: BuilderSocialLinks;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface ProjectsResponse {
  projects: Project[];
  pagination: Pagination;
}
```

---

## Error Responses

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Project not found",
  "success": false
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation error",
  "success": false
}
```
