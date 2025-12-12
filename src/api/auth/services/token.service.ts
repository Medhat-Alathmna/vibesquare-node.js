import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../../config/env';
import { JWTPayload, TokenPair, IUser, IRole } from '../auth.types';
import {
  refreshTokenRepository,
  roleRepository,
  permissionRepository
} from '../../../shared/repositories/postgres/auth.repository';

export class TokenService {
  private readonly accessSecret = env.JWT_SECRET;
  private readonly accessExpiration = env.JWT_ACCESS_EXPIRATION;
  private readonly refreshExpiration = env.JWT_REFRESH_EXPIRATION;

  /**
   * Generate access token
   */
  generateAccessToken(user: IUser, role?: IRole | null): string {
    const payload: Partial<JWTPayload> = {
      sub: user.id,
      email: user.email
    };

    if (role) {
      payload.role = role.name;
      payload.canAccessAdmin = role.canAccessAdmin;
      payload.permissions = role.permissions;
    }

    return jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessExpiration
    });
  }

  /**
   * Generate refresh token (random string, stored in DB)
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Hash refresh token for storage
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate both tokens
   */
  async generateTokenPair(
    user: IUser,
    userAgent?: string,
    ipAddress?: string
  ): Promise<TokenPair> {
    // Get user's role if exists
    let role: IRole | null = null;
    if (user.roleId) {
      role = await roleRepository.findById(user.roleId);
    }

    const accessToken = this.generateAccessToken(user, role);
    const refreshToken = this.generateRefreshToken();

    // Calculate expiration
    const expiresAt = this.calculateRefreshExpiration();

    // Store hashed refresh token in DB
    await refreshTokenRepository.create({
      userId: user.id,
      token: this.hashToken(refreshToken),
      expiresAt,
      userAgent,
      ipAddress
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.accessSecret) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Verify and rotate refresh token
   */
  async verifyAndRotateRefreshToken(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ userId: string; newTokenPair: TokenPair } | null> {
    const hashedToken = this.hashToken(refreshToken);
    const storedToken = await refreshTokenRepository.findByToken(hashedToken);

    if (!storedToken) {
      return null;
    }

    // Check if expired
    if (new Date() > storedToken.expiresAt) {
      await refreshTokenRepository.revoke(storedToken.id);
      return null;
    }

    // Generate new refresh token
    const newRefreshToken = this.generateRefreshToken();
    const newHashedToken = this.hashToken(newRefreshToken);

    // Revoke old token and mark it as replaced
    await refreshTokenRepository.revoke(storedToken.id, newHashedToken);

    // Store new refresh token
    const expiresAt = this.calculateRefreshExpiration();
    await refreshTokenRepository.create({
      userId: storedToken.userId,
      token: newHashedToken,
      expiresAt,
      userAgent,
      ipAddress
    });

    // Get user and generate access token
    const { userRepository } = await import('../../../shared/repositories/postgres/auth.repository');
    const user = await userRepository.findById(storedToken.userId);

    if (!user) {
      return null;
    }

    let role: IRole | null = null;
    if (user.roleId) {
      role = await roleRepository.findById(user.roleId);
    }

    const accessToken = this.generateAccessToken(user, role);

    return {
      userId: storedToken.userId,
      newTokenPair: { accessToken, refreshToken: newRefreshToken }
    };
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await refreshTokenRepository.revokeAllForUser(userId);
  }

  /**
   * Generate secure random token (for password reset, email verification)
   */
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Calculate refresh token expiration
   */
  private calculateRefreshExpiration(): Date {
    const match = this.refreshExpiration.match(/^(\d+)([dhm])$/);
    if (!match) {
      // Default to 7 days
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    let milliseconds: number;
    switch (unit) {
      case 'd':
        milliseconds = value * 24 * 60 * 60 * 1000;
        break;
      case 'h':
        milliseconds = value * 60 * 60 * 1000;
        break;
      case 'm':
        milliseconds = value * 60 * 1000;
        break;
      default:
        milliseconds = 7 * 24 * 60 * 60 * 1000;
    }

    return new Date(Date.now() + milliseconds);
  }
}

export const tokenService = new TokenService();
