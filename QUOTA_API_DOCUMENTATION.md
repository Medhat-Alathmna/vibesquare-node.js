# Custom Token Quota API Documentation
## توثيق API للتحكم في Quota المخصص

---

## نظرة عامة (Overview)

تم إضافة نظام كامل للتحكم في حدود الـ tokens (quota) بشكل فردي لكل مستخدم من مستخدمي Gallery عبر لوحة الإدارة.

### الميزات الرئيسية:
- ✅ تعيين quota مخصص لأي مستخدم (يتجاوز الحد الافتراضي للـ tier)
- ✅ إزالة الـ quota المخصص والعودة للحد الافتراضي
- ✅ عرض قائمة المستخدمين الذين لديهم quota مخصص
- ✅ Audit trail كامل في `gallery_token_transactions`
- ✅ Custom quota يبقى بعد الـ reset الأسبوعي

### المنطق (Logic):
- **حدود افتراضية:**
  - Free tier: 100,000 tokens/week
  - Pro tier: 400,000 tokens/week
- **Custom quota يتفوق على tier default:**
  - إذا تم تعيين custom quota، يتم استخدامه بدلاً من حد الـ tier
  - عند إزالته، يعود النظام تلقائياً للحد الافتراضي
- **Reset أسبوعي:** كل 7 أيام، يتم إعادة تعيين `tokens_used` لـ 0، لكن `custom_quota_limit` يبقى كما هو

---

## API Endpoints

### 1. Get Users with Custom Quotas
**الحصول على قائمة المستخدمين الذين لديهم quota مخصص**

```http
GET /api/admin/gallery-users/custom-quotas
```

#### Query Parameters:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | رقم الصفحة |
| `limit` | number | No | 20 | عدد العناصر في الصفحة |

#### Headers:
```http
Authorization: Bearer <access_token>
```

#### Required Permission:
`gallery_users.read`

#### Success Response (200 OK):
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "userId": "guser-123e4567-e89b-12d3-a456-426614174000",
        "username": "john_doe",
        "email": "john@example.com",
        "tier": "free",
        "customLimit": 250000,
        "tierDefaultLimit": 100000,
        "tokensUsed": 50000
      },
      {
        "userId": "guser-987f6543-e21c-45d6-b789-987654321000",
        "username": "jane_smith",
        "email": "jane@example.com",
        "tier": "pro",
        "customLimit": 800000,
        "tierDefaultLimit": 400000,
        "tokensUsed": 120000
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### Response Fields:
| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | معرف المستخدم |
| `username` | string | اسم المستخدم |
| `email` | string | البريد الإلكتروني |
| `tier` | string | نوع الاشتراك (free/pro) |
| `customLimit` | number | الحد المخصص الحالي |
| `tierDefaultLimit` | number | الحد الافتراضي للـ tier |
| `tokensUsed` | number | عدد الـ tokens المستخدمة في الفترة الحالية |

#### Error Responses:
```json
// 401 Unauthorized - لم يتم تسجيل الدخول
{
  "success": false,
  "message": "Authentication required"
}

// 403 Forbidden - لا توجد صلاحيات
{
  "success": false,
  "message": "Insufficient permissions"
}
```

#### Example cURL:
```bash
curl -X GET "https://api.example.com/api/admin/gallery-users/custom-quotas?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 2. Set Custom Quota for User
**تعيين quota مخصص لمستخدم معين**

```http
POST /api/admin/gallery-users/:id/quota/set-custom
```

#### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | معرف المستخدم (e.g., guser-xxx) |

#### Request Body:
```json
{
  "customLimit": 250000,
  "reason": "Special user - increased limit for beta testing program"
}
```

#### Body Fields:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `customLimit` | number | Yes | min: 0, max: 10,000,000 | الحد المخصص الجديد (tokens/week) |
| `reason` | string | Yes | min: 1, max: 500 chars | سبب التخصيص (يتم تسجيله في transaction history) |

#### Headers:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

#### Required Permission:
`gallery_users.manage`

#### Success Response (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Custom quota set successfully",
    "quota": {
      "previousLimit": 100000,
      "newLimit": 250000,
      "isCustom": true,
      "tier": "free"
    }
  },
  "message": "Custom quota set successfully"
}
```

#### Response Fields:
| Field | Type | Description |
|-------|------|-------------|
| `previousLimit` | number | الحد السابق (قد يكون tier default أو custom قديم) |
| `newLimit` | number | الحد الجديد المخصص |
| `isCustom` | boolean | دائماً true بعد التعيين |
| `tier` | string | نوع اشتراك المستخدم |

#### Error Responses:
```json
// 400 Bad Request - بيانات غير صحيحة
{
  "success": false,
  "message": "Custom limit must be non-negative"
}

// 404 Not Found - المستخدم غير موجود
{
  "success": false,
  "message": "Gallery user not found"
}

// 401 Unauthorized
{
  "success": false,
  "message": "Authentication required"
}

// 403 Forbidden
{
  "success": false,
  "message": "Insufficient permissions"
}
```

#### Example cURL:
```bash
curl -X POST "https://api.example.com/api/admin/gallery-users/guser-123/quota/set-custom" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customLimit": 250000,
    "reason": "Special user - increased limit for beta testing"
  }'
```

#### Transaction Logging:
يتم تسجيل العملية في `gallery_token_transactions`:
```json
{
  "type": "custom_quota_set",
  "tokensAmount": 150000,  // الفرق (newLimit - previousLimit)
  "tokensBefore": 50000,   // الاستخدام الحالي
  "tokensAfter": 50000,    // الاستخدام لا يتغير
  "description": "Admin set custom quota: Special user - increased limit for beta testing",
  "metadata": {
    "previousLimit": 100000,
    "newLimit": 250000,
    "tier": "free",
    "setBy": "admin"
  }
}
```

---

### 3. Remove Custom Quota
**إزالة الـ quota المخصص والعودة للحد الافتراضي**

```http
POST /api/admin/gallery-users/:id/quota/remove-custom
```

#### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | معرف المستخدم |

#### Request Body:
```json
{
  "reason": "Beta testing completed, reverting to standard limits"
}
```

#### Body Fields:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `reason` | string | Yes | min: 1, max: 500 chars | سبب الإزالة |

#### Headers:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

#### Required Permission:
`gallery_users.manage`

#### Success Response (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Custom quota removed, reverted to tier default",
    "quota": {
      "previousLimit": 250000,
      "newLimit": 100000,
      "isCustom": false,
      "tier": "free"
    }
  },
  "message": "Custom quota removed, reverted to tier default"
}
```

#### Response Fields:
| Field | Type | Description |
|-------|------|-------------|
| `previousLimit` | number | الحد المخصص السابق |
| `newLimit` | number | الحد الافتراضي للـ tier |
| `isCustom` | boolean | دائماً false بعد الإزالة |
| `tier` | string | نوع اشتراك المستخدم |

#### Error Responses:
```json
// 400 Bad Request - المستخدم ليس لديه custom quota
{
  "success": false,
  "message": "User does not have a custom quota"
}

// 404 Not Found
{
  "success": false,
  "message": "Gallery user not found"
}

// 401 Unauthorized
{
  "success": false,
  "message": "Authentication required"
}

// 403 Forbidden
{
  "success": false,
  "message": "Insufficient permissions"
}
```

#### Example cURL:
```bash
curl -X POST "https://api.example.com/api/admin/gallery-users/guser-123/quota/remove-custom" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Beta testing completed"
  }'
```

#### Transaction Logging:
```json
{
  "type": "custom_quota_set",
  "tokensAmount": -150000,  // الفرق (tierLimit - previousLimit)
  "tokensBefore": 50000,
  "tokensAfter": 50000,
  "description": "Admin removed custom quota: Beta testing completed",
  "metadata": {
    "previousLimit": 250000,
    "newLimit": 100000,
    "tier": "free",
    "revertedToTier": true
  }
}
```

---

### 4. Get User Quota (محدّث)
**الحصول على معلومات quota المستخدم (مع دعم Custom Quota)**

```http
GET /api/admin/gallery-users/:id/quota
```

#### Path Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | معرف المستخدم |

#### Headers:
```http
Authorization: Bearer <access_token>
```

#### Required Permission:
`gallery_users.read`

#### Success Response (200 OK):
```json
{
  "success": true,
  "data": {
    "userId": "guser-123e4567-e89b-12d3-a456-426614174000",
    "tier": "free",
    "quota": {
      "limit": 250000,
      "used": 50000,
      "remaining": 200000,
      "usagePercentage": 20.0,
      "periodStart": "2026-01-01T00:00:00.000Z",
      "periodEnd": "2026-01-08T00:00:00.000Z",
      "isCustom": true,
      "customLimit": 250000,
      "tierDefaultLimit": 100000
    },
    "stats": {
      "totalTokensUsed": 500000,
      "analysisCount": 25,
      "lastAnalysisAt": "2026-01-05T10:30:00.000Z"
    }
  }
}
```

#### Response Fields (جديد/محدّث):

**Quota Object:**
| Field | Type | Description | جديد؟ |
|-------|------|-------------|------|
| `limit` | number | الحد الفعلي المستخدم حالياً | - |
| `used` | number | عدد الـ tokens المستخدمة | - |
| `remaining` | number | الباقي من الحد | - |
| `usagePercentage` | number | نسبة الاستخدام | - |
| `periodStart` | string (ISO 8601) | بداية الفترة الحالية | - |
| `periodEnd` | string (ISO 8601) | نهاية الفترة الحالية | - |
| `isCustom` | boolean | هل المستخدم لديه custom quota؟ | ✅ جديد |
| `customLimit` | number \| null | القيمة المخصصة (null إذا لم يكن هناك) | ✅ جديد |
| `tierDefaultLimit` | number | الحد الافتراضي للـ tier | ✅ جديد |

#### Example - User with Custom Quota:
```json
{
  "quota": {
    "limit": 250000,           // الحد الفعلي (custom)
    "used": 50000,
    "remaining": 200000,
    "isCustom": true,          // لديه custom quota
    "customLimit": 250000,     // القيمة المخصصة
    "tierDefaultLimit": 100000 // الافتراضي للـ free tier
  }
}
```

#### Example - User without Custom Quota:
```json
{
  "quota": {
    "limit": 100000,           // الحد الافتراضي
    "used": 30000,
    "remaining": 70000,
    "isCustom": false,         // ليس لديه custom quota
    "customLimit": null,       // لا يوجد تخصيص
    "tierDefaultLimit": 100000 // الافتراضي
  }
}
```

#### Error Responses:
```json
// 404 Not Found
{
  "success": false,
  "message": "Gallery user not found"
}
```

#### Example cURL:
```bash
curl -X GET "https://api.example.com/api/admin/gallery-users/guser-123/quota" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Integration Examples

### JavaScript/TypeScript Example

```typescript
// Service للتعامل مع الـ API
class QuotaService {
  private baseUrl = 'https://api.example.com/api/admin/gallery-users';

  // Get users with custom quotas
  async getUsersWithCustomQuotas(page = 1, limit = 20) {
    const response = await fetch(
      `${this.baseUrl}/custom-quotas?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      }
    );
    return response.json();
  }

  // Set custom quota
  async setCustomQuota(userId: string, customLimit: number, reason: string) {
    const response = await fetch(
      `${this.baseUrl}/${userId}/quota/set-custom`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customLimit, reason })
      }
    );
    return response.json();
  }

  // Remove custom quota
  async removeCustomQuota(userId: string, reason: string) {
    const response = await fetch(
      `${this.baseUrl}/${userId}/quota/remove-custom`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      }
    );
    return response.json();
  }

  // Get user quota
  async getUserQuota(userId: string) {
    const response = await fetch(
      `${this.baseUrl}/${userId}/quota`,
      {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      }
    );
    return response.json();
  }

  private getToken(): string {
    // Get token from storage
    return localStorage.getItem('accessToken') || '';
  }
}

// Usage Example
const quotaService = new QuotaService();

// Set custom quota
await quotaService.setCustomQuota(
  'guser-123',
  250000,
  'Special user for beta testing'
);

// Get quota info
const quota = await quotaService.getUserQuota('guser-123');
console.log('Is custom?', quota.data.quota.isCustom);
console.log('Current limit:', quota.data.quota.limit);

// Remove custom quota
await quotaService.removeCustomQuota(
  'guser-123',
  'Testing completed'
);

// Get list of users with custom quotas
const customUsers = await quotaService.getUsersWithCustomQuotas(1, 20);
console.log('Users with custom quotas:', customUsers.data.total);
```

---

## Angular Service Example

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GalleryQuotaService {
  private baseUrl = 'https://api.example.com/api/admin/gallery-users';

  constructor(private http: HttpClient) {}

  getUsersWithCustomQuotas(page = 1, limit = 20): Observable<any> {
    return this.http.get(`${this.baseUrl}/custom-quotas`, {
      params: { page: page.toString(), limit: limit.toString() }
    });
  }

  setCustomQuota(userId: string, customLimit: number, reason: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${userId}/quota/set-custom`, {
      customLimit,
      reason
    });
  }

  removeCustomQuota(userId: string, reason: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${userId}/quota/remove-custom`, {
      reason
    });
  }

  getUserQuota(userId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${userId}/quota`);
  }
}
```

---

## Common Use Cases

### Use Case 1: Set Custom Quota for Beta Tester
```typescript
// سيناريو: منح مستخدم حد مرتفع للاختبار
await quotaService.setCustomQuota(
  'guser-beta-tester-123',
  500000,  // 500K tokens instead of 100K
  'Beta tester - needs higher limit for extensive testing'
);
```

### Use Case 2: Temporary Quota Increase for Event
```typescript
// سيناريو: زيادة مؤقتة خلال حدث
const eventUsers = ['guser-1', 'guser-2', 'guser-3'];

for (const userId of eventUsers) {
  await quotaService.setCustomQuota(
    userId,
    1000000,
    'Temporary increase for launch event - Jan 2026'
  );
}

// بعد انتهاء الحدث
for (const userId of eventUsers) {
  await quotaService.removeCustomQuota(
    userId,
    'Event ended - reverting to normal limits'
  );
}
```

### Use Case 3: Check if User Has Custom Quota
```typescript
const quota = await quotaService.getUserQuota('guser-123');

if (quota.data.quota.isCustom) {
  console.log(`User has custom quota of ${quota.data.quota.customLimit}`);
  console.log(`Tier default would be ${quota.data.quota.tierDefaultLimit}`);
} else {
  console.log(`User using tier default: ${quota.data.quota.limit}`);
}
```

### Use Case 4: List All Custom Quotas with Pagination
```typescript
// الحصول على جميع المستخدمين مع custom quota
const page1 = await quotaService.getUsersWithCustomQuotas(1, 20);

console.log(`Total users with custom quotas: ${page1.data.total}`);
console.log(`Total pages: ${page1.data.totalPages}`);

// عرض التفاصيل
page1.data.data.forEach(user => {
  const increase = user.customLimit - user.tierDefaultLimit;
  console.log(
    `${user.username}: ${user.customLimit} tokens ` +
    `(+${increase} from tier default)`
  );
});
```

---

## Database Schema

### Table: `gallery_token_usage`

```sql
CREATE TABLE gallery_token_usage (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  quota_period_start TIMESTAMP NOT NULL,
  quota_period_end TIMESTAMP NOT NULL,
  total_tokens_used BIGINT NOT NULL DEFAULT 0,
  analysis_count INTEGER NOT NULL DEFAULT 0,
  total_analysis_count INTEGER NOT NULL DEFAULT 0,
  last_analysis_at TIMESTAMP,
  last_analysis_url TEXT,
  last_analysis_tokens INTEGER,
  custom_quota_limit BIGINT DEFAULT NULL,  -- جديد: NULL = tier default, NOT NULL = custom
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index للأداء
CREATE INDEX idx_gallery_token_usage_custom_quota
ON gallery_token_usage(custom_quota_limit)
WHERE custom_quota_limit IS NOT NULL;
```

### Table: `gallery_token_transactions`

```sql
-- يتم تسجيل جميع عمليات custom quota
SELECT * FROM gallery_token_transactions
WHERE type = 'custom_quota_set'
ORDER BY created_at DESC;
```

---

## Important Notes

### 1. Permissions
- **`gallery_users.read`** - للعرض والقراءة (GET endpoints)
- **`gallery_users.manage`** - للتعديل (POST endpoints)

تأكد من أن المستخدم لديه هذه الصلاحيات قبل استدعاء الـ APIs.

### 2. Validation
- `customLimit`: يجب أن يكون بين 0 و 10,000,000
- `reason`: يجب أن يكون بين 1 و 500 حرف
- لا يمكن إزالة custom quota إذا لم يكن موجود (خطأ 400)

### 3. Behavior
- **Custom quota يبقى بعد الـ reset الأسبوعي** - فقط `tokens_used` يتم إعادة تعيينه
- **Custom quota يبقى عند تغيير الـ tier** - يجب إزالته يدوياً إذا لزم الأمر
- **Audit trail كامل** - جميع العمليات مسجلة في `gallery_token_transactions`

### 4. Edge Cases
- إذا تم تعيين custom quota أقل من الاستخدام الحالي، يتم التعيين بنجاح لكن سيكون `remaining` سالب
- يمكن تعيين custom quota = 0 لتعطيل التحليل مؤقتاً
- لا يمكن تعيين custom quota لمستخدم غير موجود (404)

---

## Testing

### Postman Collection Example

```json
{
  "info": {
    "name": "Custom Quota API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Users with Custom Quotas",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/admin/gallery-users/custom-quotas?page=1&limit=20",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "gallery-users", "custom-quotas"],
          "query": [
            {"key": "page", "value": "1"},
            {"key": "limit", "value": "20"}
          ]
        }
      }
    },
    {
      "name": "Set Custom Quota",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"customLimit\": 250000,\n  \"reason\": \"Beta testing user\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/admin/gallery-users/{{user_id}}/quota/set-custom",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "gallery-users", "{{user_id}}", "quota", "set-custom"]
        }
      }
    },
    {
      "name": "Remove Custom Quota",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"reason\": \"Testing completed\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/admin/gallery-users/{{user_id}}/quota/remove-custom",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "gallery-users", "{{user_id}}", "quota", "remove-custom"]
        }
      }
    },
    {
      "name": "Get User Quota",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/admin/gallery-users/{{user_id}}/quota",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "gallery-users", "{{user_id}}", "quota"]
        }
      }
    }
  ]
}
```

---

## Changelog

### Version 1.0.0 (January 2026)
- ✅ إضافة endpoint للحصول على المستخدمين مع custom quotas
- ✅ إضافة endpoint لتعيين custom quota
- ✅ إضافة endpoint لإزالة custom quota
- ✅ تحديث endpoint الـ quota لإضافة معلومات custom quota
- ✅ إضافة عمود `custom_quota_limit` لجدول `gallery_token_usage`
- ✅ إضافة نوع معاملة `custom_quota_set` للـ audit trail

---

## نهاية التوثيق

هذا التوثيق يغطي جميع الـ endpoints المتعلقة بـ Custom Token Quota.

**Backend Status:** ✅ جاهز بالكامل ويعمل
**APIs Status:** ✅ جاهزة ومختبرة
**Database:** ✅ Migration نجح

يمكنك الآن البدء في تطوير الـ Frontend باستخدام هذه الـ APIs! 🚀
