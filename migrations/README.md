# Database Migrations

هذا المشروع يستخدم **Knex.js** لإدارة migrations قاعدة البيانات.

## 📋 الأوامر المتاحة

### تشغيل جميع Migrations الجديدة
```bash
npm run migrate:latest
```
يقوم بتشغيل جميع migrations التي لم يتم تشغيلها بعد.

### Rollback آخر Batch من Migrations
```bash
npm run migrate:rollback
```
يقوم بالتراجع عن آخر مجموعة migrations تم تشغيلها.

### عرض حالة Migrations
```bash
npm run migrate:status
```
يعرض قائمة بجميع migrations وحالتها (pending/completed).

### إنشاء Migration جديدة
```bash
npm run migrate:make migration_name
```
ينشئ ملف migration جديد بصيغة TypeScript.

---

## 🏗️ بنية Migration File

كل migration يحتوي على دالتين:

### `up()` - تطبيق التغييرات
```typescript
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('table_name', (table) => {
    table.increments('id');
    table.string('name');
    // ...
  });
}
```

### `down()` - التراجع عن التغييرات
```typescript
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('table_name');
}
```

---

## 📝 Migrations الحالية

### `20260120000000_create_categories_system.ts`
**الهدف**: إنشاء نظام Categories مع Many-to-Many relationships

**الجداول المنشأة**:
1. **categories** - جدول Categories الرئيسي
   - `id` (UUID) - Primary Key
   - `name` (VARCHAR 100) - اسم Category
   - `slug` (VARCHAR 100) - URL-friendly slug
   - `description` (TEXT) - وصف اختياري
   - `is_active` (BOOLEAN) - حالة التفعيل
   - `deleted_at` (TIMESTAMP) - Soft delete
   - `created_at`, `updated_at` (TIMESTAMP)

2. **project_categories** - Junction table بين Projects و Categories
   - `project_id` (VARCHAR 100) - FK → projects.id
   - `category_id` (UUID) - FK → categories.id
   - Composite Primary Key: (project_id, category_id)

3. **collection_categories** - Junction table بين Collections و Categories
   - `collection_id` (VARCHAR 100) - FK → collections.id
   - `category_id` (UUID) - FK → categories.id
   - Composite Primary Key: (collection_id, category_id)

**المميزات**:
- ✅ Soft Delete support
- ✅ Active/Inactive states
- ✅ Unique constraints على name و slug (excluding soft-deleted)
- ✅ Performance indexes
- ✅ CASCADE delete على foreign keys
- ✅ Auto-update trigger لـ updated_at

---

## 🔧 إعدادات Knex

الإعدادات موجودة في ملف [`knexfile.ts`](../knexfile.ts) في الـ root directory.

**البيئات المدعومة**:
- `development` - للتطوير المحلي
- `production` - للـ production

**الاتصال بقاعدة البيانات**:
يستخدم `DATABASE_URL` من ملف `.env`.

---

## 🚀 خطوات التشغيل لأول مرة

1. تأكد من وجود `.env` file مع `DATABASE_URL`
2. شغل الـ migrations:
   ```bash
   npm run migrate:latest
   ```
3. تحقق من الحالة:
   ```bash
   npm run migrate:status
   ```

---

## 🔄 Rollback في حالة المشاكل

إذا حدثت مشكلة أثناء الـ migration:

```bash
# التراجع عن آخر batch
npm run migrate:rollback

# عرض الحالة
npm run migrate:status

# إعادة المحاولة
npm run migrate:latest
```

---

## 📚 مصادر إضافية

- [Knex.js Documentation](https://knexjs.org/)
- [Knex Migrations Guide](https://knexjs.org/guide/migrations.html)
- [Knex Schema Builder](https://knexjs.org/guide/schema-builder.html)

---

## ⚠️ ملاحظات مهمة

1. **لا تعدل migrations بعد تشغيلها** - أنشئ migration جديدة بدلاً من ذلك
2. **استخدم Rollback بحذر** - قد يحذف بيانات
3. **اختبر Migrations محلياً** قبل production
4. **احتفظ بـ backup** قبل تشغيل migrations على production
