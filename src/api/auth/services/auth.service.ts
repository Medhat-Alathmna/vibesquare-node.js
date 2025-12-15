import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import { env } from '../../../config/env';
import {
  userRepository,
  roleRepository,
  loginHistoryRepository,
  passwordResetRepository,
  emailVerificationRepository,
  subscriptionRepository
} from '../../../shared/repositories/postgres/auth.repository';
import { tokenService } from './token.service';
import { passwordService } from './password.service';
import { emailService } from './email.service';
import {
  IUser,
  IRole,
  SafeUser,
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  IOAuthProfile,
  AuthProvider,
  TokenPair
} from '../auth.types';

export class AuthService {
  private readonly lockoutMinutes = env.ACCOUNT_LOCKOUT_MINUTES;
  private readonly maxFailedAttempts = env.LOGIN_RATE_LIMIT_MAX;

  // ============================================
  // Registration
  // ============================================

  /**
   * Register new user with email/password
   */
  async register(data: RegisterRequest, ipAddress: string, userAgent: string): Promise<{ user: SafeUser; message: string }> {
    // Check if email already exists
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ApiError(httpStatus.CONFLICT, 'Email already registered');
    }

    // Validate password
    const passwordValidation = passwordService.validate(data.password);
    if (!passwordValidation.valid) {
      throw new ApiError(httpStatus.BAD_REQUEST, passwordValidation.errors.join('. '));
    }

    // Check if password contains user info
    if (passwordService.containsUserInfo(data.password, data.email, data.firstName, data.lastName)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Password should not contain your personal information');
    }

    // Hash password
    const hashedPassword = await passwordService.hash(data.password);

    // Create user
    const user = await userRepository.create({
      email: data.email.toLowerCase(),
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      isActive: true,
      emailVerified: false,
      mustChangePassword: false,
      isSystem: false,
      subscriptionTier: 'free'
    });

    // Create free subscription
    await subscriptionRepository.create({
      userId: user.id,
      tier: 'free',
      status: 'active'
    });

    // Generate email verification token
    const verificationToken = tokenService.generateSecureToken();
    await emailVerificationRepository.create({
      userId: user.id,
      token: tokenService.hashToken(verificationToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    // Send verification email
    await emailService.sendVerificationEmail(user.email, verificationToken, user.firstName);

    // Log registration
    await loginHistoryRepository.create({
      userId: user.id,
      provider: 'local',
      ipAddress,
      userAgent,
      success: true
    });

    return {
      user: await this.toSafeUser(user),
      message: 'Registration successful. Please check your email to verify your account.'
    };
  }

  // ============================================
  // Login
  // ============================================

  /**
   * Login with email/password
   */
  async login(
    data: LoginRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthResponse & { refreshToken: string }> {
    const user = await userRepository.findByEmail(data.email);

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

    // Check if user has password (might be OAuth-only)
    if (!user.password) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'This account uses social login. Please sign in with Google or GitHub.'
      );
    }

    // Verify password
    const isPasswordValid = await passwordService.compare(data.password, user.password);

    if (!isPasswordValid) {
      // Increment failed attempts
      await userRepository.incrementFailedAttempts(user.id);

      // Check if should lock account
      const failedAttempts = user.failedLoginAttempts + 1;
      if (failedAttempts >= this.maxFailedAttempts) {
        const lockUntil = new Date(Date.now() + this.lockoutMinutes * 60 * 1000);
        await userRepository.lockAccount(user.id, lockUntil);
      }

      // Log failed attempt
      await loginHistoryRepository.create({
        userId: user.id,
        provider: 'local',
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'Invalid password'
      });

      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Account is deactivated. Please contact support.');
    }

    // Reset failed attempts on successful login
    await userRepository.resetFailedAttempts(user.id);

    // Update last login
    await userRepository.update(user.id, { lastLoginAt: new Date() });

    // Generate tokens
    const { accessToken, refreshToken } = await tokenService.generateTokenPair(user, userAgent, ipAddress);

    // Log successful login
    await loginHistoryRepository.create({
      userId: user.id,
      provider: 'local',
      ipAddress,
      userAgent,
      success: true
    });

    // Get role info
    let role: IRole | null = null;
    if (user.roleId) {
      role = await roleRepository.findById(user.roleId);
    }

    return {
      user: await this.toSafeUser(user, role),
      accessToken,
      refreshToken
    };
  }

  // ============================================
  // OAuth
  // ============================================

  /**
   * Handle OAuth login/registration
   */
  async handleOAuthLogin(
    profile: IOAuthProfile,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthResponse & { refreshToken: string; isNewUser: boolean }> {
    let user: IUser | null = null;
    let isNewUser = false;

    // Try to find existing user by provider ID
    if (profile.provider === 'google') {
      user = await userRepository.findByGoogleId(profile.id);
    } else if (profile.provider === 'github') {
      user = await userRepository.findByGithubId(profile.id);
    }

    // If not found by provider ID, try email
    if (!user && profile.email) {
      user = await userRepository.findByEmail(profile.email);

      // Link OAuth to existing account
      if (user) {
        const updateData: Partial<IUser> = {};
        if (profile.provider === 'google') {
          updateData.googleId = profile.id;
        } else if (profile.provider === 'github') {
          updateData.githubId = profile.id;
        }

        // Update avatar if not set
        if (!user.avatarUrl && profile.avatarUrl) {
          updateData.avatarUrl = profile.avatarUrl;
        }

        user = await userRepository.update(user.id, updateData);
      }
    }

    // Create new user if not found
    if (!user) {
      isNewUser = true;

      const userData: Partial<IUser> = {
        email: profile.email.toLowerCase(),
        firstName: profile.firstName || profile.email.split('@')[0],
        lastName: profile.lastName || '',
        avatarUrl: profile.avatarUrl,
        isActive: true,
        emailVerified: true, // OAuth emails are verified
        mustChangePassword: false,
        isSystem: false,
        subscriptionTier: 'free'
      };

      if (profile.provider === 'google') {
        userData.googleId = profile.id;
      } else if (profile.provider === 'github') {
        userData.githubId = profile.id;
      }

      user = await userRepository.create(userData as any);

      // Create free subscription
      await subscriptionRepository.create({
        userId: user.id,
        tier: 'free',
        status: 'active'
      });

      // Send welcome email
      await emailService.sendWelcomeEmail(user.email, user.firstName);
    }

    // Check if account is active
    if (!user.isActive) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Account is deactivated. Please contact support.');
    }

    // Update last login
    await userRepository.update(user.id, { lastLoginAt: new Date() });

    // Generate tokens
    const { accessToken, refreshToken } = await tokenService.generateTokenPair(user, userAgent, ipAddress);

    // Log login
    await loginHistoryRepository.create({
      userId: user.id,
      provider: profile.provider as AuthProvider,
      ipAddress,
      userAgent,
      success: true
    });

    // Get role info
    let role: IRole | null = null;
    if (user.roleId) {
      role = await roleRepository.findById(user.roleId);
    }

    return {
      user: await this.toSafeUser(user, role),
      accessToken,
      refreshToken,
      isNewUser
    };
  }

  // ============================================
  // Token Management
  // ============================================

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshToken: string,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthResponse & { refreshToken: string }> {
    const result = await tokenService.verifyAndRotateRefreshToken(refreshToken, userAgent, ipAddress);

    if (!result) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    const user = await userRepository.findById(result.userId);
    if (!user || !user.isActive) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found or inactive');
    }

    let role: IRole | null = null;
    if (user.roleId) {
      role = await roleRepository.findById(user.roleId);
    }

    return {
      user: await this.toSafeUser(user, role),
      accessToken: result.newTokenPair.accessToken,
      refreshToken: result.newTokenPair.refreshToken
    };
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(userId: string): Promise<void> {
    await tokenService.revokeAllUserTokens(userId);
  }

  // ============================================
  // Email Verification
  // ============================================

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ user: SafeUser; message: string }> {
    const hashedToken = tokenService.hashToken(token);
    const verificationToken = await emailVerificationRepository.findByToken(hashedToken);

    if (!verificationToken) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired verification token');
    }

    // Mark token as used
    await emailVerificationRepository.markUsed(verificationToken.id);

    // Update user
    const user = await userRepository.update(verificationToken.userId, { emailVerified: true });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.firstName);

    return {
      user: await this.toSafeUser(user),
      message: 'Email verified successfully'
    };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await userRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email is registered, you will receive a verification link.' };
    }

    if (user.emailVerified) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Email is already verified');
    }

    // Delete old tokens
    await emailVerificationRepository.deleteForUser(user.id);

    // Generate new token
    const verificationToken = tokenService.generateSecureToken();
    await emailVerificationRepository.create({
      userId: user.id,
      token: tokenService.hashToken(verificationToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    // Send email
    await emailService.sendVerificationEmail(user.email, verificationToken, user.firstName);

    return { message: 'If the email is registered, you will receive a verification link.' };
  }

  // ============================================
  // Password Reset
  // ============================================

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await userRepository.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email is registered, you will receive a password reset link.' };
    }

    // Delete old tokens
    await passwordResetRepository.deleteForUser(user.id);

    // Generate new token
    const resetToken = tokenService.generateSecureToken();
    await passwordResetRepository.create({
      userId: user.id,
      token: tokenService.hashToken(resetToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    });

    // Send email
    await emailService.sendPasswordResetEmail(user.email, resetToken, user.firstName);

    return { message: 'If the email is registered, you will receive a password reset link.' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const hashedToken = tokenService.hashToken(token);
    const resetToken = await passwordResetRepository.findByToken(hashedToken);

    if (!resetToken) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired reset token');
    }

    // Validate new password
    const passwordValidation = passwordService.validate(newPassword);
    if (!passwordValidation.valid) {
      throw new ApiError(httpStatus.BAD_REQUEST, passwordValidation.errors.join('. '));
    }

    // Get user
    const user = await userRepository.findById(resetToken.userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Check if password contains user info
    if (passwordService.containsUserInfo(newPassword, user.email, user.firstName, user.lastName)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Password should not contain your personal information');
    }

    // Hash and update password
    const hashedPassword = await passwordService.hash(newPassword);
    await userRepository.update(user.id, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      mustChangePassword: false
    });

    // Mark token as used
    await passwordResetRepository.markUsed(resetToken.id);

    // Revoke all refresh tokens
    await tokenService.revokeAllUserTokens(user.id);

    // Send notification
    await emailService.sendPasswordChangedNotification(user.email, user.firstName);

    return { message: 'Password reset successfully. Please login with your new password.' };
  }

  /**
   * Change password (for logged-in users)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Check if user has password
    if (!user.password) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot change password for OAuth-only account. Please link an email first.'
      );
    }

    // Verify current password
    const isPasswordValid = await passwordService.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Current password is incorrect');
    }

    // Validate new password
    const passwordValidation = passwordService.validate(newPassword);
    if (!passwordValidation.valid) {
      throw new ApiError(httpStatus.BAD_REQUEST, passwordValidation.errors.join('. '));
    }

    // Check if new password is same as current
    const isSamePassword = await passwordService.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'New password must be different from current password');
    }

    // Check if password contains user info
    if (passwordService.containsUserInfo(newPassword, user.email, user.firstName, user.lastName)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Password should not contain your personal information');
    }

    // Hash and update password
    const hashedPassword = await passwordService.hash(newPassword);
    await userRepository.update(user.id, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      mustChangePassword: false
    });

    // Revoke all refresh tokens (except current one if needed)
    await tokenService.revokeAllUserTokens(user.id);

    // Send notification
    await emailService.sendPasswordChangedNotification(user.email, user.firstName);

    return { message: 'Password changed successfully' };
  }

  // ============================================
  // Profile
  // ============================================

  /**
   * Get current user profile
   */
  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    let role: IRole | null = null;
    if (user.roleId) {
      role = await roleRepository.findById(user.roleId);
    }

    return await this.toSafeUser(user, role);
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Convert user to safe user (remove sensitive data)
   */
  private async toSafeUser(user: IUser, role?: IRole | null): Promise<SafeUser> {
    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      subscriptionTier: user.subscriptionTier,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };

    if (role) {
      safeUser.role = {
        id: role.id,
        name: role.name,
        canAccessAdmin: role.canAccessAdmin,
        permissions: role.permissions || []
      };
    }

    return safeUser;
  }
}

export const authService = new AuthService();
