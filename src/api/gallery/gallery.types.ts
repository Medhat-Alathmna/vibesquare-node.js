// ============================================
// Gallery Types & Interfaces
// ============================================

import { AuthProvider } from '../auth/auth.types';

// ============================================
// Gallery Subscription Tiers
// ============================================
export const GALLERY_SUBSCRIPTION_TIERS = ['free', 'pro'] as const;
export type GallerySubscriptionTier = typeof GALLERY_SUBSCRIPTION_TIERS[number];

// ============================================
// Token Quota Limits (per week)
// ============================================
export const QUOTA_LIMITS: Record<GallerySubscriptionTier, number> = {
  free: 100_000,   // 100K tokens/week
  pro: 400_000,    // 400K tokens/week
} as const;

// ============================================
// Gallery Subscription Status
// ============================================
export const GALLERY_SUBSCRIPTION_STATUS = ['active', 'cancelled', 'expired', 'past_due'] as const;
export type GallerySubscriptionStatus = typeof GALLERY_SUBSCRIPTION_STATUS[number];

// ============================================
// Notification Types
// ============================================
export const NOTIFICATION_TYPES = ['subscription_expiring', 'download_available', 'system'] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

// ============================================
// Activity Actions
// ============================================
export const ACTIVITY_ACTIONS = ['login', 'logout', 'download', 'favorite', 'unfavorite', 'view', 'ai_use', 'profile_update'] as const;
export type ActivityAction = typeof ACTIVITY_ACTIONS[number];

// ============================================
// Social Links Interface
// ============================================
export interface ISocialLinks {
  twitter?: string;
  linkedin?: string;
  portfolio?: string;
  github?: string;
}

// ============================================
// Gallery User Interface
// ============================================
export interface IGalleryUser {
  id: string;
  username: string;
  email: string;
  password?: string; // Nullable for OAuth-only users
  avatarUrl?: string;
  bio?: string;

  // Social Links
  socialLinks: ISocialLinks;

  // OAuth
  googleId?: string;
  githubId?: string;

  // Status
  isActive: boolean;
  emailVerified: boolean;

  // Subscription
  subscriptionTier: GallerySubscriptionTier;

  // Download Tracking
  lastDownloadAt?: Date;

  // Security
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;

  // Panel Link (for upgraded users)
  panelUserId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Gallery Refresh Token Interface
// ============================================
export interface IGalleryRefreshToken {
  id: string;
  userId: string;
  token: string; // Hashed token
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
  replacedByToken?: string;
  userAgent?: string;
  ipAddress?: string;
}

// ============================================
// Gallery Email Verification Token Interface
// ============================================
export interface IGalleryEmailVerificationToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

// ============================================
// Gallery Password Reset Token Interface
// ============================================
export interface IGalleryPasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

// ============================================
// Gallery Login History Interface
// ============================================
export interface IGalleryLoginHistory {
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
// Gallery Favorite Interface
// ============================================
export interface IGalleryFavorite {
  id: string;
  userId: string;
  projectId: string;
  createdAt: Date;
}

// ============================================
// Gallery Subscription Interface
// ============================================
export interface IGallerySubscription {
  id: string;
  userId: string;
  tier: GallerySubscriptionTier;
  status: GallerySubscriptionStatus;

  // Stripe Integration
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
// Gallery Notification Interface
// ============================================
export interface IGalleryNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  data: Record<string, any>;
  createdAt: Date;
}

// ============================================
// Gallery Activity Log Interface
// ============================================
export interface IGalleryActivityLog {
  id: string;
  userId: string;
  action: ActivityAction;
  resourceType?: string;
  resourceId?: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// ============================================
// Request/Response Types
// ============================================

// Register Request
export interface GalleryRegisterRequest {
  username: string;
  email: string;
  password: string;
}

// Login Request
export interface GalleryLoginRequest {
  email: string;
  password: string;
}

// Auth Response
export interface GalleryAuthResponse {
  user: SafeGalleryUser;
  accessToken: string;
  // refreshToken is sent via HttpOnly cookie
}

// Safe Gallery User (without sensitive data)
export interface SafeGalleryUser {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  socialLinks: ISocialLinks;
  isActive: boolean;
  emailVerified: boolean;
  subscriptionTier: GallerySubscriptionTier;
  lastDownloadAt?: Date;
  canDownload: boolean; // Computed: can user download now?
  hasPanelAccess: boolean; // Computed: is user upgraded to panel?
  createdAt: Date;
  lastLoginAt?: Date;
}

// Public Profile (visible to everyone)
export interface PublicGalleryProfile {
  username: string;
  avatarUrl?: string;
  bio?: string;
  socialLinks: ISocialLinks;
  createdAt: Date;
}

// JWT Payload for Gallery Users
export interface GalleryJWTPayload {
  sub: string; // User ID
  email: string;
  username: string;
  subscriptionTier: GallerySubscriptionTier;
  type: 'gallery'; // Distinguish from panel users
  iat: number;
  exp: number;
}

// Token Pair
export interface GalleryTokenPair {
  accessToken: string;
  refreshToken: string;
}

// Update Profile Request
export interface UpdateGalleryProfileRequest {
  username?: string;
  avatarUrl?: string;
  bio?: string;
  socialLinks?: Partial<ISocialLinks>;
}

// Change Password Request
export interface GalleryChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Password Reset Request
export interface GalleryPasswordResetRequest {
  email: string;
}

// Password Reset Confirm
export interface GalleryPasswordResetConfirm {
  token: string;
  newPassword: string;
}

// Download Check Response
export interface CanDownloadResponse {
  canDownload: boolean;
  reason?: string; // 'ok' | 'cooldown' | 'not_verified'
  nextDownloadAt?: Date; // When can download next (for free users)
  remainingCooldown?: number; // Seconds until next download
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// Username Validation Constants
// ============================================
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-z][a-z0-9_]*$/;
export const RESERVED_USERNAMES = [
  'admin', 'administrator', 'root', 'system', 'moderator', 'mod',
  'support', 'help', 'info', 'contact', 'about', 'api', 'www',
  'mail', 'email', 'ftp', 'ssh', 'null', 'undefined', 'anonymous',
  'guest', 'test', 'demo', 'example', 'user', 'users', 'account',
  'profile', 'settings', 'login', 'logout', 'register', 'signup',
  'signin', 'auth', 'oauth', 'callback', 'webhook', 'webhooks',
  'gallery', 'panel', 'dashboard', 'vibesquare', 'vibersquare'
];

// ============================================
// Password Validation Constants (Lighter for Gallery)
// ============================================
export const GALLERY_PASSWORD_MIN_LENGTH = 8;
export const GALLERY_PASSWORD_MAX_LENGTH = 128;

// ============================================
// Download Cooldown Constants
// ============================================
export const FREE_USER_DOWNLOAD_COOLDOWN_DAYS = 3;
export const FREE_USER_DOWNLOAD_COOLDOWN_MS = FREE_USER_DOWNLOAD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

// ============================================
// Token Transaction Types
// ============================================
export const TOKEN_TRANSACTION_TYPES = ['analysis', 'reset', 'bonus', 'refund'] as const;
export type TokenTransactionType = typeof TOKEN_TRANSACTION_TYPES[number];

// ============================================
// Gallery Token Usage Interface
// ============================================
export interface IGalleryTokenUsage {
  id: string;
  userId: string;
  tokensUsed: number;
  quotaPeriodStart: Date;
  quotaPeriodEnd: Date;
  totalTokensUsed: number;
  analysisCount: number;
  totalAnalysisCount: number;
  lastAnalysisAt?: Date;
  lastAnalysisUrl?: string;
  lastAnalysisTokens?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Gallery Token Transaction Interface
// ============================================
export interface IGalleryTokenTransaction {
  id: string;
  userId: string;
  type: TokenTransactionType;
  tokensAmount: number;
  tokensBefore: number;
  tokensAfter: number;
  analysisUrl?: string;
  analysisId?: string;
  description?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

// ============================================
// Quota Status Response
// ============================================
export interface QuotaStatus {
  tier: GallerySubscriptionTier;
  quota: {
    limit: number;
    used: number;
    remaining: number;
    periodStart: Date;
    periodEnd: Date;
    analysisCount: number;
  };
  lifetime: {
    totalTokensUsed: number;
    totalAnalyses: number;
  };
}

// ============================================
// Quota Check Result
// ============================================
export interface QuotaCheckResult {
  sufficient: boolean;
  remaining: number;
  required: number;
  shortfall?: number;
}

// ============================================
// Analysis Estimate Response
// ============================================
export interface AnalysisEstimate {
  estimatedTokens: number;
  quota: QuotaCheckResult;
  requiresConfirmation: boolean;
  message: string;
}

// ============================================
// Token Deduction Metadata
// ============================================
export interface TokenDeductionMetadata {
  analysisUrl: string;
  analysisId?: string;
  model?: string;
}

// ============================================
// Gallery Analysis Status
// ============================================
export const ANALYSIS_STATUS = ['pending', 'processing', 'completed', 'failed'] as const;
export type AnalysisStatus = typeof ANALYSIS_STATUS[number];

// ============================================
// Gallery Analysis Interface
// ============================================
export interface IGalleryAnalysis {
  id: string;
  userId: string;

  // Input
  url: string;

  // Output
  prompt?: string;

  // Metadata
  tokensUsed: number;
  status: AnalysisStatus;
  metadata: Record<string, any>;

  // Page info
  pageTitle?: string;
  pageDescription?: string;
  screenshotUrl?: string;

  // Timestamps
  createdAt: Date;
  completedAt?: Date;
  deletedAt?: Date;
}

// ============================================
// Analysis History Item (for API response)
// ============================================
export interface AnalysisHistoryItem {
  id: string;
  url: string;
  pageTitle?: string;
  pageDescription?: string;
  screenshotUrl?: string;
  tokensUsed: number;
  status: AnalysisStatus;
  createdAt: Date;
  completedAt?: Date;
}
