# Admin Panel - Quota Management Endpoints

Base URL: `/api/admin/gallery-users`

Authentication: All endpoints require `Authorization: Bearer <token>` header (Admin Panel JWT with admin permissions)

---

## 1. Get User's Token Quota

### GET /admin/gallery-users/:id/quota

Get detailed quota information for a specific user.

**Request:**
```
GET /api/admin/gallery-users/user_123/quota
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "tier": "free",
    "quota": {
      "limit": 100000,
      "used": 67500,
      "remaining": 32500,
      "usagePercentage": 67.5,
      "periodStart": "2024-12-22T00:00:00.000Z",
      "periodEnd": "2024-12-29T00:00:00.000Z"
    },
    "stats": {
      "totalTokensUsed": 450000,
      "analysisCount": 18,
      "lastAnalysisAt": "2024-12-28T14:30:00.000Z"
    }
  }
}
```

**Permission Required:** `gallery_users.read`

---

## 2. Get User's Quota History

### GET /admin/gallery-users/:id/quota/history

Get paginated token transaction history for a user.

**Request:**
```
GET /api/admin/gallery-users/user_123/quota/history?page=1&limit=50
Authorization: Bearer <admin_token>
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page (max 100) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "gtt-abc123",
        "userId": "user_123",
        "type": "analysis",
        "tokensAmount": -25000,
        "tokensBefore": 57500,
        "tokensAfter": 32500,
        "analysisUrl": "https://example.com",
        "description": "Analysis of https://example.com",
        "metadata": {},
        "createdAt": "2024-12-28T14:30:00.000Z"
      },
      {
        "id": "gtt-def456",
        "userId": "user_123",
        "type": "bonus",
        "tokensAmount": 10000,
        "tokensBefore": 47500,
        "tokensAfter": 57500,
        "description": "Bonus tokens: Promotional bonus",
        "metadata": {},
        "createdAt": "2024-12-27T10:00:00.000Z"
      },
      {
        "id": "gtt-ghi789",
        "userId": "user_123",
        "type": "reset",
        "tokensAmount": 0,
        "tokensBefore": 85000,
        "tokensAfter": 0,
        "description": "Admin reset: Customer support request",
        "metadata": {},
        "createdAt": "2024-12-22T00:00:00.000Z"
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

**Transaction Types:**
- `analysis` - Tokens deducted for analysis (negative amount)
- `bonus` - Bonus tokens added by admin (positive amount)
- `reset` - Weekly quota reset (amount is 0)

**Permission Required:** `gallery_users.read`

---

## 3. Reset User's Quota

### POST /admin/gallery-users/:id/quota/reset

Manually reset a user's token quota to 0 used and start a new 7-day period.

**Request:**
```
POST /api/admin/gallery-users/user_123/quota/reset
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "Customer support request"
}
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| reason | string | Yes | Reason for reset (1-500 chars) |

**Response (200):**
```json
{
  "success": true,
  "message": "Quota reset successfully",
  "data": {
    "message": "Quota reset successfully",
    "newQuota": {
      "limit": 100000,
      "used": 0,
      "remaining": 100000,
      "periodEnd": "2025-01-04T00:00:00.000Z"
    }
  }
}
```

**Permission Required:** `gallery_users.manage`

---

## 4. Add Bonus Tokens

### POST /admin/gallery-users/:id/quota/add-tokens

Add bonus tokens to a user's quota (reduces their used count).

**Request:**
```
POST /api/admin/gallery-users/user_123/quota/add-tokens
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "amount": 50000,
  "reason": "Compensation for service issue"
}
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | Yes | Tokens to add (1-1,000,000) |
| reason | string | Yes | Reason for bonus (1-500 chars) |

**Response (200):**
```json
{
  "success": true,
  "message": "50,000 tokens added successfully",
  "data": {
    "message": "50,000 tokens added successfully",
    "newQuota": {
      "limit": 100000,
      "used": 17500,
      "remaining": 82500,
      "bonusAdded": 50000
    }
  }
}
```

**Permission Required:** `gallery_users.manage`

---

## 5. Get Quota Statistics

### GET /admin/gallery-users/quota-statistics

Get aggregated quota statistics across all users.

**Request:**
```
GET /api/admin/gallery-users/quota-statistics
Authorization: Bearer <admin_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalTokensUsed": 45000000,
      "totalAnalyses": 1800,
      "averageTokensPerAnalysis": 25000
    },
    "byTier": {
      "free": {
        "users": 1350,
        "totalTokensUsed": 25000000,
        "averageUsagePercent": 45.5,
        "quotaExceededCount": 120
      },
      "pro": {
        "users": 150,
        "totalTokensUsed": 20000000,
        "averageUsagePercent": 35.2,
        "quotaExceededCount": 5
      }
    },
    "topUsers": [
      {
        "userId": "user_789",
        "username": "power_user",
        "tier": "pro",
        "tokensUsed": 380000,
        "analysisCount": 15
      },
      {
        "userId": "user_456",
        "username": "active_dev",
        "tier": "free",
        "tokensUsed": 98000,
        "analysisCount": 4
      }
    ]
  }
}
```

**Permission Required:** `gallery_users.read`

---

## 6. Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Amount must be positive"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You do not have permission to perform this action"
}
```

### 404 Not Found
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Gallery user not found"
}
```

---

## 7. UI Components Needed

### User Quota Card
```
+----------------------------------------------------------+
|  Token Quota                                    [Actions] |
|                                                           |
|  Tier: FREE (100K/week)                                  |
|                                                           |
|  Usage: [===================>          ] 67.5%           |
|         67,500 / 100,000 tokens                          |
|                                                           |
|  Period: Dec 22 - Dec 29, 2024                          |
|  Resets in: 2 days 5 hours                              |
|                                                           |
|  Stats:                                                  |
|  - Total Tokens Used: 450,000                           |
|  - Analysis Count: 18                                    |
|  - Last Analysis: Dec 28, 2024 14:30                    |
|                                                           |
|  [Reset Quota]  [Add Bonus Tokens]                      |
+----------------------------------------------------------+
```

### Quota History Table
```
+--------+----------+---------+--------+--------+---------------------------+
| Date   | Type     | Amount  | Before | After  | Description               |
+--------+----------+---------+--------+--------+---------------------------+
| Dec 28 | Analysis | -25,000 | 57,500 | 32,500 | Analysis of example.com   |
| Dec 27 | Bonus    | +10,000 | 47,500 | 57,500 | Promotional bonus         |
| Dec 22 | Reset    |    0    | 85,000 |    0   | Admin reset: Support req  |
+--------+----------+---------+--------+--------+---------------------------+
```

### Reset Quota Modal
```
+------------------------------------------+
|  Reset User Quota                        |
|                                          |
|  This will:                              |
|  - Set used tokens to 0                  |
|  - Start a new 7-day period              |
|                                          |
|  Reason: [________________________]      |
|                                          |
|  [Cancel]              [Reset Quota]     |
+------------------------------------------+
```

### Add Bonus Tokens Modal
```
+------------------------------------------+
|  Add Bonus Tokens                        |
|                                          |
|  Current Usage: 67,500 / 100,000         |
|                                          |
|  Amount: [50000_______] tokens           |
|                                          |
|  Reason: [________________________]      |
|                                          |
|  Preview: 67,500 - 50,000 = 17,500 used |
|                                          |
|  [Cancel]              [Add Tokens]      |
+------------------------------------------+
```

### Dashboard Statistics Widget
```
+----------------------------------------------------------+
|  Quota Statistics Overview                               |
+----------------------------------------------------------+
|                                                          |
|  +----------------+ +----------------+ +----------------+ |
|  | Total Tokens   | | Total Analyses | | Avg Per        | |
|  | 45.2M          | | 1,800          | | Analysis       | |
|  |                | |                | | 25K            | |
|  +----------------+ +----------------+ +----------------+ |
|                                                          |
|  By Tier:                                                |
|  +---------------------------+ +------------------------+ |
|  | FREE                      | | PRO                    | |
|  | Users: 1,350              | | Users: 150             | |
|  | Tokens: 25M               | | Tokens: 20M            | |
|  | Avg Usage: 45.5%          | | Avg Usage: 35.2%       | |
|  | Exceeded: 120             | | Exceeded: 5            | |
|  +---------------------------+ +------------------------+ |
|                                                          |
|  Top Users by Token Usage:                               |
|  1. power_user (PRO) - 380K tokens, 15 analyses         |
|  2. active_dev (FREE) - 98K tokens, 4 analyses          |
|  3. ...                                                  |
+----------------------------------------------------------+
```

---

## 8. Summary Table

| Endpoint | Method | Description | Permission |
|----------|--------|-------------|------------|
| `/admin/gallery-users/:id/quota` | GET | Get user quota | gallery_users.read |
| `/admin/gallery-users/:id/quota/history` | GET | Get quota history | gallery_users.read |
| `/admin/gallery-users/:id/quota/reset` | POST | Reset quota | gallery_users.manage |
| `/admin/gallery-users/:id/quota/add-tokens` | POST | Add bonus tokens | gallery_users.manage |
| `/admin/gallery-users/quota-statistics` | GET | Get all statistics | gallery_users.read |

---

## 9. TypeScript Types (for Frontend)

```typescript
// Quota Status Response
interface QuotaResponse {
  userId: string;
  tier: 'free' | 'pro';
  quota: {
    limit: number;
    used: number;
    remaining: number;
    usagePercentage: number;
    periodStart: string; // ISO date
    periodEnd: string; // ISO date
  };
  stats: {
    totalTokensUsed: number;
    analysisCount: number;
    lastAnalysisAt: string | null; // ISO date
  };
}

// Transaction History Item
interface TokenTransaction {
  id: string;
  userId: string;
  type: 'analysis' | 'bonus' | 'reset';
  tokensAmount: number;
  tokensBefore: number;
  tokensAfter: number;
  analysisUrl?: string;
  analysisId?: string;
  description?: string;
  metadata: Record<string, any>;
  createdAt: string; // ISO date
}

// Paginated History Response
interface QuotaHistoryResponse {
  data: TokenTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Reset Quota Request
interface ResetQuotaRequest {
  reason: string;
}

// Add Bonus Tokens Request
interface AddBonusTokensRequest {
  amount: number;
  reason: string;
}

// Quota Statistics Response
interface QuotaStatisticsResponse {
  overview: {
    totalTokensUsed: number;
    totalAnalyses: number;
    averageTokensPerAnalysis: number;
  };
  byTier: {
    free: TierStats;
    pro: TierStats;
  };
  topUsers: TopUser[];
}

interface TierStats {
  users: number;
  totalTokensUsed: number;
  averageUsagePercent: number;
  quotaExceededCount: number;
}

interface TopUser {
  userId: string;
  username: string;
  tier: 'free' | 'pro';
  tokensUsed: number;
  analysisCount: number;
}
```
