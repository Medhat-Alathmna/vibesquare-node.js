# Gallery V2.5 API Documentation

## نظرة عامة
هذه الوثائق تغطي جميع الـ endpoints الجديدة لـ V2.5 Pipeline في نظام Gallery.

---

## 📋 جدول المحتويات

1. [V2.5 Analysis Endpoints](#v25-analysis-endpoints)
2. [Gallery PRD Endpoints](#gallery-prd-endpoints)
3. [Response Formats](#response-formats)
4. [Error Handling](#error-handling)
5. [Integration Examples](#integration-examples)

---

## V2.5 Analysis Endpoints

### 1. تقدير تكاليف التحليل (Estimate V2.5)

**Endpoint:** `POST /api/gallery/analyze/v2.5/estimate`

**الوصف:** تقدير عدد الـ tokens المطلوبة لتحليل V2.5

**المتطلبات:**
- Authentication: Bearer Token (مطلوب)
- Email Verification: مطلوب

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Request Parameters:**
| المعامل | النوع | الوصف | الإجباري |
|--------|------|-------|----------|
| url | string (URI) | رابط الموقع المراد تحليله | ✅ نعم |

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "estimatedTokens": 15000,
    "quota": {
      "sufficient": true,
      "remaining": 50000,
      "limit": 100000,
      "requiredTokens": 15000
    },
    "requiresConfirmation": true,
    "message": "V2.5 analysis will consume approximately 15,000 tokens (Visual + Technical Architecture). You have 50,000 tokens remaining."
  },
  "message": "success"
}
```

**Error Responses:**

| Status | Code | الرسالة | السبب |
|--------|------|--------|--------|
| 401 | UNAUTHORIZED | Authentication required | لم يتم توفير token صحيح |
| 403 | FORBIDDEN | Email verification required | البريد الإلكتروني غير مؤكد |
| 400 | BAD_REQUEST | Please provide a valid URL | الـ URL غير صحيح |
| 402 | PAYMENT_REQUIRED | Insufficient quota | لا توجد tokens كافية |

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/gallery/analyze/v2.5/estimate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com"
  }'
```

---

### 2. تنفيذ تحليل V2.5 (Confirm V2.5)

**Endpoint:** `POST /api/gallery/analyze/v2.5/confirm`

**الوصف:** تنفيذ التحليل V2.5 بعد تأكيد المستخدم

**المتطلبات:**
- Authentication: Bearer Token (مطلوب)
- Email Verification: مطلوب
- Prior Estimate: يفضل استدعاء estimate أولاً

**Request Body:**
```json
{
  "url": "https://example.com",
  "pipelineType": "both",
  "detailLevel": "detailed",
  "apiStyle": "REST"
}
```

**Request Parameters:**
| المعامل | النوع | الخيارات | الافتراضي | الوصف | الإجباري |
|--------|------|---------|----------|-------|----------|
| url | string (URI) | - | - | رابط الموقع | ✅ نعم |
| pipelineType | string | `visual`, `technical`, `both` | `both` | نوع التحليل | ❌ لا |
| detailLevel | string | `basic`, `detailed`, `comprehensive` | `detailed` | مستوى التفاصيل | ❌ لا |
| apiStyle | string | `REST`, `GraphQL` | `REST` | أسلوب API المتوقع | ❌ لا |

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "analysisId": "550e8400-e29b-41d4-a716-446655440000",
    "prdId": "550e8400-e29b-41d4-a716-446655440001",
    "prdMarkdown": "# Product Requirements Document\n\n## Executive Summary\n...",
    "tokensUsed": 15000,
    "metadata": {
      "cached": false,
      "cachedAt": null,
      "validationScore": 95,
      "qaApproved": true
    },
    "quota": {
      "remaining": 35000,
      "limit": 100000
    }
  },
  "message": "V2.5 analysis completed successfully"
}
```

**Response Fields:**
| الحقل | النوع | الوصف |
|-------|------|-------|
| analysisId | UUID | معرف التحليل الفريد |
| prdId | UUID | معرف PRD الفريد |
| prdMarkdown | string | نص PRD بصيغة Markdown كامل |
| tokensUsed | number | عدد الـ tokens المستهلكة |
| metadata.cached | boolean | هل تم استرجاع النتيجة من الـ cache |
| metadata.validationScore | number | درجة التحقق (0-100) |
| metadata.qaApproved | boolean | هل تمت الموافقة من QA |
| quota.remaining | number | الـ tokens المتبقية للمستخدم |
| quota.limit | number | حد الـ quota الكلي |

**Error Responses:**

| Status | Code | الرسالة | السبب |
|--------|------|--------|--------|
| 401 | UNAUTHORIZED | Authentication required | لم يتم توفير token صحيح |
| 403 | FORBIDDEN | Email verification required | البريد الإلكتروني غير مؤكد |
| 400 | BAD_REQUEST | Invalid parameters | معاملات غير صحيحة |
| 402 | PAYMENT_REQUIRED | Insufficient quota | لا توجد tokens كافية |
| 500 | SERVER_ERROR | Pipeline execution failed | فشل التحليل |

**Special Cases:**

#### الحالة: Partial Failure (فشل جزئي)
إذا فشل جزء من التحليل (مثلاً التحليل التقني بينما نجح البصري):
```json
{
  "success": false,
  "statusCode": 500,
  "message": "Technical pipeline failed",
  "data": {
    "analysisId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "partial",
    "tokensUsed": 0,
    "refundAmount": 7000,
    "message": "Visual analysis completed but technical analysis failed. 7,000 tokens refunded."
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/gallery/analyze/v2.5/confirm \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "pipelineType": "both",
    "detailLevel": "detailed",
    "apiStyle": "REST"
  }'
```

---

## Gallery PRD Endpoints

### 3. البحث عن PRD بـ URL (Get PRD by URL)

**Endpoint:** `GET /api/gallery/prd/by-url?url=...`

**الوصف:** الحصول على PRD بناءً على الـ source URL (يرجع أحدث نتيجة)

**المتطلبات:**
- Authentication: Bearer Token (مطلوب)

**Query Parameters:**
| المعامل | النوع | الوصف | الإجباري |
|--------|------|-------|----------|
| url | string (URI) | الـ URL المراد البحث عنه | ✅ نعم |

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "userId": "user-123",
    "sourceUrl": "https://example.com",
    "prdMarkdown": "# Product Requirements Document\n...",
    "metadata": {
      "pipelineType": "both",
      "detailLevel": "detailed",
      "validationScore": 95
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "success"
}
```

**Error Responses:**
| Status | Code | الرسالة | السبب |
|--------|------|--------|--------|
| 401 | UNAUTHORIZED | Authentication required | لم يتم توفير token صحيح |
| 400 | BAD_REQUEST | URL parameter is required | لم يتم توفير URL |
| 403 | FORBIDDEN | Access denied | المستخدم ليس مالك PRD |
| 404 | NOT_FOUND | PRD not found for this URL | لا يوجد PRD لهذا الـ URL |

**Special Notes:**
- URL يجب أن يكون URL-encoded في الـ query parameter
- الـ endpoint يتعامل مع URL normalization (يزيل trailing slashes، وينطبق على حالة الأحرف)
- يرجع أحدث PRD إذا كان هناك عدة نتائج للـ URL نفسه

**cURL Examples:**

مع URL encoding:
```bash
curl "http://localhost:3000/api/gallery/prd/by-url?url=https%3A%2F%2Fexample.com" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

مع trailing slash:
```bash
curl "http://localhost:3000/api/gallery/prd/by-url?url=https%3A%2F%2Fexample.com%2F" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

JavaScript example:
```javascript
const url = 'https://example.com';
const response = await fetch(`/api/gallery/prd/by-url?url=${encodeURIComponent(url)}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

### 4. قائمة PRDs (List PRDs)

**Endpoint:** `GET /api/gallery/prd`

**الوصف:** الحصول على قائمة جميع PRDs الخاصة بالمستخدم مع Pagination

**المتطلبات:**
- Authentication: Bearer Token (مطلوب)

**Query Parameters:**
| المعامل | النوع | الافتراضي | النطاق | الوصف | الإجباري |
|--------|------|----------|--------|-------|----------|
| page | number | 1 | ≥ 1 | رقم الصفحة | ❌ لا |
| limit | number | 10 | 1-100 | عدد النتائج لكل صفحة | ❌ لا |

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "prds": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "userId": "user-123",
        "sourceUrl": "https://example.com",
        "prdMarkdown": "# Product Requirements Document\n...",
        "metadata": {
          "pipelineType": "both",
          "detailLevel": "detailed",
          "validationScore": 95
        },
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "userId": "user-123",
        "sourceUrl": "https://another-site.com",
        "prdMarkdown": "# Product Requirements Document\n...",
        "metadata": {
          "pipelineType": "technical",
          "detailLevel": "comprehensive",
          "validationScore": 88
        },
        "createdAt": "2024-01-14T15:20:00Z",
        "updatedAt": "2024-01-14T15:20:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  },
  "message": "success"
}
```

**Error Responses:**
| Status | Code | الرسالة | السبب |
|--------|------|--------|--------|
| 401 | UNAUTHORIZED | Authentication required | لم يتم توفير token صحيح |

**cURL Example:**
```bash
curl "http://localhost:3000/api/gallery/prd?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. الحصول على PRD واحد (Get PRD by ID)

**Endpoint:** `GET /api/gallery/prd/:id`

**الوصف:** الحصول على PRD واحد محدد بـ ID

**المتطلبات:**
- Authentication: Bearer Token (مطلوب)
- Ownership: المستخدم يجب أن يكون مالك PRD

**URL Parameters:**
| المعامل | النوع | الوصف | الإجباري |
|--------|------|-------|----------|
| id | UUID | معرف PRD | ✅ نعم |

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "userId": "user-123",
    "sourceUrl": "https://example.com",
    "prdMarkdown": "# Product Requirements Document\n\n## Executive Summary\n\nThis document outlines...",
    "metadata": {
      "pipelineType": "both",
      "detailLevel": "detailed",
      "apiStyle": "REST",
      "validationScore": 95,
      "qaApproved": true,
      "cached": false
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "success"
}
```

**Error Responses:**
| Status | Code | الرسالة | السبب |
|--------|------|--------|--------|
| 401 | UNAUTHORIZED | Authentication required | لم يتم توفير token صحيح |
| 403 | FORBIDDEN | Access denied | المستخدم ليس مالك PRD |
| 404 | NOT_FOUND | PRD not found | لا يوجد PRD بهذا المعرف |

**cURL Example:**
```bash
curl http://localhost:3000/api/gallery/prd/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 6. تحميل PRD (Download PRD)

**Endpoint:** `GET /api/gallery/prd/:id/download`

**الوصف:** تحميل PRD بصيغة Markdown

**المتطلبات:**
- Authentication: Bearer Token (مطلوب)
- Ownership: المستخدم يجب أن يكون مالك PRD

**URL Parameters:**
| المعامل | النوع | الوصف | الإجباري |
|--------|------|-------|----------|
| id | UUID | معرف PRD | ✅ نعم |

**Success Response (200 OK):**
- Content-Type: `text/markdown`
- Content-Disposition: `attachment; filename="prd-example-com.md"`
- Body: محتوى PRD بصيغة markdown

**Example Response Headers:**
```
Content-Type: text/markdown
Content-Disposition: attachment; filename="prd-example-com.md"
Content-Length: 15234
```

**Error Responses:**
| Status | Code | الرسالة | السبب |
|--------|------|--------|--------|
| 401 | UNAUTHORIZED | Authentication required | لم يتم توفير token صحيح |
| 403 | FORBIDDEN | Access denied | المستخدم ليس مالك PRD |
| 404 | NOT_FOUND | PRD not found | لا يوجد PRD بهذا المعرف |

**cURL Example:**
```bash
curl http://localhost:3000/api/gallery/prd/550e8400-e29b-41d4-a716-446655440001/download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o prd.md
```

---

### 7. حذف PRD (Delete PRD)

**Endpoint:** `DELETE /api/gallery/prd/:id`

**الوصف:** حذف PRD محدد

**المتطلبات:**
- Authentication: Bearer Token (مطلوب)
- Ownership: المستخدم يجب أن يكون مالك PRD

**URL Parameters:**
| المعامل | النوع | الوصف | الإجباري |
|--------|------|-------|----------|
| id | UUID | معرف PRD | ✅ نعم |

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": null,
  "message": "PRD deleted successfully"
}
```

**Error Responses:**
| Status | Code | الرسالة | السبب |
|--------|------|--------|--------|
| 401 | UNAUTHORIZED | Authentication required | لم يتم توفير token صحيح |
| 403 | FORBIDDEN | Access denied | المستخدم ليس مالك PRD |
| 404 | NOT_FOUND | PRD not found | لا يوجد PRD بهذا المعرف |

**cURL Example:**
```bash
curl -X DELETE http://localhost:3000/api/gallery/prd/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Response Formats

### ✅ Success Response Format

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    // محتوى البيانات
  },
  "message": "success" // أو رسالة مخصصة
}
```

### ❌ Error Response Format

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message",
  "stack": "Error stack trace (في بيئة التطوير فقط)"
}
```

---

## Error Handling

### HTTP Status Codes

| Status | الكود | الوصف |
|--------|------|-------|
| 200 | OK | العملية نجحت |
| 400 | BAD_REQUEST | معاملات غير صحيحة |
| 401 | UNAUTHORIZED | المستخدم غير مصرح |
| 402 | PAYMENT_REQUIRED | لا توجد tokens كافية |
| 403 | FORBIDDEN | الوصول مرفوض |
| 404 | NOT_FOUND | المورد غير موجود |
| 500 | SERVER_ERROR | خطأ في السيرفر |

### Common Error Scenarios

#### 1. Email Not Verified
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Email verification required for V2.5 analysis"
}
```

**الحل:** قم بتأكيد البريد الإلكتروني أولاً

#### 2. Insufficient Quota
```json
{
  "success": false,
  "statusCode": 402,
  "message": "Insufficient quota",
  "data": {
    "required": 15000,
    "available": 5000,
    "deficit": 10000
  }
}
```

**الحل:** قم بترقية الخطة أو انتظر إعادة تعيين الـ quota

#### 3. Invalid URL
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Please provide a valid URL"
}
```

**الحل:** تأكد من صيغة الـ URL صحيحة

#### 4. PRD Not Found
```json
{
  "success": false,
  "statusCode": 404,
  "message": "PRD not found"
}
```

**الحل:** تحقق من معرف PRD صحيح

#### 5. Access Denied (Not Owner)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Access denied"
}
```

**الحل:** لا يمكنك الوصول إلى PRDs الآخرين

---

## Integration Examples

### Frontend Example: Complete V2.5 Flow

#### Step 1: Estimate Tokens
```javascript
async function estimateV25Analysis(url) {
  try {
    const response = await fetch('/api/gallery/analyze/v2.5/estimate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('يرجى تأكيد بريدك الإلكتروني أولاً');
      }
      if (response.status === 402) {
        throw new Error('رصيدك من الـ tokens غير كافي');
      }
      throw new Error('فشل التقدير');
    }

    const data = await response.json();
    return data.data; // { estimatedTokens, quota, message }
  } catch (error) {
    console.error('Estimate error:', error);
    throw error;
  }
}
```

#### Step 2: Show User Confirmation Dialog
```javascript
function showConfirmationDialog(estimate) {
  return new Promise((resolve) => {
    const dialog = `
      <div class="confirm-dialog">
        <h3>تأكيد التحليل</h3>
        <p>${estimate.message}</p>
        <div class="quota-info">
          <p>الـ Tokens المتبقية: ${estimate.quota.remaining.toLocaleString()}</p>
          <p>الحد الأقصى: ${estimate.quota.limit.toLocaleString()}</p>
        </div>
        <button onclick="resolve(true)">تأكيد</button>
        <button onclick="resolve(false)">إلغاء</button>
      </div>
    `;
    // عرض الـ dialog وانتظار الإجابة
  });
}
```

#### Step 3: Execute V2.5 Analysis
```javascript
async function executeV25Analysis(url, options = {}) {
  try {
    const response = await fetch('/api/gallery/analyze/v2.5/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        pipelineType: options.pipelineType || 'both',
        detailLevel: options.detailLevel || 'detailed',
        apiStyle: options.apiStyle || 'REST'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data.data; // { analysisId, prdId, prdMarkdown, tokensUsed, quota }
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}
```

#### Step 4: Display PRD
```javascript
async function displayPRD(prdId) {
  try {
    const response = await fetch(`/api/gallery/prd/${prdId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('فشل تحميل PRD');
    }

    const data = await response.json();
    const prd = data.data;

    // عرض الـ markdown (استخدم markdown parser مثل marked.js)
    document.getElementById('prd-content').innerHTML =
      markdownToHtml(prd.prdMarkdown);

    // إضافة أزرار للتحميل والحذف
    document.getElementById('download-btn').onclick = () =>
      downloadPRD(prdId, prd.sourceUrl);

    document.getElementById('delete-btn').onclick = () =>
      deletePRD(prdId);

  } catch (error) {
    console.error('Display error:', error);
  }
}
```

#### Step 5: Download PRD
```javascript
async function downloadPRD(prdId, sourceUrl) {
  try {
    const response = await fetch(`/api/gallery/prd/${prdId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('فشل التحميل');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prd-${sourceUrl.replace(/https?:\/\//, '').replace(/\//g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Download error:', error);
  }
}
```

#### Step 6: Delete PRD
```javascript
async function deletePRD(prdId) {
  if (!confirm('هل أنت متأكد من حذف هذا الـ PRD؟')) {
    return;
  }

  try {
    const response = await fetch(`/api/gallery/prd/${prdId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('فشل الحذف');
    }

    alert('تم حذف الـ PRD بنجاح');
    // أعد التوجيه أو حدث الـ UI
  } catch (error) {
    console.error('Delete error:', error);
    alert('فشل حذف الـ PRD');
  }
}
```

#### Step 7: List PRDs
```javascript
async function listUserPRDs(page = 1, limit = 10) {
  try {
    const response = await fetch(
      `/api/gallery/prd?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('فشل تحميل القائمة');
    }

    const data = await response.json();
    const { prds, pagination } = data.data;

    // عرض القائمة
    displayPRDsList(prds);

    // عرض Pagination
    displayPagination(pagination, (newPage) =>
      listUserPRDs(newPage, limit)
    );

  } catch (error) {
    console.error('List error:', error);
  }
}

function displayPRDsList(prds) {
  const list = document.getElementById('prds-list');
  list.innerHTML = prds.map(prd => `
    <div class="prd-item">
      <h3>${prd.sourceUrl}</h3>
      <p class="date">${new Date(prd.createdAt).toLocaleDateString('ar-SA')}</p>
      <p class="score">درجة التحقق: ${prd.metadata.validationScore}/100</p>
      <div class="actions">
        <button onclick="viewPRD('${prd.id}')">عرض</button>
        <button onclick="downloadPRD('${prd.id}', '${prd.sourceUrl}')">تحميل</button>
        <button onclick="deletePRD('${prd.id}')">حذف</button>
      </div>
    </div>
  `).join('');
}
```

---

## توصيات التطوير

### 1. مراعاة الأمان
- ✅ استخدم HTTPS دائماً
- ✅ خزن الـ token في HttpOnly Cookie (إن أمكن)
- ✅ لا تكشف الـ token في logs
- ✅ تحقق من صحة الـ URL قبل الإرسال

### 2. تحسين UX
- ✅ عرض loading indicator أثناء التحليل
- ✅ عرض progress bar إن كان متاحاً
- ✅ عرض رسائل خطأ واضحة بالعربية
- ✅ دعم إلغاء الطلب إن أمكن

### 3. معالجة الأخطاء
- ✅ التعامل مع timeout
- ✅ إعادة محاولة تلقائية للأخطاء المؤقتة
- ✅ تسجيل الأخطاء للتتبع
- ✅ عرض رسالة للمستخدم في كل حالة فشل

### 4. الأداء
- ✅ استخدم caching للـ PRD lists
- ✅ lazy load الـ PRD markdown
- ✅ استخدم debounce للـ search
- ✅ optimize images في الـ markdown

---

## نموذج البيانات

### Analysis Object
```typescript
interface GalleryAnalysis {
  id: string;
  userId: string;
  url: string;
  prompt?: string;
  pipelineType?: 'v1' | 'v2' | 'v2.5';
  prdId?: string;
  tokensUsed: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  metadata: Record<string, any>;
  pageTitle?: string;
  pageDescription?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

### PRD Object
```typescript
interface PRD {
  id: string;
  userId: string;
  sourceUrl: string;
  prdMarkdown: string;
  metadata: {
    pipelineType?: 'visual' | 'technical' | 'both';
    detailLevel?: 'basic' | 'detailed' | 'comprehensive';
    apiStyle?: 'REST' | 'GraphQL';
    validationScore?: number;
    qaApproved?: boolean;
    cached?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Quota Object
```typescript
interface Quota {
  userId: string;
  limit: number;
  used: number;
  remaining: number;
  resetDate?: Date;
  lastDeductionDate?: Date;
}
```

---

## Notes

- جميع الـ timestamps بصيغة ISO 8601 (UTC)
- جميع الـ IDs عبارة عن UUIDs
- يتم تطبيق CORS على جميع الـ endpoints
- يتم تطبيق Rate Limiting (تحقق من الـ response headers)

---

## Support & Troubleshooting

### الأسئلة الشائعة

**س: كيف أزيد حدي من الـ tokens؟**
ج: قم بترقية خطتك الاشتراكية من صفحة الاشتراكات

**س: هل يمكن تحليل نفس الـ URL مرتين؟**
ج: نعم، لكن ستُستخدم نفس الـ tokens حتى مع وجود cache

**س: ماذا يحدث إذا انقطع الاتصال أثناء التحليل؟**
ج: سيتم حفظ ما تم إنجازه (partial) وسيتم استرجاع الـ tokens المتبقية

**س: هل يمكنني مشاركة PRD مع الآخرين؟**
ج: حالياً لا يتوفر هذا الخيار، لكن يمكنك تحميل الـ PRD ومشاركة الملف

---

**آخر تحديث:** 2024-02-01
**الإصدار:** 1.0.0
