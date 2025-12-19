import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../../config/env';
import {
  IGalleryUser,
  GalleryJWTPayload,
  GalleryTokenPair
} from '../gallery.types';
import { galleryRefreshTokenRepository } from '../../../shared/repositories/postgres/gallery.repository';

export class GalleryTokenService {
  private readonly accessSecret = env.JWT_SECRET;
  private readonly accessExpiration = env.JWT_ACCESS_EXPIRATION;
  private readonly refreshExpiration = env.JWT_REFRESH_EXPIRATION;

  /**
   * Generate access token for gallery user
   */
  generateAccessToken(user: IGalleryUser): string {
    const payload: Partial<GalleryJWTPayload> = {
      sub: user.id,
      email: user.email,
      username: user.username,
      subscriptionTier: user.subscriptionTier,
      type: 'gallery' // Important: distinguish from panel users
    };

    return jwt.sign(payload as any, this.accessSecret as any, {
      expiresIn: this.accessExpiration as any
    });
  }

  /**
   * Generate refresh token (random string, stored in DB)
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Hash token for storage
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate both tokens
   */
  async generateTokenPair(
    user: IGalleryUser,
    userAgent?: string,
    ipAddress?: string
  ): Promise<GalleryTokenPair> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    // Calculate expiration
    const expiresAt = this.calculateRefreshExpiration();

    // Store hashed refresh token in DB
    await galleryRefreshTokenRepository.create({
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
  verifyAccessToken(token: string): GalleryJWTPayload | null {
    try {
      const payload = jwt.verify(token, this.accessSecret) as GalleryJWTPayload;
      // Verify it's a gallery token
      if (payload.type !== 'gallery') {
        return null;
      }
      return payload;
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
  ): Promise<{ userId: string; newTokenPair: GalleryTokenPair } | null> {
    const hashedToken = this.hashToken(refreshToken);
    const storedToken = await galleryRefreshTokenRepository.findByToken(hashedToken);

    if (!storedToken) {
      return null;
    }

    // Check if expired
    if (new Date() > storedToken.expiresAt) {
      await galleryRefreshTokenRepository.revoke(storedToken.id);
      return null;
    }

    // Generate new refresh token
    const newRefreshToken = this.generateRefreshToken();
    const newHashedToken = this.hashToken(newRefreshToken);

    // Revoke old token and mark it as replaced
    await galleryRefreshTokenRepository.revoke(storedToken.id, newHashedToken);

    // Store new refresh token
    const expiresAt = this.calculateRefreshExpiration();
    await galleryRefreshTokenRepository.create({
      userId: storedToken.userId,
      token: newHashedToken,
      expiresAt,
      userAgent,
      ipAddress
    });

    // Get user and generate access token
    const { galleryUserRepository } = await import('../../../shared/repositories/postgres/gallery.repository');
    const user = await galleryUserRepository.findById(storedToken.userId);

    if (!user || !user.isActive) {
      return null;
    }

    const accessToken = this.generateAccessToken(user);

    return {
      userId: storedToken.userId,
      newTokenPair: { accessToken, refreshToken: newRefreshToken }
    };
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await galleryRefreshTokenRepository.revokeAllForUser(userId);
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

export const galleryTokenService = new GalleryTokenService();
