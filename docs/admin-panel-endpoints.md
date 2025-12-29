# Admin Panel - Gallery Users Management Endpoints

Base URL: `/api/admin/gallery-users`

Authentication: All endpoints require `Authorization: Bearer <token>` header (Admin Panel JWT with admin permissions)

---

## 1. User Management Endpoints

### GET /admin/gallery-users
Get all gallery users with pagination and search.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| search | string | - | Search by username or email |

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "user_123",
        "username": "john_doe",
        "email": "john@example.com",
        "avatarUrl": "https://...",
        "bio": "Developer",
        "isActive": true,
        "emailVerified": true,
        "subscriptionTier": "pro",
        "lastDownloadAt": "2024-12-28T10:00:00.000Z",
        "canDownload": true,
        "hasPanelAccess": false,
        "createdAt": "2024-01-15T00:00:00.000Z",
        "lastLoginAt": "2024-12-28T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

### GET /admin/gallery-users/:id
Get specific gallery user details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "username": "john_doe",
    "email": "john@example.com",
    "avatarUrl": "https://...",
    "bio": "Developer",
    "socialLinks": {
      "twitter": "https://twitter.com/johndoe",
      "github": "https://github.com/johndoe"
    },
    "isActive": true,
    "emailVerified": true,
    "subscriptionTier": "pro",
    "lastDownloadAt": "2024-12-28T10:00:00.000Z",
    "canDownload": true,
    "hasPanelAccess": false,
    "createdAt": "2024-01-15T00:00:00.000Z",
    "lastLoginAt": "2024-12-28T09:00:00.000Z"
  }
}
```

---

### PUT /admin/gallery-users/:id
Update gallery user details.

**Request Body:**
```json
{
  "username": "new_username",
  "email": "newemail@example.com",
  "avatarUrl": "https://...",
  "bio": "Updated bio",
  "isActive": true,
  "emailVerified": true,
  "subscriptionTier": "pro"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "username": "new_username",
    "email": "newemail@example.com",
    "subscriptionTier": "pro",
    ...
  }
}
```

**Note:** Changing `subscriptionTier` will also update the quota limit.

---

### POST /admin/gallery-users/:id/toggle-status
Toggle user active/inactive status.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "isActive": false,
    ...
  },
  "message": "User deactivated successfully"
}
```

**Note:** Deactivating a user revokes all their JWT tokens.

---

### DELETE /admin/gallery-users/:id
Soft delete a gallery user.

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 2. Token Quota Management Endpoints (NEW)

### GET /admin/gallery-users/:id/quota
Get user's current token quota status.

**Response:**
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

---

### GET /admin/gallery-users/:id/quota/history
Get user's token transaction history.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "txn_456",
        "type": "analysis",
        "tokensAmount": -25000,
        "tokensBefore": 57500,
        "tokensAfter": 32500,
        "analysisUrl": "https://example.com",
        "description": "Analysis of https://example.com",
        "createdAt": "2024-12-28T14:30:00.000Z"
      },
      {
        "id": "txn_455",
        "type": "bonus",
        "tokensAmount": 10000,
        "tokensBefore": 47500,
        "tokensAfter": 57500,
        "description": "Promotional bonus",
        "createdAt": "2024-12-27T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "totalPages": 1
    }
  }
}
```

---

### POST /admin/gallery-users/:id/quota/reset
Manually reset user's token quota.

**Request Body:**
```json
{
  "reason": "Customer support request"
}
```

**Response:**
```json
{
  "success": true,
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

---

### POST /admin/gallery-users/:id/quota/add-tokens
Add bonus tokens to user's quota.

**Request Body:**
```json
{
  "amount": 50000,
  "reason": "Compensation for service issue"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "50,000 tokens added successfully",
    "newQuota": {
      "limit": 100000,
      "used": 32500,
      "remaining": 67500,
      "bonusAdded": 50000
    }
  }
}
```

**Note:** Bonus tokens are added by reducing `used` count, not increasing limit.

---

### PUT /admin/gallery-users/:id/quota/limit
Override user's quota limit (custom limit).

**Request Body:**
```json
{
  "customLimit": 200000,
  "reason": "VIP customer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Custom limit set successfully",
    "quota": {
      "limit": 200000,
      "used": 32500,
      "remaining": 167500
    }
  }
}
```

---

## 3. Subscription Management Endpoints (NEW)

### GET /admin/gallery-users/:id/subscription
Get user's subscription details.

**Response (Free User):**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "tier": "free",
    "status": null,
    "stripeCustomerId": null,
    "stripeSubscriptionId": null
  }
}
```

**Response (Pro User):**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "tier": "pro",
    "status": "active",
    "stripeCustomerId": "cus_ABC123",
    "stripeSubscriptionId": "sub_XYZ789",
    "currentPeriodStart": "2024-12-01T00:00:00.000Z",
    "currentPeriodEnd": "2025-01-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "paymentHistory": [
      {
        "amount": 999,
        "currency": "usd",
        "status": "succeeded",
        "date": "2024-12-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### POST /admin/gallery-users/:id/subscription/upgrade
Manually upgrade user to Pro (without payment).

**Request Body:**
```json
{
  "reason": "Promotional upgrade",
  "durationDays": 30
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "User upgraded to Pro successfully",
    "subscription": {
      "tier": "pro",
      "expiresAt": "2025-01-28T00:00:00.000Z"
    },
    "quota": {
      "limit": 400000,
      "used": 32500,
      "remaining": 367500
    }
  }
}
```

---

### POST /admin/gallery-users/:id/subscription/downgrade
Manually downgrade user to Free.

**Request Body:**
```json
{
  "reason": "Subscription cancelled",
  "immediate": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "User downgraded to Free",
    "subscription": {
      "tier": "free"
    },
    "quota": {
      "limit": 100000,
      "used": 32500,
      "remaining": 67500
    }
  }
}
```

---

### POST /admin/gallery-users/:id/subscription/cancel
Cancel user's Stripe subscription.

**Request Body:**
```json
{
  "immediate": false,
  "reason": "User requested cancellation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Subscription will be cancelled at period end",
    "cancelAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

## 4. Statistics Endpoints

### GET /admin/gallery-users/statistics
Get overall gallery users statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1500,
    "freeUsers": 1350,
    "proUsers": 150,
    "activeUsers": 1420,
    "usersWithPanelAccess": 25
  }
}
```

---

### GET /admin/gallery-users/quota-statistics (NEW)
Get token quota statistics across all users.

**Response:**
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
        "averageUsagePercent": 45,
        "quotaExceededCount": 120
      },
      "pro": {
        "users": 150,
        "totalTokensUsed": 20000000,
        "averageUsagePercent": 35,
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
      }
    ],
    "recentActivity": {
      "last24h": {
        "analyses": 45,
        "tokensUsed": 1125000
      },
      "last7d": {
        "analyses": 280,
        "tokensUsed": 7000000
      }
    }
  }
}
```

---

## 5. Activity Log Endpoints

### GET /admin/gallery-users/:id/activity
Get user's activity log.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "log_123",
        "action": "analysis",
        "resourceType": "project",
        "resourceId": "proj_456",
        "metadata": {
          "url": "https://example.com",
          "tokensUsed": 25000
        },
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2024-12-28T14:30:00.000Z"
      },
      {
        "id": "log_122",
        "action": "login",
        "metadata": {
          "method": "password"
        },
        "ipAddress": "192.168.1.1",
        "createdAt": "2024-12-28T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2
    }
  }
}
```

---

## 6. Notifications Endpoints

### POST /admin/gallery-users/:id/notify
Send notification to specific user.

**Request Body:**
```json
{
  "title": "Quota Warning",
  "message": "You have used 90% of your weekly token quota."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification sent successfully"
}
```

---

### POST /admin/gallery-users/notify-bulk
Send notification to multiple users.

**Request Body:**
```json
{
  "title": "New Feature Available",
  "message": "Check out our new AI analysis features!",
  "filter": {
    "subscriptionTier": "free",
    "isActive": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notificationsSent": 1350
  }
}
```

---

## 7. Panel Access Management

### POST /admin/gallery-users/:id/upgrade-to-panel
Give gallery user access to admin panel.

**Request Body:**
```json
{
  "roleId": "role_editor"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "galleryUser": { ... },
    "panelUserId": "panel_user_456"
  }
}
```

---

### POST /admin/gallery-users/:id/remove-panel-access
Remove admin panel access from gallery user.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "hasPanelAccess": false,
    ...
  }
}
```

---

## 8. Admin UI Components Needed

### Users Table
```
| Username    | Email              | Tier | Quota Usage      | Status | Actions    |
|-------------|--------------------| -----|------------------|--------|------------|
| john_doe    | john@example.com   | Pro  | ████░░ 65%       | Active | [View] [Edit] |
| jane_smith  | jane@example.com   | Free | ████████░ 90%    | Active | [View] [Edit] |
| bob_wilson  | bob@example.com    | Free | ██████████ 100%  | Active | [View] [Edit] |
```

### User Detail - Quota Tab
```
┌─────────────────────────────────────────────────────────┐
│  Token Quota                                            │
│                                                         │
│  Tier: FREE (100K/week)    [Upgrade to Pro]            │
│                                                         │
│  Usage: ████████░░░░░░░░░░░░ 45,000 / 100,000          │
│  Period: Dec 22 - Dec 29, 2024                          │
│                                                         │
│  [Reset Quota]  [Add Bonus Tokens]  [Set Custom Limit] │
├─────────────────────────────────────────────────────────┤
│  Transaction History                                    │
│                                                         │
│  Dec 28, 14:30  Analysis  -25,000   https://example... │
│  Dec 27, 10:00  Bonus     +10,000   Promotional bonus  │
│  Dec 25, 09:15  Analysis  -18,000   https://test.com   │
│  Dec 22, 00:00  Reset       0       Weekly reset       │
└─────────────────────────────────────────────────────────┘
```

### User Detail - Subscription Tab
```
┌─────────────────────────────────────────────────────────┐
│  Subscription Details                                   │
│                                                         │
│  Current Plan: PRO                                      │
│  Status: Active                                         │
│  Billing Period: Dec 1 - Jan 1, 2025                   │
│  Stripe Customer: cus_ABC123                           │
│                                                         │
│  [View in Stripe]  [Cancel Subscription]  [Downgrade]  │
├─────────────────────────────────────────────────────────┤
│  Payment History                                        │
│                                                         │
│  Dec 1, 2024   $9.99   Succeeded                       │
│  Nov 1, 2024   $9.99   Succeeded                       │
│  Oct 1, 2024   $9.99   Succeeded                       │
└─────────────────────────────────────────────────────────┘
```

### Dashboard Statistics Widget
```
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│  Total Users   │ │  Pro Users     │ │  Tokens Used   │
│     1,500      │ │      150       │ │    45.2M       │
│   +12% ↑       │ │   +25% ↑       │ │   this week    │
└────────────────┘ └────────────────┘ └────────────────┘

┌────────────────────────────────────────────────────────┐
│  Quota Usage Distribution                              │
│                                                        │
│  0-25%   ████████████████████ 650 users               │
│  25-50%  ████████████ 380 users                       │
│  50-75%  ████████ 250 users                           │
│  75-99%  ████ 150 users                               │
│  100%    ██ 70 users (quota exceeded)                 │
└────────────────────────────────────────────────────────┘
```

---

## 9. Endpoints Summary Table

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/gallery-users` | GET | List all users |
| `/admin/gallery-users/:id` | GET | Get user details |
| `/admin/gallery-users/:id` | PUT | Update user |
| `/admin/gallery-users/:id` | DELETE | Delete user |
| `/admin/gallery-users/:id/toggle-status` | POST | Toggle active status |
| `/admin/gallery-users/:id/quota` | GET | Get user quota |
| `/admin/gallery-users/:id/quota/history` | GET | Get quota history |
| `/admin/gallery-users/:id/quota/reset` | POST | Reset quota |
| `/admin/gallery-users/:id/quota/add-tokens` | POST | Add bonus tokens |
| `/admin/gallery-users/:id/quota/limit` | PUT | Set custom limit |
| `/admin/gallery-users/:id/subscription` | GET | Get subscription |
| `/admin/gallery-users/:id/subscription/upgrade` | POST | Manual upgrade |
| `/admin/gallery-users/:id/subscription/downgrade` | POST | Manual downgrade |
| `/admin/gallery-users/:id/subscription/cancel` | POST | Cancel subscription |
| `/admin/gallery-users/:id/activity` | GET | Get activity log |
| `/admin/gallery-users/:id/notify` | POST | Send notification |
| `/admin/gallery-users/notify-bulk` | POST | Bulk notification |
| `/admin/gallery-users/statistics` | GET | General statistics |
| `/admin/gallery-users/quota-statistics` | GET | Quota statistics |
| `/admin/gallery-users/:id/upgrade-to-panel` | POST | Grant panel access |
| `/admin/gallery-users/:id/remove-panel-access` | POST | Remove panel access |

---

## 10. Note on New Endpoints

The following endpoints are **NEW** and need to be implemented in the backend:

1. `GET /admin/gallery-users/:id/quota` - Get user quota
2. `GET /admin/gallery-users/:id/quota/history` - Get quota transactions
3. `POST /admin/gallery-users/:id/quota/reset` - Reset user quota
4. `POST /admin/gallery-users/:id/quota/add-tokens` - Add bonus tokens
5. `PUT /admin/gallery-users/:id/quota/limit` - Set custom limit
6. `GET /admin/gallery-users/:id/subscription` - Get subscription details
7. `POST /admin/gallery-users/:id/subscription/upgrade` - Manual upgrade
8. `POST /admin/gallery-users/:id/subscription/downgrade` - Manual downgrade
9. `POST /admin/gallery-users/:id/subscription/cancel` - Cancel subscription
10. `GET /admin/gallery-users/quota-statistics` - Quota analytics

These endpoints extend the existing admin gallery users API with quota management capabilities.
