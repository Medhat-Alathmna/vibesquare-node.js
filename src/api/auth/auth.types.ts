// ============================================
// Auth Types & Interfaces
// ============================================

// Permission Actions
export const PERMISSION_ACTIONS = ['read', 'create', 'update', 'delete', 'manage'] as const;
export type PermissionAction = typeof PERMISSION_ACTIONS[number];

// Permission Modules
export const PERMISSION_MODULES = [
  'dashboard',
  'projects',
  'collections',
  'users',
  'roles',
  'subscriptions',
  'payments',
  'tags',
  'activity',
  'settings',
  'analytics'
] as const;
export type PermissionModule = typeof PERMISSION_MODULES[number];

// Subscription Tiers
export const SUBSCRIPTION_TIERS = ['free', 'premium', 'enterprise'] as const;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];

// Subscription Status
export const SUBSCRIPTION_STATUS = ['active', 'cancelled', 'expired', 'past_due'] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[number];

// Auth Providers
export const AUTH_PROVIDERS = ['local', 'google', 'github'] as const;
export type AuthProvider = typeof AUTH_PROVIDERS[number];

// ============================================
// Permission Interface
// ============================================
export interface IPermission {
  id: string;
  name: string; // e.g., 'users.read', 'projects.create'
  description: string;
  module: PermissionModule;
  action: PermissionAction;
  createdAt: Date;
}

// ============================================
// Role Interface
// ============================================
export interface IRole {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean; // super_admin cannot be deleted
  canAccessAdmin: boolean; // Can access admin panel
  permissions: string[]; // Permission IDs
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// User Interface
// ============================================
export interface IUser {
  id: string;
  email: string;
  password?: string; // Nullable for OAuth-only users
  firstName: string;
  lastName: string;
  avatarUrl?: string;

  // OAuth Links
  googleId?: string;
  githubId?: string;

  // Status Flags
  isActive: boolean;
  emailVerified: boolean;
  mustChangePassword: boolean;
  isSystem: boolean; // Default admin cannot be deleted

  // Role & Subscription
  roleId?: string; // For admin access
  subscriptionTier: SubscriptionTier;

  // Security
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Refresh Token Interface
// ============================================
export interface IRefreshToken {
  id: string;
  userId: string;
  token: string; // Hashed token
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
  replacedByToken?: string; // For token rotation
  userAgent?: string;
  ipAddress?: string;
}

// ============================================
// Password Reset Token Interface
// ============================================
export interface IPasswordResetToken {
  id: string;
  userId: string;
  token: string; // Hashed token
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

// ============================================
// Email Verification Token Interface
// ============================================
export interface IEmailVerificationToken {
  id: string;
  userId: string;
  token: string; // Hashed token
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

// ============================================
// Login History Interface
// ============================================
export interface ILoginHistory {
  id: string;
  userId: string;
  provider: AuthProvider;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  createdAt: Date;
}

// ============================================
// Subscription Interface
// ============================================
export interface ISubscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;

  // Stripe Integration (future)
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;

  // Billing Period
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// OAuth Profile Interface
// ============================================
export interface IOAuthProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  provider: 'google' | 'github';
  accessToken?: string;
  refreshToken?: string;
}

// ============================================
// Request/Response Types
// ============================================

// Register
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Login
export interface LoginRequest {
  email: string;
  password: string;
}

// Auth Response
export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
  // refreshToken is sent via HttpOnly cookie
}

// Safe User (without sensitive data)
export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  isActive: boolean;
  emailVerified: boolean;
  subscriptionTier: SubscriptionTier;
  role?: {
    id: string;
    name: string;
    canAccessAdmin: boolean;
    permissions: string[];
  };
  createdAt: Date;
  lastLoginAt?: Date;
}

// JWT Payload
export interface JWTPayload {
  sub: string; // User ID
  email: string;
  role?: string; // Role name
  permissions?: string[]; // Permission names
  canAccessAdmin?: boolean;
  iat: number;
  exp: number;
}

// Token Pair
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Password Reset Request
export interface PasswordResetRequest {
  email: string;
}

// Password Reset Confirm
export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

// Change Password
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Update Profile
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

// ============================================
// All Permissions (for seeding)
// ============================================
export const ALL_PERMISSIONS: Array<{ name: string; description: string; module: PermissionModule; action: PermissionAction }> = [];

// Generate all permissions
for (const module of PERMISSION_MODULES) {
  for (const action of PERMISSION_ACTIONS) {
    ALL_PERMISSIONS.push({
      name: `${module}.${action}`,
      description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${module}`,
      module,
      action
    });
  }
}

// Special permissions
ALL_PERMISSIONS.push({
  name: 'admin.access',
  description: 'Access admin panel',
  module: 'dashboard',
  action: 'read'
});
