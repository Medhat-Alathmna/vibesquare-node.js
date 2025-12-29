# Gallery Analysis History API

Base URL: `/api/gallery/analyze`

Authentication: All endpoints require `Authorization: Bearer <token>` header

---

## Data Structure

### Analysis Record

Each analysis saves the following data:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique analysis ID (e.g., "ga-abc123") |
| `userId` | string | Owner user ID |
| `url` | string | The analyzed URL |
| `prompt` | string | Full generated prompt result |
| `tokensUsed` | number | Tokens consumed for this analysis |
| `status` | enum | `pending` \| `processing` \| `completed` \| `failed` |
| `metadata` | object | Additional data (model, pageTitle, pageDescription) |
| `pageTitle` | string? | Extracted page title |
| `pageDescription` | string? | Extracted page description |
| `createdAt` | Date | When analysis was created |
| `completedAt` | Date? | When analysis completed |
| `deletedAt` | Date? | Soft delete timestamp |

---

## Endpoints

### 1. GET /history

Get paginated analysis history for the authenticated user.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number (min: 1) |
| `limit` | number | 20 | Items per page (min: 1, max: 100) |

**Request:**
```http
GET /api/gallery/analyze/history?page=1&limit=20
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "ga-abc123",
        "url": "https://example.com",
        "pageTitle": "Example Website",
        "pageDescription": "An example website description",
        "tokensUsed": 25000,
        "status": "completed",
        "createdAt": "2024-12-28T14:30:00.000Z",
        "completedAt": "2024-12-28T14:30:15.000Z"
      },
      {
        "id": "ga-def456",
        "url": "https://another-site.com",
        "pageTitle": "Another Site",
        "pageDescription": null,
        "tokensUsed": 18000,
        "status": "completed",
        "createdAt": "2024-12-27T10:15:00.000Z",
        "completedAt": "2024-12-27T10:15:12.000Z"
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### 2. GET /recent

Get recent analyses (quick access without pagination).

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 5 | Number of recent items (min: 1, max: 20) |

**Request:**
```http
GET /api/gallery/analyze/recent?limit=5
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ga-abc123",
      "url": "https://example.com",
      "pageTitle": "Example Website",
      "tokensUsed": 25000,
      "status": "completed",
      "createdAt": "2024-12-28T14:30:00.000Z"
    },
    {
      "id": "ga-def456",
      "url": "https://another-site.com",
      "pageTitle": "Another Site",
      "tokensUsed": 18000,
      "status": "completed",
      "createdAt": "2024-12-27T10:15:00.000Z"
    }
  ]
}
```

---

### 3. GET /:id

Get a specific analysis by ID with the full prompt.

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Analysis ID |

**Request:**
```http
GET /api/gallery/analyze/ga-abc123
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "ga-abc123",
    "userId": "gu-user123",
    "url": "https://example.com",
    "prompt": "# Design Analysis\n\nThis is a modern landing page with a clean hero section...\n\n## Layout\n- Header with navigation\n- Hero section with CTA\n- Features grid\n- Footer\n\n## Colors\n- Primary: #3B82F6\n- Background: #FFFFFF\n...",
    "tokensUsed": 25000,
    "status": "completed",
    "metadata": {
      "model": "gpt-4o-mini",
      "pageTitle": "Example Website",
      "pageDescription": "An example website description"
    },
    "pageTitle": "Example Website",
    "pageDescription": "An example website description",
    "createdAt": "2024-12-28T14:30:00.000Z",
    "completedAt": "2024-12-28T14:30:15.000Z"
  }
}
```

**Response (404):**
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Analysis not found"
}
```

---

### 4. DELETE /:id

Delete an analysis (soft delete).

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Analysis ID |

**Request:**
```http
DELETE /api/gallery/analyze/ga-abc123
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Analysis deleted successfully"
}
```

**Response (404):**
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Analysis not found"
}
```

---

## TypeScript Types

```typescript
// Analysis Status
type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Full Analysis Record
interface IGalleryAnalysis {
  id: string;
  userId: string;
  url: string;
  prompt?: string;
  tokensUsed: number;
  status: AnalysisStatus;
  metadata: {
    model?: string;
    pageTitle?: string;
    pageDescription?: string;
    [key: string]: any;
  };
  pageTitle?: string;
  pageDescription?: string;
  screenshotUrl?: string;
  createdAt: Date;
  completedAt?: Date;
  deletedAt?: Date;
}

// History Item (without full prompt)
interface AnalysisHistoryItem {
  id: string;
  url: string;
  pageTitle?: string;
  pageDescription?: string;
  tokensUsed: number;
  status: AnalysisStatus;
  createdAt: Date;
  completedAt?: Date;
}

// Paginated Response
interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

## Usage Examples

### Frontend: Display Analysis History

```typescript
// Fetch history
const response = await fetch('/api/gallery/analyze/history?page=1&limit=10', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();

// Display list
data.data.forEach(analysis => {
  console.log(`${analysis.pageTitle} - ${analysis.tokensUsed} tokens`);
});

// Pagination
console.log(`Page ${data.page} of ${data.totalPages}`);
```

### Frontend: View Full Analysis

```typescript
// Get full analysis with prompt
const response = await fetch(`/api/gallery/analyze/${analysisId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();

// Display prompt
document.getElementById('prompt-output').textContent = data.prompt;
```

### Frontend: Delete Analysis

```typescript
const response = await fetch(`/api/gallery/analyze/${analysisId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});

if (response.ok) {
  // Remove from UI
  removeAnalysisFromList(analysisId);
}
```

---

## Notes

1. **Soft Delete**: Deleted analyses are not permanently removed, they're marked with `deletedAt` timestamp
2. **Ownership**: Users can only access their own analyses
3. **History vs Recent**: Use `/history` for paginated browsing, `/recent` for dashboard widgets
4. **Prompt Size**: The `prompt` field can be large (several KB), only fetched in GET /:id
