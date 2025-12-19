import { pgPool } from '../../../config/database';
import { v4 as uuidv4 } from 'uuid';
import {
  IGalleryUser,
  IGalleryRefreshToken,
  IGalleryEmailVerificationToken,
  IGalleryPasswordResetToken,
  IGalleryLoginHistory,
  IGalleryFavorite,
  IGallerySubscription,
  IGalleryNotification,
  IGalleryActivityLog,
  GallerySubscriptionTier,
  GallerySubscriptionStatus,
  NotificationType,
  ActivityAction,
  ISocialLinks,
  PaginatedResult
} from '../../../api/gallery/gallery.types';
import { AuthProvider } from '../../../api/auth/auth.types';

// ============================================
// Gallery User Repository
// ============================================
export class GalleryUserRepository {
  async create(data: Omit<IGalleryUser, 'id' | 'createdAt' | 'updatedAt' | 'failedLoginAttempts'>): Promise<IGalleryUser> {
    const id = `guser-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_users (
        id, username, email, password, avatar_url, bio, social_links,
        google_id, github_id, is_active, email_verified, subscription_tier,
        last_download_at, panel_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        id, data.username, data.email, data.password, data.avatarUrl, data.bio,
        JSON.stringify(data.socialLinks || {}), data.googleId, data.githubId,
        data.isActive ?? true, data.emailVerified ?? false,
        data.subscriptionTier || 'free', data.lastDownloadAt, data.panelUserId
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findAll(page = 1, limit = 20): Promise<PaginatedResult<IGalleryUser>> {
    const offset = (page - 1) * limit;
    const [usersResult, countResult] = await Promise.all([
      pgPool.query(
        'SELECT * FROM gallery_users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      pgPool.query('SELECT COUNT(*) FROM gallery_users')
    ]);
    const total = parseInt(countResult.rows[0].count, 10);
    return {
      data: usersResult.rows.map(this.mapRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findById(id: string): Promise<IGalleryUser | null> {
    const result = await pgPool.query('SELECT * FROM gallery_users WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<IGalleryUser | null> {
    const result = await pgPool.query('SELECT * FROM gallery_users WHERE LOWER(email) = LOWER($1)', [email]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByUsername(username: string): Promise<IGalleryUser | null> {
    const result = await pgPool.query('SELECT * FROM gallery_users WHERE LOWER(username) = LOWER($1)', [username]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByGoogleId(googleId: string): Promise<IGalleryUser | null> {
    const result = await pgPool.query('SELECT * FROM gallery_users WHERE google_id = $1', [googleId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByGithubId(githubId: string): Promise<IGalleryUser | null> {
    const result = await pgPool.query('SELECT * FROM gallery_users WHERE github_id = $1', [githubId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByPanelUserId(panelUserId: string): Promise<IGalleryUser | null> {
    const result = await pgPool.query('SELECT * FROM gallery_users WHERE panel_user_id = $1', [panelUserId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async update(id: string, data: Partial<Omit<IGalleryUser, 'id' | 'createdAt'>>): Promise<IGalleryUser | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      username: 'username',
      email: 'email',
      password: 'password',
      avatarUrl: 'avatar_url',
      bio: 'bio',
      socialLinks: 'social_links',
      googleId: 'google_id',
      githubId: 'github_id',
      isActive: 'is_active',
      emailVerified: 'email_verified',
      subscriptionTier: 'subscription_tier',
      lastDownloadAt: 'last_download_at',
      failedLoginAttempts: 'failed_login_attempts',
      lockedUntil: 'locked_until',
      lastLoginAt: 'last_login_at',
      passwordChangedAt: 'password_changed_at',
      panelUserId: 'panel_user_id'
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${dbField} = $${paramIndex++}`);
        const value = key === 'socialLinks' ? JSON.stringify((data as any)[key]) : (data as any)[key];
        values.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await pgPool.query(
      `UPDATE gallery_users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await pgPool.query(
      'UPDATE gallery_users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await pgPool.query(
      'DELETE FROM gallery_users WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async count(): Promise<number> {
    const result = await pgPool.query('SELECT COUNT(*) FROM gallery_users');
    return parseInt(result.rows[0].count, 10);
  }

  async countBySubscriptionTier(tier: GallerySubscriptionTier): Promise<number> {
    const result = await pgPool.query(
      'SELECT COUNT(*) FROM gallery_users WHERE subscription_tier = $1',
      [tier]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    await pgPool.query(
      'UPDATE gallery_users SET failed_login_attempts = failed_login_attempts + 1, updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await pgPool.query(
      'UPDATE gallery_users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async lockAccount(id: string, until: Date): Promise<void> {
    await pgPool.query(
      'UPDATE gallery_users SET locked_until = $1, updated_at = NOW() WHERE id = $2',
      [until, id]
    );
  }

  async updateLastDownload(id: string): Promise<void> {
    await pgPool.query(
      'UPDATE gallery_users SET last_download_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async updateLastLogin(id: string): Promise<void> {
    await pgPool.query(
      'UPDATE gallery_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async search(query: string, page = 1, limit = 20): Promise<PaginatedResult<IGalleryUser>> {
    const offset = (page - 1) * limit;
    const searchPattern = `%${query}%`;

    const [usersResult, countResult] = await Promise.all([
      pgPool.query(
        `SELECT * FROM gallery_users
         WHERE username ILIKE $1 OR email ILIKE $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [searchPattern, limit, offset]
      ),
      pgPool.query(
        'SELECT COUNT(*) FROM gallery_users WHERE username ILIKE $1 OR email ILIKE $1',
        [searchPattern]
      )
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return {
      data: usersResult.rows.map(this.mapRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  private mapRow(row: any): IGalleryUser {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      password: row.password,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      socialLinks: row.social_links || {},
      googleId: row.google_id,
      githubId: row.github_id,
      isActive: row.is_active,
      emailVerified: row.email_verified,
      subscriptionTier: row.subscription_tier as GallerySubscriptionTier,
      lastDownloadAt: row.last_download_at ? new Date(row.last_download_at) : undefined,
      failedLoginAttempts: row.failed_login_attempts,
      lockedUntil: row.locked_until ? new Date(row.locked_until) : undefined,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      passwordChangedAt: row.password_changed_at ? new Date(row.password_changed_at) : undefined,
      panelUserId: row.panel_user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// ============================================
// Gallery Refresh Token Repository
// ============================================
export class GalleryRefreshTokenRepository {
  async create(data: Omit<IGalleryRefreshToken, 'id' | 'createdAt'>): Promise<IGalleryRefreshToken> {
    const id = `grt-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_refresh_tokens (id, user_id, token, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, data.userId, data.token, data.expiresAt, data.userAgent, data.ipAddress]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByToken(token: string): Promise<IGalleryRefreshToken | null> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_refresh_tokens WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW()',
      [token]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async revoke(id: string, replacedByToken?: string): Promise<void> {
    await pgPool.query(
      'UPDATE gallery_refresh_tokens SET revoked_at = NOW(), replaced_by_token = $1 WHERE id = $2',
      [replacedByToken, id]
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await pgPool.query(
      'UPDATE gallery_refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  }

  async deleteExpired(): Promise<number> {
    const result = await pgPool.query(
      'DELETE FROM gallery_refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL RETURNING id'
    );
    return result.rowCount || 0;
  }

  private mapRow(row: any): IGalleryRefreshToken {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : undefined,
      replacedByToken: row.replaced_by_token,
      userAgent: row.user_agent,
      ipAddress: row.ip_address
    };
  }
}

// ============================================
// Gallery Email Verification Repository
// ============================================
export class GalleryEmailVerificationRepository {
  async create(data: Omit<IGalleryEmailVerificationToken, 'id' | 'createdAt'>): Promise<IGalleryEmailVerificationToken> {
    const id = `gev-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_email_verification_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, data.userId, data.token, data.expiresAt]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByToken(token: string): Promise<IGalleryEmailVerificationToken | null> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_email_verification_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
      [token]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markUsed(id: string): Promise<void> {
    await pgPool.query('UPDATE gallery_email_verification_tokens SET used_at = NOW() WHERE id = $1', [id]);
  }

  async deleteForUser(userId: string): Promise<void> {
    await pgPool.query('DELETE FROM gallery_email_verification_tokens WHERE user_id = $1', [userId]);
  }

  private mapRow(row: any): IGalleryEmailVerificationToken {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      usedAt: row.used_at ? new Date(row.used_at) : undefined,
      createdAt: new Date(row.created_at)
    };
  }
}

// ============================================
// Gallery Password Reset Repository
// ============================================
export class GalleryPasswordResetRepository {
  async create(data: Omit<IGalleryPasswordResetToken, 'id' | 'createdAt'>): Promise<IGalleryPasswordResetToken> {
    const id = `gpr-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_password_reset_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, data.userId, data.token, data.expiresAt]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByToken(token: string): Promise<IGalleryPasswordResetToken | null> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
      [token]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markUsed(id: string): Promise<void> {
    await pgPool.query('UPDATE gallery_password_reset_tokens SET used_at = NOW() WHERE id = $1', [id]);
  }

  async deleteForUser(userId: string): Promise<void> {
    await pgPool.query('DELETE FROM gallery_password_reset_tokens WHERE user_id = $1', [userId]);
  }

  private mapRow(row: any): IGalleryPasswordResetToken {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      usedAt: row.used_at ? new Date(row.used_at) : undefined,
      createdAt: new Date(row.created_at)
    };
  }
}

// ============================================
// Gallery Login History Repository
// ============================================
export class GalleryLoginHistoryRepository {
  async create(data: Omit<IGalleryLoginHistory, 'id' | 'createdAt'>): Promise<IGalleryLoginHistory> {
    const id = `glh-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_login_history (id, user_id, provider, ip_address, user_agent, success, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, data.userId, data.provider, data.ipAddress, data.userAgent, data.success, data.failureReason]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId: string, limit = 20): Promise<IGalleryLoginHistory[]> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_login_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows.map(this.mapRow);
  }

  async countRecentFailures(userId: string, minutes: number): Promise<number> {
    const result = await pgPool.query(
      `SELECT COUNT(*) FROM gallery_login_history
       WHERE user_id = $1 AND success = false AND created_at > NOW() - INTERVAL '${minutes} minutes'`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  private mapRow(row: any): IGalleryLoginHistory {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider as AuthProvider,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      success: row.success,
      failureReason: row.failure_reason,
      createdAt: new Date(row.created_at)
    };
  }
}

// ============================================
// Gallery Favorites Repository
// ============================================
export class GalleryFavoritesRepository {
  async create(userId: string, projectId: string): Promise<IGalleryFavorite> {
    const id = `gfav-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_favorites (id, user_id, project_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, project_id) DO NOTHING
       RETURNING *`,
      [id, userId, projectId]
    );

    if (!result.rows[0]) {
      // Already exists, fetch it
      const existing = await this.findByUserAndProject(userId, projectId);
      if (existing) return existing;
      throw new Error('Failed to create favorite');
    }

    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId: string, page = 1, limit = 20): Promise<PaginatedResult<IGalleryFavorite>> {
    const offset = (page - 1) * limit;
    const [favsResult, countResult] = await Promise.all([
      pgPool.query(
        'SELECT * FROM gallery_favorites WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      ),
      pgPool.query('SELECT COUNT(*) FROM gallery_favorites WHERE user_id = $1', [userId])
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return {
      data: favsResult.rows.map(this.mapRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findByUserAndProject(userId: string, projectId: string): Promise<IGalleryFavorite | null> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_favorites WHERE user_id = $1 AND project_id = $2',
      [userId, projectId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(userId: string, projectId: string): Promise<boolean> {
    const result = await pgPool.query(
      'DELETE FROM gallery_favorites WHERE user_id = $1 AND project_id = $2 RETURNING id',
      [userId, projectId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async countByUserId(userId: string): Promise<number> {
    const result = await pgPool.query(
      'SELECT COUNT(*) FROM gallery_favorites WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getProjectIds(userId: string): Promise<string[]> {
    const result = await pgPool.query(
      'SELECT project_id FROM gallery_favorites WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map(row => row.project_id);
  }

  private mapRow(row: any): IGalleryFavorite {
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      createdAt: new Date(row.created_at)
    };
  }
}

// ============================================
// Gallery Subscription Repository
// ============================================
export class GallerySubscriptionRepository {
  async create(data: Omit<IGallerySubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<IGallerySubscription> {
    const id = `gsub-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_subscriptions (
        id, user_id, tier, status, stripe_customer_id, stripe_subscription_id, stripe_price_id,
        current_period_start, current_period_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id, data.userId, data.tier, data.status, data.stripeCustomerId,
        data.stripeSubscriptionId, data.stripePriceId, data.currentPeriodStart, data.currentPeriodEnd
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId: string): Promise<IGallerySubscription | null> {
    const result = await pgPool.query('SELECT * FROM gallery_subscriptions WHERE user_id = $1', [userId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<IGallerySubscription | null> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_subscriptions WHERE stripe_customer_id = $1',
      [stripeCustomerId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async update(id: string, data: Partial<Omit<IGallerySubscription, 'id' | 'createdAt'>>): Promise<IGallerySubscription | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      tier: 'tier',
      status: 'status',
      stripeCustomerId: 'stripe_customer_id',
      stripeSubscriptionId: 'stripe_subscription_id',
      stripePriceId: 'stripe_price_id',
      currentPeriodStart: 'current_period_start',
      currentPeriodEnd: 'current_period_end',
      cancelledAt: 'cancelled_at'
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${dbField} = $${paramIndex++}`);
        values.push((data as any)[key]);
      }
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await pgPool.query(
      `UPDATE gallery_subscriptions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateByUserId(userId: string, data: Partial<Omit<IGallerySubscription, 'id' | 'createdAt' | 'userId'>>): Promise<IGallerySubscription | null> {
    const subscription = await this.findByUserId(userId);
    if (!subscription) return null;
    return this.update(subscription.id, data);
  }

  private mapRow(row: any): IGallerySubscription {
    return {
      id: row.id,
      userId: row.user_id,
      tier: row.tier as GallerySubscriptionTier,
      status: row.status as GallerySubscriptionStatus,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripePriceId: row.stripe_price_id,
      currentPeriodStart: row.current_period_start ? new Date(row.current_period_start) : undefined,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : undefined,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// ============================================
// Gallery Notification Repository
// ============================================
export class GalleryNotificationRepository {
  async create(data: Omit<IGalleryNotification, 'id' | 'createdAt' | 'isRead'>): Promise<IGalleryNotification> {
    const id = `gnot-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_notifications (id, user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, data.userId, data.type, data.title, data.message, JSON.stringify(data.data || {})]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId: string, page = 1, limit = 20): Promise<PaginatedResult<IGalleryNotification>> {
    const offset = (page - 1) * limit;
    const [notifResult, countResult] = await Promise.all([
      pgPool.query(
        'SELECT * FROM gallery_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      ),
      pgPool.query('SELECT COUNT(*) FROM gallery_notifications WHERE user_id = $1', [userId])
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return {
      data: notifResult.rows.map(this.mapRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async countUnread(userId: string): Promise<number> {
    const result = await pgPool.query(
      'SELECT COUNT(*) FROM gallery_notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async markAsRead(id: string): Promise<void> {
    await pgPool.query(
      'UPDATE gallery_notifications SET is_read = true WHERE id = $1',
      [id]
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await pgPool.query(
      'UPDATE gallery_notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await pgPool.query(
      'DELETE FROM gallery_notifications WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteOld(days: number): Promise<number> {
    const result = await pgPool.query(
      `DELETE FROM gallery_notifications WHERE created_at < NOW() - INTERVAL '${days} days' RETURNING id`
    );
    return result.rowCount || 0;
  }

  async createBulk(userIds: string[], data: Omit<IGalleryNotification, 'id' | 'createdAt' | 'isRead' | 'userId'>): Promise<number> {
    if (userIds.length === 0) return 0;

    const values = userIds.map((userId, index) => {
      const baseIndex = index * 6;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
    }).join(', ');

    const params: any[] = [];
    userIds.forEach(userId => {
      params.push(`gnot-${uuidv4()}`, userId, data.type, data.title, data.message, JSON.stringify(data.data || {}));
    });

    const result = await pgPool.query(
      `INSERT INTO gallery_notifications (id, user_id, type, title, message, data) VALUES ${values}`,
      params
    );
    return result.rowCount || 0;
  }

  private mapRow(row: any): IGalleryNotification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type as NotificationType,
      title: row.title,
      message: row.message,
      isRead: row.is_read,
      data: row.data || {},
      createdAt: new Date(row.created_at)
    };
  }
}

// ============================================
// Gallery Activity Log Repository
// ============================================
export class GalleryActivityLogRepository {
  async create(data: Omit<IGalleryActivityLog, 'id' | 'createdAt'>): Promise<IGalleryActivityLog> {
    const id = `gact-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO gallery_activity_log (id, user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, data.userId, data.action, data.resourceType, data.resourceId, JSON.stringify(data.metadata || {}), data.ipAddress, data.userAgent]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId: string, page = 1, limit = 50): Promise<PaginatedResult<IGalleryActivityLog>> {
    const offset = (page - 1) * limit;
    const [actResult, countResult] = await Promise.all([
      pgPool.query(
        'SELECT * FROM gallery_activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      ),
      pgPool.query('SELECT COUNT(*) FROM gallery_activity_log WHERE user_id = $1', [userId])
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return {
      data: actResult.rows.map(this.mapRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findByUserIdAndAction(userId: string, action: ActivityAction, limit = 20): Promise<IGalleryActivityLog[]> {
    const result = await pgPool.query(
      'SELECT * FROM gallery_activity_log WHERE user_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT $3',
      [userId, action, limit]
    );
    return result.rows.map(this.mapRow);
  }

  async countByAction(userId: string, action: ActivityAction, since?: Date): Promise<number> {
    let query = 'SELECT COUNT(*) FROM gallery_activity_log WHERE user_id = $1 AND action = $2';
    const params: any[] = [userId, action];

    if (since) {
      query += ' AND created_at > $3';
      params.push(since);
    }

    const result = await pgPool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  async deleteOld(days: number): Promise<number> {
    const result = await pgPool.query(
      `DELETE FROM gallery_activity_log WHERE created_at < NOW() - INTERVAL '${days} days' RETURNING id`
    );
    return result.rowCount || 0;
  }

  private mapRow(row: any): IGalleryActivityLog {
    return {
      id: row.id,
      userId: row.user_id,
      action: row.action as ActivityAction,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      metadata: row.metadata || {},
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: new Date(row.created_at)
    };
  }
}

// ============================================
// Repository Instances
// ============================================
export const galleryUserRepository = new GalleryUserRepository();
export const galleryRefreshTokenRepository = new GalleryRefreshTokenRepository();
export const galleryEmailVerificationRepository = new GalleryEmailVerificationRepository();
export const galleryPasswordResetRepository = new GalleryPasswordResetRepository();
export const galleryLoginHistoryRepository = new GalleryLoginHistoryRepository();
export const galleryFavoritesRepository = new GalleryFavoritesRepository();
export const gallerySubscriptionRepository = new GallerySubscriptionRepository();
export const galleryNotificationRepository = new GalleryNotificationRepository();
export const galleryActivityLogRepository = new GalleryActivityLogRepository();
