# VibeSquare Users System Architecture

هذا الملف يوضح الفرق بين نوعي المستخدمين في النظام.

---

## نظرة عامة سريعة

```
┌─────────────────────────────────────────────────────────────────┐
│                     VibeSquare System                            │
├─────────────────────────────┬───────────────────────────────────┤
│      PANEL USERS            │         GALLERY USERS             │
│    (الإدارة/الموظفين)        │        (الزبائن/العملاء)           │
├─────────────────────────────┼───────────────────────────────────┤
│ • يدخلون Admin Panel        │ • يدخلون Gallery Website          │
│ • لديهم صلاحيات إدارية       │ • يتصفحون ويحملون المشاريع        │
│ • يديرون المحتوى والمستخدمين │ • يستخدمون AI (Premium)           │
│ • جدول: users               │ • جدول: gallery_users             │
│ • API: /api/auth/*          │ • API: /api/gallery/*             │
│ • API: /api/admin/*         │                                   │
└─────────────────────────────┴───────────────────────────────────┘
```

---

## مقارنة تفصيلية

| الخاصية | Panel Users | Gallery Users |
|---------|-------------|---------------|
| **الغرض** | إدارة النظام والمحتوى | تصفح وتحميل المشاريع |
| **الوصول** | Admin Panel فقط | Gallery Website فقط |
| **جدول قاعدة البيانات** | `users` | `gallery_users` |
| **الـ API Base** | `/api/auth` + `/api/admin` | `/api/gallery` |
| **نظام الصلاحيات** | Roles + Permissions | Subscription Tiers |
| **الاشتراكات** | لا يوجد (موظفين) | Free / Premium |
| **تحقق البريد** | اختياري | إجباري للتحميل |
| **كلمة المرور** | 12 حرف (قوية) | 8 أحرف (أخف) |
| **OAuth** | Google, GitHub | Google, GitHub |

---

## 1. Panel Users (مستخدمي لوحة التحكم)

### من هم؟
- **الموظفين والمدراء** الذين يديرون المحتوى
- **المشرفين** الذين يراقبون النظام
- **الدعم الفني** الذي يساعد العملاء

### قاعدة البيانات
```sql
-- الجدول الرئيسي
TABLE: users

-- الحقول المهمة
- id: VARCHAR (user-xxx)
- email: VARCHAR
- password: VARCHAR (hashed, 12+ chars)
- firstName, lastName: VARCHAR
- roleId: VARCHAR (مرتبط بجدول roles)
- isActive: BOOLEAN
- emailVerified: BOOLEAN
```

### نظام الصلاحيات
```
users ──► roles ──► permissions

مثال:
- super_admin: كل الصلاحيات
- admin: صلاحيات محدودة
- moderator: قراءة وتعديل فقط
- support: قراءة فقط
```

### الـ APIs

#### Authentication (`/api/auth`)
```
POST /api/auth/register     - تسجيل (يحتاج دعوة)
POST /api/auth/login        - تسجيل دخول
POST /api/auth/logout       - تسجيل خروج
POST /api/auth/refresh      - تجديد Token
GET  /api/auth/me           - بيانات المستخدم الحالي
```

#### Admin Panel (`/api/admin`)
```
# إدارة المستخدمين
GET    /api/admin/users           - قائمة المستخدمين
POST   /api/admin/users           - إنشاء مستخدم
PATCH  /api/admin/users/:id       - تحديث مستخدم
DELETE /api/admin/users/:id       - حذف مستخدم

# إدارة الأدوار
GET    /api/admin/roles           - قائمة الأدوار
POST   /api/admin/roles           - إنشاء دور
PATCH  /api/admin/roles/:id       - تحديث دور

# إدارة Gallery Users
GET    /api/admin/gallery-users   - قائمة عملاء Gallery
PATCH  /api/admin/gallery-users/:id - تحديث عميل
```

### JWT Token Structure
```json
{
  "sub": "user-xxx",
  "email": "admin@example.com",
  "role": "super_admin",
  "permissions": ["users.read", "users.create", ...],
  "canAccessAdmin": true,
  "type": "panel"  // أو غير موجود
}
```

---

## 2. Gallery Users (مستخدمي المعرض)

### من هم؟
- **الزبائن/العملاء** الذين يتصفحون المشاريع
- **المستخدمين العاديين** الذين يحملون القوالب
- **المشتركين Premium** الذين يستخدمون AI

### قاعدة البيانات
```sql
-- الجدول الرئيسي
TABLE: gallery_users

-- الحقول المهمة
- id: VARCHAR (guser-xxx)
- username: VARCHAR (فريد، 3-20 حرف)
- email: VARCHAR
- password: VARCHAR (hashed, 8+ chars)
- subscriptionTier: 'free' | 'premium'
- lastDownloadAt: TIMESTAMP (لتتبع cooldown)
- panelUserId: VARCHAR (للمستخدمين المرقّين)

-- جداول مرتبطة
- gallery_favorites (المفضلة)
- gallery_notifications (الإشعارات)
- gallery_subscriptions (الاشتراكات)
- gallery_activity_log (سجل النشاط)
```

### نظام الاشتراكات
```
┌─────────────┬────────────────────────────────┐
│    FREE     │           PREMIUM              │
├─────────────┼────────────────────────────────┤
│ تحميل مرة   │ تحميل غير محدود                │
│ كل 3 أيام   │                                │
├─────────────┼────────────────────────────────┤
│ بدون AI    │ AI متاح                        │
├─────────────┼────────────────────────────────┤
│ مجاني      │ اشتراك شهري (Stripe)           │
└─────────────┴────────────────────────────────┘
```

### الـ APIs

#### Authentication (`/api/gallery/auth`)
```
POST /api/gallery/auth/register          - تسجيل حساب جديد
POST /api/gallery/auth/login             - تسجيل دخول
POST /api/gallery/auth/logout            - تسجيل خروج
POST /api/gallery/auth/refresh           - تجديد Token
POST /api/gallery/auth/verify-email      - تحقق البريد
POST /api/gallery/auth/forgot-password   - نسيت كلمة المرور
POST /api/gallery/auth/reset-password    - إعادة تعيين
GET  /api/gallery/auth/me                - بيانات المستخدم
```

#### User Profile (`/api/gallery/users`)
```
GET    /api/gallery/users/me              - الملف الشخصي
PATCH  /api/gallery/users/me              - تحديث الملف
DELETE /api/gallery/users/me              - حذف الحساب
GET    /api/gallery/users/profile/:username - ملف شخصي عام
GET    /api/gallery/users/me/can-download - هل يمكن التحميل؟
POST   /api/gallery/users/me/download/:id - تسجيل تحميل
```

#### Favorites (`/api/gallery/favorites`)
```
GET    /api/gallery/favorites             - قائمة المفضلة
POST   /api/gallery/favorites/:projectId  - إضافة للمفضلة
DELETE /api/gallery/favorites/:projectId  - إزالة من المفضلة
```

#### Notifications (`/api/gallery/notifications`)
```
GET   /api/gallery/notifications          - قائمة الإشعارات
PATCH /api/gallery/notifications/:id/read - تحديد كمقروء
```

### JWT Token Structure
```json
{
  "sub": "guser-xxx",
  "email": "customer@example.com",
  "username": "johndoe",
  "subscriptionTier": "free",
  "type": "gallery"  // مهم جداً للتفريق!
}
```

---

## 3. كيفية التفريق في الكود

### في Backend (Node.js)

```typescript
// التفريق عن طريق JWT type
if (jwtPayload.type === 'gallery') {
  // Gallery User
  const user = await galleryUserRepository.findById(jwtPayload.sub);
} else {
  // Panel User (type undefined or 'panel')
  const user = await userRepository.findById(jwtPayload.sub);
}

// أو عن طريق prefix الـ ID
if (userId.startsWith('guser-')) {
  // Gallery User
} else if (userId.startsWith('user-')) {
  // Panel User
}
```

### في Frontend

```typescript
// عند تسجيل الدخول، احفظ النوع
interface AuthState {
  user: PanelUser | GalleryUser;
  userType: 'panel' | 'gallery';
  accessToken: string;
}

// التفريق عن طريق الـ API المستخدم
const panelLogin = () => api.post('/api/auth/login', data);
const galleryLogin = () => api.post('/api/gallery/auth/login', data);

// أو عن طريق JWT payload
function getUserType(token: string): 'panel' | 'gallery' {
  const payload = decodeJWT(token);
  return payload.type === 'gallery' ? 'gallery' : 'panel';
}
```

---

## 4. الترقية من Gallery إلى Panel

### ماذا يحدث؟
```
Gallery User                    Panel User
(guser-xxx)      ────────►     (user-xxx)
     │                              │
     │      يتم نسخ البيانات        │
     │      (ليس نقل)               │
     │                              │
     ▼                              ▼
يبقى في                      يُنشأ حساب
gallery_users                جديد في users
مع panelUserId               مع roleId
```

### API للترقية (Admin فقط)
```
POST /api/admin/gallery-users/:id/upgrade-to-panel
Body: { "roleId": "role-xxx" }
```

### النتيجة
- Gallery User يبقى كما هو (يمكنه استخدام Gallery)
- يُنشأ Panel User جديد (يمكنه دخول Admin)
- يتم ربطهما عبر `panelUserId`

---

## 5. ملخص الـ Endpoints

### Panel System
| Base URL | الغرض |
|----------|-------|
| `/api/auth/*` | مصادقة Panel Users |
| `/api/admin/*` | إدارة النظام (محمي) |

### Gallery System
| Base URL | الغرض |
|----------|-------|
| `/api/gallery/auth/*` | مصادقة Gallery Users |
| `/api/gallery/users/*` | إدارة الملف الشخصي |
| `/api/gallery/favorites/*` | المفضلة |
| `/api/gallery/notifications/*` | الإشعارات |

### Shared
| Base URL | الغرض |
|----------|-------|
| `/api/projects/*` | عرض المشاريع (عام) |
| `/api/collections/*` | عرض المجموعات (عام) |

---

## 6. أمثلة عملية

### مثال 1: تسجيل دخول Gallery User
```typescript
// Request
POST /api/gallery/auth/login
{
  "email": "customer@example.com",
  "password": "mypassword123"
}

// Response
{
  "user": {
    "id": "guser-xxx",
    "username": "johndoe",
    "email": "customer@example.com",
    "subscriptionTier": "free",
    "canDownload": true
  },
  "accessToken": "eyJ...type:'gallery'..."
}
```

### مثال 2: تسجيل دخول Panel User
```typescript
// Request
POST /api/auth/login
{
  "email": "admin@vibesquare.io",
  "password": "SecurePassword123!"
}

// Response
{
  "user": {
    "id": "user-xxx",
    "email": "admin@vibesquare.io",
    "firstName": "Admin",
    "role": {
      "name": "super_admin",
      "canAccessAdmin": true,
      "permissions": ["users.read", "users.create", ...]
    }
  },
  "accessToken": "eyJ...canAccessAdmin:true..."
}
```

---

## 7. قواعد مهمة

1. **لا تخلط بين الـ APIs**
   - Gallery Users يستخدمون `/api/gallery/*` فقط
   - Panel Users يستخدمون `/api/auth/*` و `/api/admin/*`

2. **تحقق من نوع المستخدم**
   - دائماً تحقق من `type` في JWT
   - أو من prefix الـ ID

3. **Cookie Names مختلفة**
   - Panel: `refresh_token`
   - Gallery: `gallery_refresh_token`

4. **Middleware مختلف**
   - Panel: `authenticate()` من `auth.middleware.ts`
   - Gallery: `galleryAuthenticate()` من `gallery-auth.middleware.ts`
