import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import { env } from '../../../config/env';
import {
  IGalleryUser,
  GalleryAuthResponse,
  SafeGalleryUser,
  GalleryRegisterRequest,
  GalleryLoginRequest,
  GalleryTokenPair,
  GALLERY_PASSWORD_MIN_LENGTH,
  GALLERY_PASSWORD_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_PATTERN,
  RESERVED_USERNAMES,
  FREE_USER_DOWNLOAD_COOLDOWN_MS
} from '../gallery.types';
import {
  galleryUserRepository,
  galleryEmailVerificationRepository,
  galleryPasswordResetRepository,
  galleryLoginHistoryRepository,
  gallerySubscriptionRepository
} from '../../../shared/repositories/postgres/gallery.repository';
import { galleryTokenUsageRepository } from '../../../shared/repositories/postgres/gallery-token.repository';
import { galleryTokenService } from './gallery-token.service';
import { emailService } from '../../auth/services/email.service';

export class GalleryAuthService {
  /**
   * Register a new gallery user
   */
  async register(
    data: GalleryRegisterRequest,
    userAgent?: string,
    ipAddress?: string
  ): Promise<GalleryAuthResponse> {
    // Validate username
    this.validateUsername(data.username);

    // Validate password
    this.validatePassword(data.password);

    // Check if email already exists
    const existingEmail = await galleryUserRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new ApiError(httpStatus.CONFLICT, 'Email already registered');
    }

    // Check if username already exists
    const existingUsername = await galleryUserRepository.findByUsername(data.username);
    if (existingUsername) {
      throw new ApiError(httpStatus.CONFLICT, 'Username already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);

    // Create user
    const user = await galleryUserRepository.create({
      username: data.username.toLowerCase(),
      email: data.email.toLowerCase(),
      password: hashedPassword,
      isActive: true,
      emailVerified: false,
      subscriptionTier: 'free',
      socialLinks: {}
    });

    // Create free subscription record
    await gallerySubscriptionRepository.create({
      userId: user.id,
      tier: 'free',
      status: 'active'
    });

    // Initialize token quota
    await galleryTokenUsageRepository.initializeForUser(user.id);

    // Generate email verification token
    const verificationToken = galleryTokenService.generateSecureToken();
    const hashedVerificationToken = galleryTokenService.hashToken(verificationToken);
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await galleryEmailVerificationRepository.create({
      userId: user.id,
      token: hashedVerificationToken,
      expiresAt: verificationExpiry
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, verificationToken, user.username);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Don't fail registration if email fails
    }

    // Generate tokens
    const tokens = await galleryTokenService.generateTokenPair(user, userAgent, ipAddress);

    // Log login history
    await galleryLoginHistoryRepository.create({
      userId: user.id,
      provider: 'local',
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      success: true
    });

    return {
      user: this.toSafeUser(user),
      accessToken: tokens.accessToken
    };
  }

  /**
   * Login with email and password
   */
  async login(
    data: GalleryLoginRequest,
    userAgent?: string,
    ipAddress?: string
  ): Promise<GalleryAuthResponse & { refreshToken: string }> {
    const user = await galleryUserRepository.findByEmail(data.email);

    if (!user) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ApiError(
        httpStatus.TOO_MANY_REQUESTS,
        `Account is locked. Try again in ${remainingMinutes} minutes.`
      );
    }

    if (!user.password) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'This account uses social login. Please sign in with Google or GitHub.'
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      // Increment failed attempts
      await galleryUserRepository.incrementFailedAttempts(user.id);

      // Log failed attempt
      await galleryLoginHistoryRepository.create({
        userId: user.id,
        provider: 'local',
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        success: false,
        failureReason: 'invalid_password'
      });

      // Check if should lock account
      const updatedUser = await galleryUserRepository.findById(user.id);
      if (updatedUser && updatedUser.failedLoginAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await galleryUserRepository.lockAccount(user.id, lockUntil);
        throw new ApiError(
          httpStatus.TOO_MANY_REQUESTS,
          'Too many failed attempts. Account locked for 15 minutes.'
        );
      }

      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Account is deactivated');
    }

    // Reset failed attempts
    await galleryUserRepository.resetFailedAttempts(user.id);

    // Update last login
    await galleryUserRepository.updateLastLogin(user.id);

    // Generate tokens
    const tokens = await galleryTokenService.generateTokenPair(user, userAgent, ipAddress);

    // Log successful login
    await galleryLoginHistoryRepository.create({
      userId: user.id,
      provider: 'local',
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      success: true
    });

    // Get fresh user data
    const freshUser = await galleryUserRepository.findById(user.id);

    return {
      user: this.toSafeUser(freshUser!),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(userId: string): Promise<void> {
    await galleryTokenService.revokeAllUserTokens(userId);
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<GalleryTokenPair> {
    const result = await galleryTokenService.verifyAndRotateRefreshToken(
      refreshToken,
      userAgent,
      ipAddress
    );

    if (!result) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    return result.newTokenPair;
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    const hashedToken = galleryTokenService.hashToken(token);
    const verificationToken = await galleryEmailVerificationRepository.findByToken(hashedToken);

    if (!verificationToken) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired verification token');
    }

    // Mark token as used
    await galleryEmailVerificationRepository.markUsed(verificationToken.id);

    // Update user
    await galleryUserRepository.update(verificationToken.userId, {
      emailVerified: true
    });
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await galleryUserRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (user.emailVerified) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Email is already verified');
    }

    // Delete old tokens
    await galleryEmailVerificationRepository.deleteForUser(userId);

    // Generate new token
    const verificationToken = galleryTokenService.generateSecureToken();
    const hashedVerificationToken = galleryTokenService.hashToken(verificationToken);
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await galleryEmailVerificationRepository.create({
      userId: user.id,
      token: hashedVerificationToken,
      expiresAt: verificationExpiry
    });

    // Send email
    await emailService.sendVerificationEmail(user.email, verificationToken, user.username);
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await galleryUserRepository.findByEmail(email);

    // Don't reveal if email exists
    if (!user) {
      return;
    }

    if (!user.password) {
      // OAuth-only account
      return;
    }

    // Delete old tokens
    await galleryPasswordResetRepository.deleteForUser(user.id);

    // Generate reset token
    const resetToken = galleryTokenService.generateSecureToken();
    const hashedResetToken = galleryTokenService.hashToken(resetToken);
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await galleryPasswordResetRepository.create({
      userId: user.id,
      token: hashedResetToken,
      expiresAt: resetExpiry
    });

    // Send email
    await emailService.sendPasswordResetEmail(user.email, resetToken, user.username);
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    this.validatePassword(newPassword);

    const hashedToken = galleryTokenService.hashToken(token);
    const resetToken = await galleryPasswordResetRepository.findByToken(hashedToken);

    if (!resetToken) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

    // Update user
    await galleryUserRepository.update(resetToken.userId, {
      password: hashedPassword,
      passwordChangedAt: new Date()
    });

    // Mark token as used
    await galleryPasswordResetRepository.markUsed(resetToken.id);

    // Revoke all refresh tokens
    await galleryTokenService.revokeAllUserTokens(resetToken.userId);
  }

  /**
   * Change password (for logged in users)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await galleryUserRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (!user.password) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot change password for social login accounts'
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Current password is incorrect');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Check new password is different
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'New password must be different from current password');
    }

    // Hash and update
    const hashedPassword = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await galleryUserRepository.update(userId, {
      password: hashedPassword,
      passwordChangedAt: new Date()
    });

    // Revoke all refresh tokens (logout all devices)
    await galleryTokenService.revokeAllUserTokens(userId);
  }

  /**
   * Handle OAuth login/register
   */
  async handleOAuthLogin(
    provider: 'google' | 'github',
    profile: {
      id: string;
      email: string;
      username?: string;
      avatarUrl?: string;
    },
    userAgent?: string,
    ipAddress?: string
  ): Promise<GalleryAuthResponse & { refreshToken: string; isNewUser: boolean }> {
    let user: IGalleryUser | null = null;
    let isNewUser = false;

    // Find by provider ID
    if (provider === 'google') {
      user = await galleryUserRepository.findByGoogleId(profile.id);
    } else {
      user = await galleryUserRepository.findByGithubId(profile.id);
    }

    // If not found by provider ID, try email
    if (!user) {
      const existingUserWithEmail = await galleryUserRepository.findByEmail(profile.email);

      if (existingUserWithEmail) {
        // 🔐 SECURITY: Prevent auto-linking to stop account takeover
        console.warn(
          `OAuth ${provider} login blocked: email ${profile.email} already exists ` +
          `(user: ${existingUserWithEmail.id})`
        );

        // Log security event
        await galleryLoginHistoryRepository.create({
          userId: existingUserWithEmail.id,
          provider,
          ipAddress: ipAddress || 'unknown',
          userAgent: userAgent || 'unknown',
          success: false,
          failureReason: 'oauth_email_conflict_prevented_auto_linking'
        });

        // Send security notification (non-blocking)
        emailService.sendAccountLinkingAttempt(
          existingUserWithEmail.email,
          existingUserWithEmail.username,
          provider,
          ipAddress || 'unknown',
          userAgent || 'unknown'
        ).catch(err => console.error('Failed to send security email:', err));

        // Return clear error to user
        throw new ApiError(
          httpStatus.CONFLICT,
          `An account with ${profile.email} already exists. ` +
          `Please sign in with your password. Check your email for details.`
        );
      }

      // No conflict - proceed with new user creation
      user = null;
    }

    // Create new user if not found
    if (!user) {
      isNewUser = true;
      const baseUsername = profile.username || profile.email.split('@')[0];

      const MAX_CREATE_ATTEMPTS = 5;
      let createAttempt = 0;

      while (createAttempt < MAX_CREATE_ATTEMPTS && !user) {
        createAttempt++;

        try {
          const finalUsername = await this.generateUniqueUsername(baseUsername);

          user = await galleryUserRepository.create({
            username: finalUsername,
            email: profile.email.toLowerCase(),
            avatarUrl: profile.avatarUrl,
            isActive: true,
            emailVerified: true, // OAuth emails are verified
            subscriptionTier: 'free',
            socialLinks: {},
            googleId: provider === 'google' ? profile.id : undefined,
            githubId: provider === 'github' ? profile.id : undefined
          });
          break; // Success

        } catch (error: any) {
          const isUsernameConflict = error.code === '23505' &&
            error.message?.includes('gallery_users_username_key');

          if (isUsernameConflict && createAttempt < MAX_CREATE_ATTEMPTS) {
            console.warn(`Username conflict on attempt ${createAttempt}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, createAttempt) * 100));
            continue;
          }

          throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            'Failed to create user account. Please try again.'
          );
        }
      }

      if (!user) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to create user account after multiple attempts'
        );
      }

      // Create free subscription (idempotent for retries)
      try {
        await gallerySubscriptionRepository.createIdempotent({
          userId: user.id,
          tier: 'free',
          status: 'active'
        });
      } catch (error) {
        console.error('Subscription creation failed for new OAuth user:', error);
        // Don't fail login - subscription can be created later
        // User creation succeeded, allow login to proceed
      }

      // Initialize token quota
      await galleryTokenUsageRepository.initializeForUser(user.id);
    }

    if (!user.isActive) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Account is deactivated');
    }

    // Update last login
    await galleryUserRepository.updateLastLogin(user.id);

    // Generate tokens
    const tokens = await galleryTokenService.generateTokenPair(user, userAgent, ipAddress);

    // Log login
    await galleryLoginHistoryRepository.create({
      userId: user.id,
      provider,
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      success: true
    });

    // Get fresh user
    const freshUser = await galleryUserRepository.findById(user.id);

    return {
      user: this.toSafeUser(freshUser!),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNewUser
    };
  }

  /**
   * Validate username
   */
  private validateUsername(username: string): void {
    if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters`
      );
    }

    if (!USERNAME_PATTERN.test(username.toLowerCase())) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Username must start with a letter and contain only lowercase letters, numbers, and underscores'
      );
    }

    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'This username is not available');
    }
  }

  /**
   * Generate unique username with optimistic concurrency control
   * Handles race conditions via retry mechanism
   */
  private async generateUniqueUsername(baseUsername: string, maxRetries = 10): Promise<string> {
    let username = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let candidate = username;
      if (attempt > 0) {
        // Random suffix لتقليل احتمالية التصادم
        const randomSuffix = Math.floor(Math.random() * 10000);
        candidate = `${username.slice(0, 16)}_${randomSuffix}`;
      }

      const existing = await galleryUserRepository.findByUsername(candidate);
      if (!existing) return candidate;
    }

    // Fallback: timestamp-based لضمان النجاح
    const timestamp = Date.now().toString(36);
    return `${username.slice(0, 12)}_${timestamp}`;
  }

  /**
   * Validate password (lighter policy for gallery users)
   */
  private validatePassword(password: string): void {
    if (password.length < GALLERY_PASSWORD_MIN_LENGTH) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Password must be at least ${GALLERY_PASSWORD_MIN_LENGTH} characters`
      );
    }

    if (password.length > GALLERY_PASSWORD_MAX_LENGTH) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Password must not exceed ${GALLERY_PASSWORD_MAX_LENGTH} characters`
      );
    }

    // Check for at least one letter and one number
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Password must contain at least one letter and one number'
      );
    }
  }

  /**
   * Convert user to safe user (remove sensitive data)
   */
  toSafeUser(user: IGalleryUser): SafeGalleryUser {
    const canDownload = this.checkCanDownload(user);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      socialLinks: user.socialLinks,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      subscriptionTier: user.subscriptionTier,
      lastDownloadAt: user.lastDownloadAt,
      canDownload,
      hasPanelAccess: !!user.panelUserId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };
  }

  /**
   * Check if user can download
   */
  private checkCanDownload(user: IGalleryUser): boolean {
    if (user.subscriptionTier === 'pro') {
      return true;
    }

    if (!user.lastDownloadAt) {
      return true;
    }

    const cooldownEnd = user.lastDownloadAt.getTime() + FREE_USER_DOWNLOAD_COOLDOWN_MS;
    return Date.now() >= cooldownEnd;
  }
}

export const galleryAuthService = new GalleryAuthService();
