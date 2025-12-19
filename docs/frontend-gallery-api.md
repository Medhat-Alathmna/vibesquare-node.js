# Gallery Frontend API Documentation

هذا الملف يحتوي على توثيق كامل لـ APIs الخاصة بـ Gallery Frontend.

## Base URL
```
/api/gallery
```

## Authentication
جميع الـ endpoints المحمية تتطلب إرسال JWT token في header:
```
Authorization: Bearer <access_token>
```

---

## 1. Authentication APIs

### 1.1 Register
إنشاء حساب جديد

**Endpoint:** `POST /api/gallery/auth/register`

**Request Body:**
```json
{
  "username": "string (3-20 chars, a-z0-9_)",
  "email": "string (valid email)",
  "password": "string (min 8 chars, must contain letter and number)"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "guser-xxx",
      "username": "johndoe",
      "email": "john@example.com",
      "avatarUrl": null,
      "bio": null,
      "socialLinks": {},
      "isActive": true,
      "emailVerified": false,
      "subscriptionTier": "free",
      "lastDownloadAt": null,
      "canDownload": true,
      "hasPanelAccess": false,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastLoginAt": null
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:**
- `400` - Validation error (username/password rules)
- `409` - Email or username already exists

---

### 1.2 Login
تسجيل الدخول

**Endpoint:** `POST /api/gallery/auth/login`

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { /* SafeGalleryUser */ },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Note:** Refresh token is set in HTTP-only cookie `gallery_refresh_token`

**Errors:**
- `401` - Invalid email or password
- `403` - Account deactivated
- `429` - Account locked (too many failed attempts)

---

### 1.3 Logout
تسجيل الخروج

**Endpoint:** `POST /api/gallery/auth/logout`

**Headers:** `Authorization: Bearer <token>` (optional)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

---

### 1.4 Refresh Token
تجديد Access Token

**Endpoint:** `POST /api/gallery/auth/refresh`

**Note:** Uses `gallery_refresh_token` cookie automatically

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:**
- `401` - Invalid or expired refresh token

---

### 1.5 Verify Email
تحقق البريد الإلكتروني

**Endpoint:** `POST /api/gallery/auth/verify-email`

**Request Body:**
```json
{
  "token": "string (from email link)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": null
}
```

---

### 1.6 Resend Verification Email
إعادة إرسال رمز التحقق

**Endpoint:** `POST /api/gallery/auth/resend-verification`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Verification email sent",
  "data": null
}
```

---

### 1.7 Forgot Password
طلب إعادة تعيين كلمة المرور

**Endpoint:** `POST /api/gallery/auth/forgot-password`

**Request Body:**
```json
{
  "email": "string"
}
```

**Response:** `200 OK` (always, to prevent email enumeration)
```json
{
  "success": true,
  "message": "If the email exists, a reset link has been sent",
  "data": null
}
```

---

### 1.8 Reset Password
إعادة تعيين كلمة المرور

**Endpoint:** `POST /api/gallery/auth/reset-password`

**Request Body:**
```json
{
  "token": "string (from email link)",
  "newPassword": "string (min 8 chars)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password reset successful. Please login with your new password.",
  "data": null
}
```

---

### 1.9 Change Password
تغيير كلمة المرور (للمستخدم المسجل)

**Endpoint:** `PATCH /api/gallery/auth/change-password`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string (min 8 chars)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password changed. Please login again.",
  "data": null
}
```

**Note:** This will logout from all devices

---

### 1.10 Get Current User
الحصول على بيانات المستخدم الحالي

**Endpoint:** `GET /api/gallery/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "guser-xxx",
    "username": "johndoe",
    "email": "john@example.com",
    "avatarUrl": "https://...",
    "bio": "Developer",
    "socialLinks": {
      "twitter": "https://twitter.com/johndoe",
      "github": "https://github.com/johndoe"
    },
    "isActive": true,
    "emailVerified": true,
    "subscriptionTier": "free",
    "lastDownloadAt": "2025-01-01T00:00:00.000Z",
    "canDownload": false,
    "hasPanelAccess": false,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastLoginAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

## 2. User Profile APIs

### 2.1 Update Profile
تحديث الملف الشخصي

**Endpoint:** `PATCH /api/gallery/users/me`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "username": "string (optional)",
  "avatarUrl": "string (optional)",
  "bio": "string (max 500 chars, optional)",
  "socialLinks": {
    "twitter": "https://...",
    "linkedin": "https://...",
    "portfolio": "https://...",
    "github": "https://..."
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { /* SafeGalleryUser */ }
}
```

---

### 2.2 Delete Account
حذف الحساب (Soft Delete)

**Endpoint:** `DELETE /api/gallery/users/me`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Account deleted successfully",
  "data": null
}
```

---

### 2.3 Get Public Profile
عرض الملف الشخصي العام

**Endpoint:** `GET /api/gallery/users/profile/:username`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "username": "johndoe",
    "avatarUrl": "https://...",
    "bio": "Developer",
    "socialLinks": {
      "twitter": "https://twitter.com/johndoe"
    },
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### 2.4 Check Download Eligibility
التحقق من إمكانية التحميل

**Endpoint:** `GET /api/gallery/users/me/can-download`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "canDownload": false,
    "reason": "cooldown",
    "nextDownloadAt": "2025-01-04T00:00:00.000Z",
    "remainingCooldown": 172800
  }
}
```

**Possible reasons:**
- `"ok"` - يمكن التحميل
- `"cooldown"` - في فترة الانتظار (Free users)
- `"not_verified"` - البريد غير موثق

---

### 2.5 Record Download
تسجيل عملية تحميل

**Endpoint:** `POST /api/gallery/users/me/download/:projectId`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Download recorded",
  "data": null
}
```

**Errors:**
- `403` - Email not verified
- `429` - Download limit reached (cooldown active)

**Note:** يجب استدعاء هذا الـ endpoint عند كل تحميل ناجح لتحديث `lastDownloadAt`

---

## 3. Favorites APIs

### 3.1 Get Favorites List
قائمة المفضلة

**Endpoint:** `GET /api/gallery/favorites`

**Headers:** `Authorization: Bearer <token>`

**Query Params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "gfav-xxx",
        "userId": "guser-xxx",
        "projectId": "proj-xxx",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 3.2 Get Favorite Project IDs
قائمة IDs المفضلة فقط

**Endpoint:** `GET /api/gallery/favorites/ids`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "projectIds": ["proj-1", "proj-2", "proj-3"]
  }
}
```

---

### 3.3 Add to Favorites
إضافة للمفضلة

**Endpoint:** `POST /api/gallery/favorites/:projectId`

**Headers:** `Authorization: Bearer <token>`

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Added to favorites",
  "data": {
    "id": "gfav-xxx",
    "userId": "guser-xxx",
    "projectId": "proj-xxx",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### 3.4 Remove from Favorites
إزالة من المفضلة

**Endpoint:** `DELETE /api/gallery/favorites/:projectId`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Removed from favorites",
  "data": null
}
```

---

### 3.5 Check if Favorited
التحقق إذا كان في المفضلة

**Endpoint:** `GET /api/gallery/favorites/check/:projectId`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "isFavorited": true
  }
}
```

---

### 3.6 Check Multiple Projects
التحقق من عدة مشاريع

**Endpoint:** `POST /api/gallery/favorites/check-multiple`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "projectIds": ["proj-1", "proj-2", "proj-3"]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "proj-1": true,
    "proj-2": false,
    "proj-3": true
  }
}
```

---

## 4. Notifications APIs

### 4.1 Get Notifications
قائمة الإشعارات

**Endpoint:** `GET /api/gallery/notifications`

**Headers:** `Authorization: Bearer <token>`

**Query Params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "gnot-xxx",
        "userId": "guser-xxx",
        "type": "download_available",
        "title": "Download Available!",
        "message": "Your download cooldown has expired...",
        "isRead": false,
        "data": { "action": "download" },
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 4.2 Get Unread Count
عدد الإشعارات غير المقروءة

**Endpoint:** `GET /api/gallery/notifications/unread-count`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "count": 3
  }
}
```

---

### 4.3 Mark as Read
تحديد كمقروء

**Endpoint:** `PATCH /api/gallery/notifications/:id/read`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": null
}
```

---

### 4.4 Mark All as Read
تحديد الكل كمقروء

**Endpoint:** `PATCH /api/gallery/notifications/read-all`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": null
}
```

---

### 4.5 Delete Notification
حذف إشعار

**Endpoint:** `DELETE /api/gallery/notifications/:id`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Notification deleted",
  "data": null
}
```

---

## 5. Data Types

### SafeGalleryUser
```typescript
interface SafeGalleryUser {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  socialLinks: {
    twitter?: string;
    linkedin?: string;
    portfolio?: string;
    github?: string;
  };
  isActive: boolean;
  emailVerified: boolean;
  subscriptionTier: 'free' | 'premium';
  lastDownloadAt?: Date;
  canDownload: boolean;
  hasPanelAccess: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}
```

### NotificationType
```typescript
type NotificationType = 'subscription_expiring' | 'download_available' | 'system';
```

---

## 6. Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - No permission |
| 404 | Not Found |
| 409 | Conflict - Duplicate entry |
| 429 | Too Many Requests - Rate limit or download cooldown |
| 500 | Internal Server Error |

---

## 7. Frontend Implementation Notes

### Token Management
```typescript
// Store access token in memory (not localStorage for security)
let accessToken: string | null = null;

// Refresh token is handled via HTTP-only cookie
// Use credentials: 'include' for refresh requests
```

### Download Flow
```typescript
async function downloadProject(projectId: string) {
  // 1. Check eligibility
  const canDownload = await checkCanDownload();

  if (!canDownload.data.canDownload) {
    if (canDownload.data.reason === 'cooldown') {
      showUpgradePrompt(canDownload.data.nextDownloadAt);
      return;
    }
    if (canDownload.data.reason === 'not_verified') {
      showVerifyEmailPrompt();
      return;
    }
  }

  // 2. Perform download
  await performDownload(projectId);

  // 3. Record download (update lastDownloadAt)
  await recordDownload(projectId);
}
```

### Favorites Optimization
```typescript
// On list page load, check multiple favorites at once
const projectIds = projects.map(p => p.id);
const favorites = await checkMultipleFavorites(projectIds);

// Use the result to show favorite icons
projects.forEach(p => {
  p.isFavorited = favorites[p.id];
});
```
