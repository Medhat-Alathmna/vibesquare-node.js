# Role Management API Changes

## New Features
1. Role can be disabled/enabled instead of deleted
2. Role is now required for every user (cannot be null)
3. Cannot delete a role that has users assigned

---

## New Endpoints

### Enable Role
```
PATCH /api/admin/roles/:id/enable
Authorization: Bearer {token}
Permission: roles.update

Response 200:
{
  "success": true,
  "message": "Role enabled successfully",
  "data": {
    "role": {
      "id": "role-xxx",
      "name": "moderator",
      "isActive": true,
      "isSystem": false,
      "canAccessAdmin": true,
      "permissions": ["perm-xxx", ...],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

### Disable Role
```
PATCH /api/admin/roles/:id/disable
Authorization: Bearer {token}
Permission: roles.update

Response 200:
{
  "success": true,
  "message": "Role disabled successfully",
  "data": {
    "role": {
      "id": "role-xxx",
      "name": "moderator",
      "isActive": false,
      ...
    }
  }
}
```

### Toggle Role Status
```
PATCH /api/admin/roles/:id/toggle-status
Authorization: Bearer {token}
Permission: roles.update

Response 200:
{
  "success": true,
  "message": "Role enabled successfully", // or "Role disabled successfully"
  "data": {
    "role": { ... }
  }
}
```

---

## Updated Endpoints

### Delete Role
```
DELETE /api/admin/roles/:id

Error 409 (if users assigned):
{
  "success": false,
  "message": "Cannot delete role. 5 user(s) are assigned to this role. Please reassign them first or disable the role instead."
}
```

### Create User
```
POST /api/admin/users

Body (roleId is now REQUIRED):
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "roleId": "role-xxx"  // REQUIRED
}

Error 400 (if roleId missing):
{
  "success": false,
  "message": "\"roleId\" is required"
}

Error 400 (if role is inactive):
{
  "success": false,
  "message": "Cannot assign inactive role to user"
}
```

### Assign Role to User
```
PATCH /api/admin/users/:id/role

Body (roleId cannot be null):
{
  "roleId": "role-xxx"  // REQUIRED, cannot be null
}
```

---

## IRole Interface Changes

```typescript
interface IRole {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;      // Cannot delete/modify if true
  canAccessAdmin: boolean;
  isActive: boolean;      // NEW - Can be disabled
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Business Rules

| Rule | Description |
|------|-------------|
| Role required | Every user must have a role assigned |
| Cannot delete role with users | Must reassign users first or disable role |
| Cannot assign inactive role | Inactive roles cannot be assigned to users |
| System roles protected | isSystem=true roles cannot be deleted/disabled |
| Existing users keep role | When role disabled, existing users keep it |

---

## System Roles (isSystem: true)

| Name | Description |
|------|-------------|
| super_admin | Full system access |
| default_user | Default role for regular users |

---

## Frontend Implementation Notes

1. **Role List Page**
   - Add "Active" status column/badge
   - Add Enable/Disable toggle button
   - Show user count per role
   - Disable delete button if role has users (show tooltip)

2. **Create/Edit User Form**
   - roleId field is now required
   - Filter role dropdown to show only active roles
   - Show validation error if no role selected

3. **Role Delete Confirmation**
   - Check user count before showing delete dialog
   - If users > 0, suggest disabling instead

4. **Suggested UI States**
   - Active role: Green badge/switch ON
   - Inactive role: Gray badge/switch OFF
   - System role: Lock icon (cannot toggle)
