# Gallery Frontend - Complete API Reference

Base URL: `/api/gallery`

Authentication: All endpoints (except auth) require `Authorization: Bearer <token>` header

---

## 1. Authentication Endpoints

### POST /auth/register
Register a new user.

```json
// Request
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}

// Response (201)
{
  "success": true,
  "data": {
    "user": {
      "id": "gu-abc123",
      "username": "john_doe",
      "email": "john@example.com",
      "subscriptionTier": "free",
      "emailVerified": false
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### POST /auth/login
Login with email and password.

```json
// Request
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

// Response (200)
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### POST /auth/refresh
Refresh access token (uses HttpOnly cookie).

```json
// Response (200)
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### POST /auth/logout
Logout and revoke tokens.

```json
// Response (200)
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 2. Token Quota Endpoints

### GET /quota
Get current user's token quota status.

```json
// Response
{
  "success": true,
  "data": {
    "tier": "free",
    "quota": {
      "limit": 100000,
      "used": 45000,
      "remaining": 55000,
      "periodStart": "2024-12-22T00:00:00.000Z",
      "periodEnd": "2024-12-29T00:00:00.000Z"
    },
    "analysisCount": 3,
    "lastAnalysisAt": "2024-12-28T14:30:00.000Z"
  }
}
```

### GET /quota/history
Get token transaction history.

**Query:** `?page=1&limit=20`

```json
// Response
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "txn_123",
        "type": "analysis",
        "tokensAmount": -25000,
        "tokensBefore": 55000,
        "tokensAfter": 30000,
        "analysisUrl": "https://example.com",
        "description": "Analysis of https://example.com",
        "createdAt": "2024-12-28T14:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

**Transaction Types:** `analysis` | `reset` | `bonus`

---

## 3. Analysis Endpoints

### POST /analyze/estimate
Estimate token cost before analysis.

```json
// Request
{
  "url": "https://example.com"
}

// Response
{
  "success": true,
  "data": {
    "estimatedTokens": 25000,
    "quota": {
      "sufficient": true,
      "remaining": 55000,
      "required": 25000
    },
    "requiresConfirmation": true,
    "message": "This analysis will consume approximately 25,000 tokens."
  }
}

// Response (Insufficient)
{
  "success": true,
  "data": {
    "estimatedTokens": 25000,
    "quota": {
      "sufficient": false,
      "remaining": 15000,
      "required": 25000,
      "shortfall": 10000
    },
    "message": "Insufficient tokens. Please upgrade to Pro."
  }
}
```

### POST /analyze/confirm
Execute analysis after confirmation.

```json
// Request
{
  "url": "https://example.com"
}

// Response (200)
{
  "success": true,
  "message": "Analysis completed successfully",
  "data": {
    "analysisId": "ga-abc123",
    "prompt": "# Design Analysis\n\nThis is a modern landing page...",
    "tokensUsed": 23500,
    "quota": {
      "remaining": 31500,
      "limit": 100000
    },
    "processingTimeMs": 5420
  }
}

// Error (402 - Quota Exceeded)
{
  "success": false,
  "statusCode": 402,
  "message": "Token quota exceeded.",
  "data": {
    "errorCode": "QUOTA_EXCEEDED",
    "quota": {
      "limit": 100000,
      "used": 100000,
      "remaining": 0,
      "resetAt": "2024-12-29T00:00:00.000Z"
    },
    "upgrade": {
      "tier": "pro",
      "limit": 400000
    }
  }
}
```

### GET /analyze/history
Get analysis history.

**Query:** `?page=1&limit=20`

```json
// Response
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "ga-abc123",
        "url": "https://example.com",
        "pageTitle": "Example Website",
        "pageDescription": "An example website",
        "tokensUsed": 25000,
        "status": "completed",
        "createdAt": "2024-12-28T14:30:00.000Z",
        "completedAt": "2024-12-28T14:30:15.000Z"
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Status Types:** `pending` | `processing` | `completed` | `failed`

### GET /analyze/recent
Get recent analyses.

**Query:** `?limit=5`

```json
// Response
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
    }
  ]
}
```

### GET /analyze/:id
Get specific analysis with full prompt.

```json
// Response
{
  "success": true,
  "data": {
    "id": "ga-abc123",
    "url": "https://example.com",
    "prompt": "# Design Analysis\n\nThis is a modern landing page...",
    "tokensUsed": 25000,
    "status": "completed",
    "metadata": {
      "model": "gpt-4o-mini",
      "pageTitle": "Example Website"
    },
    "pageTitle": "Example Website",
    "pageDescription": "An example website",
    "createdAt": "2024-12-28T14:30:00.000Z",
    "completedAt": "2024-12-28T14:30:15.000Z"
  }
}
```

### DELETE /analyze/:id
Delete an analysis.

```json
// Response
{
  "success": true,
  "message": "Analysis deleted successfully"
}
```

---

## 4. Subscription Endpoints (Stripe)

### GET /subscription
Get subscription details.

```json
// Response (Free User)
{
  "success": true,
  "data": {
    "tier": "free",
    "status": null,
    "quota": {
      "limit": 100000,
      "used": 45000,
      "remaining": 55000
    },
    "upgrade": {
      "available": true,
      "tier": "pro",
      "limit": 400000,
      "price": "$9.99/month"
    }
  }
}

// Response (Pro User)
{
  "success": true,
  "data": {
    "tier": "pro",
    "status": "active",
    "currentPeriodEnd": "2025-01-28T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "quota": {
      "limit": 400000,
      "used": 125000,
      "remaining": 275000
    }
  }
}
```

### POST /subscription/checkout
Create Stripe checkout session.

```json
// Request
{
  "successUrl": "https://gallery.example.com/subscription/success",
  "cancelUrl": "https://gallery.example.com/subscription/cancel"
}

// Response
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
  }
}
```

**Usage:** Redirect user to `checkoutUrl`

### POST /subscription/portal
Access Stripe billing portal.

```json
// Request
{
  "returnUrl": "https://gallery.example.com/settings"
}

// Response
{
  "success": true,
  "data": {
    "portalUrl": "https://billing.stripe.com/p/session/..."
  }
}
```

### POST /subscription/cancel
Cancel subscription at period end.

```json
// Response
{
  "success": true,
  "data": {
    "message": "Subscription will be cancelled at the end of the current billing period",
    "cancelAt": "2025-01-28T00:00:00.000Z"
  }
}
```

### POST /subscription/reactivate
Reactivate cancelled subscription.

```json
// Response
{
  "success": true,
  "data": {
    "message": "Subscription reactivated successfully",
    "status": "active"
  }
}
```

---

## 5. User Profile Endpoints

### GET /me
Get current user profile.

```json
// Response
{
  "success": true,
  "data": {
    "id": "gu-abc123",
    "username": "john_doe",
    "email": "john@example.com",
    "avatarUrl": "https://...",
    "bio": "Developer",
    "subscriptionTier": "free",
    "emailVerified": true,
    "createdAt": "2024-01-15T00:00:00.000Z"
  }
}
```

### PATCH /me
Update profile.

```json
// Request
{
  "username": "new_username",
  "bio": "Updated bio",
  "avatarUrl": "https://..."
}

// Response
{
  "success": true,
  "data": { ... }
}
```

---

## 6. Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | Invalid request data |
| 401 | UNAUTHORIZED | Authentication required |
| 402 | QUOTA_EXCEEDED | Token quota exceeded |
| 403 | FORBIDDEN | Email not verified / Account inactive |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Email/Username already exists |
| 429 | TOO_MANY_REQUESTS | Rate limited |
| 500 | INTERNAL_ERROR | Server error |

---

## 7. TypeScript Types

```typescript
// User
interface GalleryUser {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  subscriptionTier: 'free' | 'pro';
  emailVerified: boolean;
  createdAt: string;
}

// Quota Status
interface QuotaStatus {
  tier: 'free' | 'pro';
  quota: {
    limit: number;
    used: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  };
  analysisCount: number;
  lastAnalysisAt: string | null;
}

// Analysis History Item
interface AnalysisHistoryItem {
  id: string;
  url: string;
  pageTitle?: string;
  pageDescription?: string;
  tokensUsed: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

// Full Analysis
interface Analysis extends AnalysisHistoryItem {
  userId: string;
  prompt?: string;
  metadata: Record<string, any>;
}

// Token Transaction
interface TokenTransaction {
  id: string;
  type: 'analysis' | 'reset' | 'bonus';
  tokensAmount: number;
  tokensBefore: number;
  tokensAfter: number;
  analysisUrl?: string;
  description?: string;
  createdAt: string;
}

// Paginated Response
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// API Response
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  statusCode?: number;
}
```

---

## 8. UI Flow Examples

### Analysis Flow
```
1. User enters URL
2. POST /analyze/estimate -> Show confirmation dialog
3. User confirms -> POST /analyze/confirm
4. Show result with prompt
5. Result saved to history (GET /analyze/history)
```

### Quota Check Flow
```
1. On app load -> GET /quota
2. Display quota bar: "45,000 / 100,000 tokens"
3. Show reset countdown
4. If quota low -> Show upgrade prompt
```

### Subscription Upgrade Flow
```
1. User clicks "Upgrade to Pro"
2. POST /subscription/checkout
3. Redirect to checkoutUrl
4. Stripe handles payment
5. User returns to successUrl
6. GET /subscription -> Verify tier changed
```

---

## 9. Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | No | Register |
| `/auth/login` | POST | No | Login |
| `/auth/refresh` | POST | Cookie | Refresh token |
| `/auth/logout` | POST | Yes | Logout |
| `/quota` | GET | Yes | Get quota |
| `/quota/history` | GET | Yes | Transaction history |
| `/analyze/estimate` | POST | Yes* | Estimate tokens |
| `/analyze/confirm` | POST | Yes* | Execute analysis |
| `/analyze/history` | GET | Yes | Analysis history |
| `/analyze/recent` | GET | Yes | Recent analyses |
| `/analyze/:id` | GET | Yes | Get analysis |
| `/analyze/:id` | DELETE | Yes | Delete analysis |
| `/subscription` | GET | Yes | Get subscription |
| `/subscription/checkout` | POST | Yes | Stripe checkout |
| `/subscription/portal` | POST | Yes | Stripe portal |
| `/subscription/cancel` | POST | Yes | Cancel subscription |
| `/subscription/reactivate` | POST | Yes | Reactivate |
| `/me` | GET | Yes | Get profile |
| `/me` | PATCH | Yes | Update profile |

*Requires email verified
