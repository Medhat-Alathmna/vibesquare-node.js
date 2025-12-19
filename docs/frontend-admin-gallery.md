# Admin Panel - Gallery Users Management API Documentation

هذا الملف يحتوي على توثيق كامل لـ APIs إدارة Gallery Users في Admin Panel.

## Base URL
```
/api/admin/gallery-users
```

## Authentication
جميع الـ endpoints تتطلب:
1. JWT token في header: `Authorization: Bearer <token>`
2. المستخدم يجب أن يكون له صلاحية `canAccessAdmin: true`
3. الصلاحيات المحددة لكل endpoint

---

## 1. Statistics API

### 1.1 Get Statistics
إحصائيات Gallery Users

**Endpoint:** `GET /api/admin/gallery-users/statistics`

**Permission Required:** `gallery_users.read`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalUsers": 1500,
    "freeUsers": 1200,
    "premiumUsers": 300,
    "activeUsers": 1400,
    "usersWithPanelAccess": 25
  }
}
```

---

## 2. Users List & Search

### 2.1 List Gallery Users
قائمة مستخدمي Gallery مع Pagination

**Endpoint:** `GET /api/admin/gallery-users`

**Permission Required:** `gallery_users.read`

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | رقم الصفحة |
| limit | number | 20 | عدد النتائج (max: 100) |
| search | string | - | البحث بـ username أو email |

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "guser-xxx",
        "username": "johndoe",
        "email": "john@example.com",
        "avatarUrl": "https://...",
        "bio": "Developer",
        "socialLinks": {
          "twitter": "https://twitter.com/johndoe"
        },
        "isActive": true,
        "emailVerified": true,
        "subscriptionTier": "premium",
        "lastDownloadAt": "2025-01-01T00:00:00.000Z",
        "canDownload": true,
        "hasPanelAccess": false,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "lastLoginAt": "2025-01-15T00:00:00.000Z"
      }
    ],
    "total": 1500,
    "page": 1,
    "limit": 20,
    "totalPages": 75
  }
}
```

---

### 2.2 Get User by ID
تفاصيل مستخدم محدد

**Endpoint:** `GET /api/admin/gallery-users/:id`

**Permission Required:** `gallery_users.read`

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
    "subscriptionTier": "premium",
    "lastDownloadAt": "2025-01-01T00:00:00.000Z",
    "canDownload": true,
    "hasPanelAccess": false,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastLoginAt": "2025-01-15T00:00:00.000Z"
  }
}
```

**Errors:**
- `404` - User not found

---

## 3. User Management

### 3.1 Update User
تحديث بيانات مستخدم

**Endpoint:** `PATCH /api/admin/gallery-users/:id`

**Permission Required:** `gallery_users.update`

**Request Body:**
```json
{
  "username": "string (optional)",
  "email": "string (optional)",
  "avatarUrl": "string (optional)",
  "bio": "string (optional, max 500)",
  "isActive": "boolean (optional)",
  "emailVerified": "boolean (optional)",
  "subscriptionTier": "'free' | 'premium' (optional)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": { /* SafeGalleryUser */ }
}
```

**Errors:**
- `404` - User not found
- `409` - Email or username already in use

---

### 3.2 Toggle User Status
تفعيل/تعطيل المستخدم

**Endpoint:** `POST /api/admin/gallery-users/:id/toggle-status`

**Permission Required:** `gallery_users.update`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User activated successfully",
  "data": { /* SafeGalleryUser with isActive: true/false */ }
}
```

**Note:** عند التعطيل، يتم إلغاء جميع tokens للمستخدم

---

### 3.3 Delete User
حذف مستخدم (Soft Delete)

**Endpoint:** `DELETE /api/admin/gallery-users/:id`

**Permission Required:** `gallery_users.delete`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User deleted successfully",
  "data": null
}
```

**Note:** يتم تعطيل الحساب فقط (isActive: false)، لا يتم حذف البيانات

---

## 4. Panel Access Management

### 4.1 Upgrade to Panel
ترقية المستخدم لصلاحيات Panel

**Endpoint:** `POST /api/admin/gallery-users/:id/upgrade-to-panel`

**Permission Required:** `gallery_users.manage`

**Request Body:**
```json
{
  "roleId": "role-xxx"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User upgraded to panel successfully",
  "data": {
    "galleryUser": { /* SafeGalleryUser with hasPanelAccess: true */ },
    "panelUserId": "user-xxx"
  }
}
```

**What happens:**
1. يتم إنشاء حساب جديد في جدول `users` (Panel Users)
2. يتم ربط الحساب الجديد بـ Gallery User عبر `panelUserId`
3. المستخدم يستطيع الآن تسجيل الدخول للـ Admin Panel
4. كلمة المرور والـ OAuth تبقى كما هي

**Errors:**
- `400` - User already has panel access
- `400` - Selected role does not have admin access
- `404` - User or Role not found
- `409` - Email already exists in panel users

---

### 4.2 Remove Panel Access
إلغاء صلاحيات Panel

**Endpoint:** `POST /api/admin/gallery-users/:id/remove-panel-access`

**Permission Required:** `gallery_users.manage`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Panel access removed successfully",
  "data": { /* SafeGalleryUser with hasPanelAccess: false */ }
}
```

**What happens:**
1. يتم تعطيل حساب Panel User (isActive: false)
2. يتم إزالة الربط من Gallery User
3. المستخدم لا يستطيع تسجيل الدخول للـ Admin Panel بعد الآن
4. حساب Gallery يبقى فعال

**Errors:**
- `400` - User does not have panel access
- `404` - User not found

---

## 5. Activity & Notifications

### 5.1 Get User Activity
سجل نشاط المستخدم

**Endpoint:** `GET /api/admin/gallery-users/:id/activity`

**Permission Required:** `gallery_users.read`

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | رقم الصفحة |
| limit | number | 50 | عدد النتائج (max: 100) |

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "gact-xxx",
        "userId": "guser-xxx",
        "action": "download",
        "resourceType": "project",
        "resourceId": "proj-xxx",
        "metadata": {},
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2025-01-15T10:30:00.000Z"
      },
      {
        "id": "gact-yyy",
        "userId": "guser-xxx",
        "action": "login",
        "resourceType": null,
        "resourceId": null,
        "metadata": {},
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2025-01-15T10:00:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

**Activity Actions:**
| Action | Description |
|--------|-------------|
| `login` | تسجيل دخول |
| `logout` | تسجيل خروج |
| `download` | تحميل مشروع |
| `favorite` | إضافة للمفضلة |
| `unfavorite` | إزالة من المفضلة |
| `view` | عرض مشروع |
| `ai_use` | استخدام AI |
| `profile_update` | تحديث الملف الشخصي |

---

### 5.2 Send Notification to User
إرسال إشعار لمستخدم محدد

**Endpoint:** `POST /api/admin/gallery-users/:id/send-notification`

**Permission Required:** `gallery_users.manage`

**Request Body:**
```json
{
  "title": "string (max 255)",
  "message": "string (max 1000)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "data": null
}
```

---

### 5.3 Send Bulk Notification
إرسال إشعار جماعي

**Endpoint:** `POST /api/admin/gallery-users/send-notification`

**Permission Required:** `gallery_users.manage`

**Request Body:**
```json
{
  "title": "string (max 255)",
  "message": "string (max 1000)",
  "filter": {
    "subscriptionTier": "'free' | 'premium' (optional)",
    "isActive": "boolean (optional)"
  }
}
```

**Examples:**
```json
// إرسال لجميع المستخدمين
{
  "title": "New Feature!",
  "message": "Check out our new AI features!"
}

// إرسال للمستخدمين المجانيين فقط
{
  "title": "Upgrade Now!",
  "message": "Get 50% off Premium subscription!",
  "filter": {
    "subscriptionTier": "free"
  }
}

// إرسال للمستخدمين النشطين فقط
{
  "title": "Maintenance Notice",
  "message": "System maintenance at 3 AM.",
  "filter": {
    "isActive": true
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Notification sent to 1200 users",
  "data": {
    "sentTo": 1200
  }
}
```

---

## 6. Permissions Reference

| Permission | Description | Endpoints |
|------------|-------------|-----------|
| `gallery_users.read` | عرض المستخدمين | GET /statistics, GET /, GET /:id, GET /:id/activity |
| `gallery_users.create` | إنشاء مستخدم | (Reserved for future use) |
| `gallery_users.update` | تحديث مستخدم | PATCH /:id, POST /:id/toggle-status |
| `gallery_users.delete` | حذف مستخدم | DELETE /:id |
| `gallery_users.manage` | إدارة متقدمة | POST /:id/upgrade-to-panel, POST /:id/remove-panel-access, POST /:id/send-notification, POST /send-notification |

---

## 7. Data Types

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

### ActivityAction
```typescript
type ActivityAction =
  | 'login'
  | 'logout'
  | 'download'
  | 'favorite'
  | 'unfavorite'
  | 'view'
  | 'ai_use'
  | 'profile_update';
```

### GallerySubscriptionTier
```typescript
type GallerySubscriptionTier = 'free' | 'premium';
```

---

## 8. Frontend Implementation Notes

### Users List Page
```typescript
// Component state
const [users, setUsers] = useState<SafeGalleryUser[]>([]);
const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
const [search, setSearch] = useState('');

// Fetch users
async function fetchUsers() {
  const response = await api.get('/admin/gallery-users', {
    params: {
      page: pagination.page,
      limit: pagination.limit,
      search: search || undefined
    }
  });
  setUsers(response.data.data.data);
  setPagination(prev => ({ ...prev, total: response.data.data.total }));
}

// Debounce search
const debouncedSearch = useMemo(
  () => debounce((value) => setSearch(value), 300),
  []
);
```

### User Detail Page
```typescript
// Fetch user details and activity
async function fetchUserDetails(userId: string) {
  const [userRes, activityRes] = await Promise.all([
    api.get(`/admin/gallery-users/${userId}`),
    api.get(`/admin/gallery-users/${userId}/activity`)
  ]);

  return {
    user: userRes.data.data,
    activity: activityRes.data.data
  };
}
```

### Upgrade to Panel Dialog
```typescript
async function upgradeUser(userId: string, roleId: string) {
  try {
    const response = await api.post(
      `/admin/gallery-users/${userId}/upgrade-to-panel`,
      { roleId }
    );

    // Show success
    toast.success('User upgraded successfully');

    // Refresh user data
    await fetchUserDetails(userId);
  } catch (error) {
    if (error.response?.status === 409) {
      toast.error('Email already exists in panel users');
    } else {
      toast.error('Failed to upgrade user');
    }
  }
}
```

### Bulk Notification Form
```typescript
interface NotificationForm {
  title: string;
  message: string;
  filter: {
    subscriptionTier?: 'free' | 'premium';
    isActive?: boolean;
  };
}

async function sendBulkNotification(form: NotificationForm) {
  const response = await api.post('/admin/gallery-users/send-notification', form);
  toast.success(`Notification sent to ${response.data.data.sentTo} users`);
}
```

---

## 9. Statistics Dashboard Widgets

```typescript
// Statistics component
function GalleryUsersStats() {
  const [stats, setStats] = useState<Statistics | null>(null);

  useEffect(() => {
    api.get('/admin/gallery-users/statistics')
      .then(res => setStats(res.data.data));
  }, []);

  return (
    <div className="grid grid-cols-5 gap-4">
      <StatCard title="Total Users" value={stats?.totalUsers} />
      <StatCard title="Free Users" value={stats?.freeUsers} />
      <StatCard title="Premium Users" value={stats?.premiumUsers} />
      <StatCard title="Active Users" value={stats?.activeUsers} />
      <StatCard title="Panel Access" value={stats?.usersWithPanelAccess} />
    </div>
  );
}
```

---

## 10. Error Handling

```typescript
// Centralized error handler
function handleApiError(error: AxiosError) {
  const status = error.response?.status;
  const message = error.response?.data?.message;

  switch (status) {
    case 400:
      toast.error(message || 'Invalid request');
      break;
    case 401:
      // Redirect to login
      router.push('/login');
      break;
    case 403:
      toast.error('You do not have permission for this action');
      break;
    case 404:
      toast.error('User not found');
      break;
    case 409:
      toast.error(message || 'Conflict - duplicate entry');
      break;
    default:
      toast.error('An error occurred');
  }
}
```
