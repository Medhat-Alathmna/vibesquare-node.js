# Gallery Frontend - Token Quota & Subscription Endpoints

Base URL: `/api/gallery`

Authentication: All endpoints require `Authorization: Bearer <token>` header (Gallery User JWT)

---

## 1. Token Quota Endpoints

### GET /quota
Get current user's token quota status.

**Response:**
```json
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

**Usage:** Display quota usage bar, remaining tokens, and reset countdown in the UI.

---

### GET /quota/history
Get token transaction history (paginated).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

**Response:**
```json
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
      },
      {
        "id": "txn_122",
        "type": "reset",
        "tokensAmount": 0,
        "tokensBefore": 100000,
        "tokensAfter": 0,
        "description": "Weekly quota reset",
        "createdAt": "2024-12-22T00:00:00.000Z"
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

**Transaction Types:**
- `analysis` - Tokens deducted for analysis
- `reset` - Weekly quota reset
- `bonus` - Bonus tokens added (promotional)

---

### POST /quota/check
Check if user has sufficient tokens for an estimated amount.

**Request Body:**
```json
{
  "estimatedTokens": 25000
}
```

**Response (Sufficient):**
```json
{
  "success": true,
  "data": {
    "sufficient": true,
    "remaining": 55000,
    "afterDeduction": 30000
  }
}
```

**Response (Insufficient):**
```json
{
  "success": true,
  "data": {
    "sufficient": false,
    "remaining": 15000,
    "required": 25000,
    "shortage": 10000
  }
}
```

---

## 2. Analysis Endpoints (with Quota)

### POST /analyze/estimate
Estimate token cost before running analysis. Use this to show user the cost and ask for confirmation.

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "estimatedTokens": 25000,
    "quota": {
      "remaining": 55000,
      "sufficient": true,
      "afterDeduction": 30000
    },
    "message": "This analysis will use approximately 25,000 tokens. You have 55,000 tokens remaining."
  }
}
```

**Response (Insufficient Quota):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "estimatedTokens": 25000,
    "quota": {
      "remaining": 15000,
      "sufficient": false,
      "shortage": 10000
    },
    "message": "Insufficient tokens. This analysis requires ~25,000 tokens but you only have 15,000 remaining."
  }
}
```

**UI Flow:**
1. User enters URL
2. Call `/analyze/estimate`
3. Show confirmation dialog: "This will use ~25,000 tokens. Continue?"
4. If user confirms, call `/analyze/confirm`

---

### POST /analyze/confirm
Execute analysis after user confirmation. Deducts tokens from quota.

**Request Body:**
```json
{
  "url": "https://example.com",
  "options": {
    "includeAssets": true,
    "maxDepth": 2
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "result": {
      "prompt": "# Design Analysis\n\nThis is a modern landing page with...",
      "metadata": {
        "url": "https://example.com",
        "analyzedAt": "2024-12-28T14:30:00.000Z"
      }
    },
    "tokensUsed": 23500,
    "quota": {
      "remaining": 31500,
      "used": 68500,
      "limit": 100000
    }
  }
}
```

**Error Response (Quota Exceeded - 402):**
```json
{
  "success": false,
  "statusCode": 402,
  "message": "Token quota exceeded. You have used 100,000 of 100,000 tokens this week.",
  "data": {
    "errorCode": "QUOTA_EXCEEDED",
    "quota": {
      "limit": 100000,
      "used": 100000,
      "remaining": 0,
      "resetAt": "2024-12-29T00:00:00.000Z"
    },
    "upgrade": {
      "available": true,
      "tier": "pro",
      "limit": 400000
    }
  }
}
```

---

### GET /analyze/history
Get paginated analysis history.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "ga-abc123",
        "url": "https://example.com",
        "pageTitle": "Example Website",
        "pageDescription": "An example website",
        "screenshotUrl": null,
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

**Analysis Status:**
- `pending` - Analysis queued
- `processing` - Analysis in progress
- `completed` - Analysis finished successfully
- `failed` - Analysis failed

---

### GET /analyze/recent
Get recent analyses (quick access).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 5 | Number of items (max 20) |

**Response:**
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
    }
  ]
}
```

---

### GET /analyze/:id
Get specific analysis with full prompt.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ga-abc123",
    "userId": "user_123",
    "url": "https://example.com",
    "prompt": "# Design Analysis\n\nThis is a modern landing page with...",
    "tokensUsed": 25000,
    "status": "completed",
    "metadata": {
      "model": "gpt-4o-mini",
      "pageTitle": "Example Website",
      "pageDescription": "An example website"
    },
    "pageTitle": "Example Website",
    "pageDescription": "An example website",
    "createdAt": "2024-12-28T14:30:00.000Z",
    "completedAt": "2024-12-28T14:30:15.000Z"
  }
}
```

---

### DELETE /analyze/:id
Delete an analysis from history.

**Response:**
```json
{
  "success": true,
  "message": "Analysis deleted successfully"
}
```

---

## 3. Subscription Endpoints (Stripe)

### GET /subscription
Get current subscription details.

**Response (Free User):**
```json
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
```

**Response (Pro User):**
```json
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

---

### POST /subscription/checkout
Create Stripe checkout session for Pro subscription.

**Request Body:**
```json
{
  "successUrl": "https://gallery.example.com/subscription/success",
  "cancelUrl": "https://gallery.example.com/subscription/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
  }
}
```

**Usage:** Redirect user to `checkoutUrl` to complete payment.

---

### POST /subscription/portal
Create Stripe customer portal session (for managing subscription).

**Request Body:**
```json
{
  "returnUrl": "https://gallery.example.com/settings"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "portalUrl": "https://billing.stripe.com/p/session/..."
  }
}
```

**Usage:** Redirect user to manage billing, update payment method, cancel subscription.

---

### POST /subscription/cancel
Cancel subscription at period end.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Subscription will be cancelled at the end of the current billing period",
    "cancelAt": "2025-01-28T00:00:00.000Z"
  }
}
```

---

### POST /subscription/reactivate
Reactivate a cancelled subscription (before period ends).

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Subscription reactivated successfully",
    "status": "active"
  }
}
```

---

## 4. UI Components Needed

### Quota Display Component
```
Token Usage: ████████░░ 68,500 / 100,000
Resets in: 2 days 5 hours
[Upgrade to Pro - 400K tokens/week]
```

### Pre-Analysis Confirmation Modal
```
┌─────────────────────────────────────────┐
│  Analyze Website                        │
│                                         │
│  URL: https://example.com               │
│                                         │
│  Estimated Cost: ~25,000 tokens         │
│  Your Balance: 55,000 tokens            │
│  After Analysis: 30,000 tokens          │
│                                         │
│  [Cancel]              [Confirm]        │
└─────────────────────────────────────────┘
```

### Quota Exceeded Modal
```
┌─────────────────────────────────────────┐
│  ⚠️ Token Quota Exceeded                │
│                                         │
│  You've used all 100,000 tokens         │
│  this week.                             │
│                                         │
│  Quota resets: Dec 29, 2024             │
│                                         │
│  [Wait for Reset]  [Upgrade to Pro]     │
└─────────────────────────────────────────┘
```

### Subscription Card
```
┌─────────────────────────────────────────┐
│  Current Plan: FREE                     │
│  Tokens: 100,000 / week                 │
│                                         │
│  ╔═══════════════════════════════════╗  │
│  ║  PRO PLAN - $9.99/month           ║  │
│  ║  • 400,000 tokens/week            ║  │
│  ║  • Priority support               ║  │
│  ║  [Upgrade Now]                    ║  │
│  ╚═══════════════════════════════════╝  │
└─────────────────────────────────────────┘
```

---

## 5. Error Handling

| Status Code | Error Code | Description | Action |
|-------------|------------|-------------|--------|
| 401 | - | Unauthorized | Redirect to login |
| 402 | QUOTA_EXCEEDED | Token quota exceeded | Show upgrade modal |
| 403 | - | Email not verified | Show verification prompt |
| 429 | - | Rate limited | Show retry message |

---

## 6. Webhook Events (Frontend doesn't call, but should listen)

When subscription status changes (via Stripe webhook), the backend updates the user's tier. Frontend should:
1. Poll `/subscription` after checkout redirect
2. Or use WebSocket/SSE for real-time updates
3. Refresh quota display after subscription change
