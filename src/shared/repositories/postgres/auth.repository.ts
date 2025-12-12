import { pgPool } from '../../../config/database';
import { v4 as uuidv4 } from 'uuid';
import {
  IUser, IRole, IPermission, IRefreshToken, IPasswordResetToken,
  IEmailVerificationToken, ILoginHistory, ISubscription,
  SubscriptionTier, SubscriptionStatus, AuthProvider, PermissionModule, PermissionAction
} from '../../../api/auth/auth.types';

// ============================================
// PostgreSQL Table Creation
// ============================================
export async function createAuthTables(): Promise<void> {
  const client = await pgPool.connect();
  try {
    // Permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT NOT NULL,
        module VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        can_access_admin BOOLEAN DEFAULT false,
        permissions JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(500),
        google_id VARCHAR(255) UNIQUE,
        github_id VARCHAR(255) UNIQUE,
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        must_change_password BOOLEAN DEFAULT false,
        is_system BOOLEAN DEFAULT false,
        role_id VARCHAR(255) REFERENCES roles(id) ON DELETE SET NULL,
        subscription_tier VARCHAR(50) DEFAULT 'free',
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        last_login_at TIMESTAMP,
        password_changed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Refresh tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        replaced_by_token VARCHAR(500),
        user_agent TEXT,
        ip_address VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Password reset tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Email verification tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Login history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        ip_address VARCHAR(100) NOT NULL,
        user_agent TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tier VARCHAR(50) NOT NULL DEFAULT 'free',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        stripe_price_id VARCHAR(255),
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        cancelled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`);

    console.log('Auth tables created successfully');
  } finally {
    client.release();
  }
}

// ============================================
// Permission Repository
// ============================================
export class PermissionRepository {
  async create(data: Omit<IPermission, 'id' | 'createdAt'>): Promise<IPermission> {
    const id = `perm-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO permissions (id, name, description, module, action)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, data.name, data.description, data.module, data.action]
    );
    return this.mapRow(result.rows[0]);
  }

  async findAll(): Promise<IPermission[]> {
    const result = await pgPool.query('SELECT * FROM permissions ORDER BY module, action');
    return result.rows.map(this.mapRow);
  }

  async findById(id: string): Promise<IPermission | null> {
    const result = await pgPool.query('SELECT * FROM permissions WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByName(name: string): Promise<IPermission | null> {
    const result = await pgPool.query('SELECT * FROM permissions WHERE name = $1', [name]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<IPermission[]> {
    if (ids.length === 0) return [];
    const result = await pgPool.query(
      'SELECT * FROM permissions WHERE id = ANY($1)',
      [ids]
    );
    return result.rows.map(this.mapRow);
  }

  async count(): Promise<number> {
    const result = await pgPool.query('SELECT COUNT(*) FROM permissions');
    return parseInt(result.rows[0].count, 10);
  }

  private mapRow(row: any): IPermission {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      module: row.module as PermissionModule,
      action: row.action as PermissionAction,
      createdAt: new Date(row.created_at)
    };
  }
}

// ============================================
// Role Repository
// ============================================
export class RoleRepository {
  async create(data: Omit<IRole, 'id' | 'createdAt' | 'updatedAt'>): Promise<IRole> {
    const id = `role-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO roles (id, name, description, is_system, can_access_admin, permissions)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, data.name, data.description, data.isSystem, data.canAccessAdmin, JSON.stringify(data.permissions)]
    );
    return this.mapRow(result.rows[0]);
  }

  async findAll(): Promise<IRole[]> {
    const result = await pgPool.query('SELECT * FROM roles ORDER BY created_at DESC');
    return result.rows.map(this.mapRow);
  }

  async findById(id: string): Promise<IRole | null> {
    const result = await pgPool.query('SELECT * FROM roles WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByName(name: string): Promise<IRole | null> {
    const result = await pgPool.query('SELECT * FROM roles WHERE name = $1', [name]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async update(id: string, data: Partial<Omit<IRole, 'id' | 'createdAt'>>): Promise<IRole | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.canAccessAdmin !== undefined) {
      fields.push(`can_access_admin = $${paramIndex++}`);
      values.push(data.canAccessAdmin);
    }
    if (data.permissions !== undefined) {
      fields.push(`permissions = $${paramIndex++}`);
      values.push(JSON.stringify(data.permissions));
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await pgPool.query(
      `UPDATE roles SET ${fields.join(', ')} WHERE id = $${paramIndex} AND is_system = false RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await pgPool.query(
      'DELETE FROM roles WHERE id = $1 AND is_system = false RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async count(): Promise<number> {
    const result = await pgPool.query('SELECT COUNT(*) FROM roles');
    return parseInt(result.rows[0].count, 10);
  }

  private mapRow(row: any): IRole {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isSystem: row.is_system,
      canAccessAdmin: row.can_access_admin,
      permissions: row.permissions || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// ============================================
// User Repository
// ============================================
export class UserRepository {
  async create(data: Omit<IUser, 'id' | 'createdAt' | 'updatedAt' | 'failedLoginAttempts'>): Promise<IUser> {
    const id = `user-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO users (
        id, email, password, first_name, last_name, avatar_url,
        google_id, github_id, is_active, email_verified, must_change_password,
        is_system, role_id, subscription_tier
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        id, data.email, data.password, data.firstName, data.lastName, data.avatarUrl,
        data.googleId, data.githubId, data.isActive, data.emailVerified, data.mustChangePassword,
        data.isSystem, data.roleId, data.subscriptionTier
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findAll(page = 1, limit = 20): Promise<{ users: IUser[]; total: number }> {
    const offset = (page - 1) * limit;
    const [usersResult, countResult] = await Promise.all([
      pgPool.query(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      pgPool.query('SELECT COUNT(*) FROM users')
    ]);
    return {
      users: usersResult.rows.map(this.mapRow),
      total: parseInt(countResult.rows[0].count, 10)
    };
  }

  async findById(id: string): Promise<IUser | null> {
    const result = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const result = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByGoogleId(googleId: string): Promise<IUser | null> {
    const result = await pgPool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByGithubId(githubId: string): Promise<IUser | null> {
    const result = await pgPool.query('SELECT * FROM users WHERE github_id = $1', [githubId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async update(id: string, data: Partial<Omit<IUser, 'id' | 'createdAt'>>): Promise<IUser | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      email: 'email',
      password: 'password',
      firstName: 'first_name',
      lastName: 'last_name',
      avatarUrl: 'avatar_url',
      googleId: 'google_id',
      githubId: 'github_id',
      isActive: 'is_active',
      emailVerified: 'email_verified',
      mustChangePassword: 'must_change_password',
      roleId: 'role_id',
      subscriptionTier: 'subscription_tier',
      failedLoginAttempts: 'failed_login_attempts',
      lockedUntil: 'locked_until',
      lastLoginAt: 'last_login_at',
      passwordChangedAt: 'password_changed_at'
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${dbField} = $${paramIndex++}`);
        values.push((data as any)[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await pgPool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await pgPool.query(
      'DELETE FROM users WHERE id = $1 AND is_system = false RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async count(): Promise<number> {
    const result = await pgPool.query('SELECT COUNT(*) FROM users');
    return parseInt(result.rows[0].count, 10);
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    await pgPool.query(
      'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await pgPool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async lockAccount(id: string, until: Date): Promise<void> {
    await pgPool.query(
      'UPDATE users SET locked_until = $1, updated_at = NOW() WHERE id = $2',
      [until, id]
    );
  }

  private mapRow(row: any): IUser {
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarUrl: row.avatar_url,
      googleId: row.google_id,
      githubId: row.github_id,
      isActive: row.is_active,
      emailVerified: row.email_verified,
      mustChangePassword: row.must_change_password,
      isSystem: row.is_system,
      roleId: row.role_id,
      subscriptionTier: row.subscription_tier as SubscriptionTier,
      failedLoginAttempts: row.failed_login_attempts,
      lockedUntil: row.locked_until ? new Date(row.locked_until) : undefined,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      passwordChangedAt: row.password_changed_at ? new Date(row.password_changed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// ============================================
// Refresh Token Repository
// ============================================
export class RefreshTokenRepository {
  async create(data: Omit<IRefreshToken, 'id' | 'createdAt'>): Promise<IRefreshToken> {
    const id = `rt-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, data.userId, data.token, data.expiresAt, data.userAgent, data.ipAddress]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByToken(token: string): Promise<IRefreshToken | null> {
    const result = await pgPool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW()',
      [token]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async revoke(id: string, replacedByToken?: string): Promise<void> {
    await pgPool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_token = $1 WHERE id = $2',
      [replacedByToken, id]
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await pgPool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  }

  async deleteExpired(): Promise<number> {
    const result = await pgPool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL RETURNING id'
    );
    return result.rowCount || 0;
  }

  private mapRow(row: any): IRefreshToken {
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
// Password Reset Repository
// ============================================
export class PasswordResetRepository {
  async create(data: Omit<IPasswordResetToken, 'id' | 'createdAt'>): Promise<IPasswordResetToken> {
    const id = `pr-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, data.userId, data.token, data.expiresAt]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByToken(token: string): Promise<IPasswordResetToken | null> {
    const result = await pgPool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
      [token]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markUsed(id: string): Promise<void> {
    await pgPool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [id]);
  }

  async deleteForUser(userId: string): Promise<void> {
    await pgPool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
  }

  private mapRow(row: any): IPasswordResetToken {
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
// Email Verification Repository
// ============================================
export class EmailVerificationRepository {
  async create(data: Omit<IEmailVerificationToken, 'id' | 'createdAt'>): Promise<IEmailVerificationToken> {
    const id = `ev-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO email_verification_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, data.userId, data.token, data.expiresAt]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByToken(token: string): Promise<IEmailVerificationToken | null> {
    const result = await pgPool.query(
      'SELECT * FROM email_verification_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
      [token]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markUsed(id: string): Promise<void> {
    await pgPool.query('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1', [id]);
  }

  async deleteForUser(userId: string): Promise<void> {
    await pgPool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
  }

  private mapRow(row: any): IEmailVerificationToken {
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
// Login History Repository
// ============================================
export class LoginHistoryRepository {
  async create(data: Omit<ILoginHistory, 'id' | 'createdAt'>): Promise<ILoginHistory> {
    const id = `lh-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO login_history (id, user_id, provider, ip_address, user_agent, success, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, data.userId, data.provider, data.ipAddress, data.userAgent, data.success, data.failureReason]
    );
    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId: string, limit = 20): Promise<ILoginHistory[]> {
    const result = await pgPool.query(
      'SELECT * FROM login_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows.map(this.mapRow);
  }

  async countRecentFailures(userId: string, minutes: number): Promise<number> {
    const result = await pgPool.query(
      `SELECT COUNT(*) FROM login_history
       WHERE user_id = $1 AND success = false AND created_at > NOW() - INTERVAL '${minutes} minutes'`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  private mapRow(row: any): ILoginHistory {
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
// Subscription Repository
// ============================================
export class SubscriptionRepository {
  async create(data: Omit<ISubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<ISubscription> {
    const id = `sub-${uuidv4()}`;
    const result = await pgPool.query(
      `INSERT INTO subscriptions (
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

  async findByUserId(userId: string): Promise<ISubscription | null> {
    const result = await pgPool.query('SELECT * FROM subscriptions WHERE user_id = $1', [userId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async update(id: string, data: Partial<Omit<ISubscription, 'id' | 'createdAt'>>): Promise<ISubscription | null> {
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

    if (fields.length === 0) return this.findByUserId(id);

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await pgPool.query(
      `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  private mapRow(row: any): ISubscription {
    return {
      id: row.id,
      userId: row.user_id,
      tier: row.tier as SubscriptionTier,
      status: row.status as SubscriptionStatus,
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
// Repository Instances
// ============================================
export const permissionRepository = new PermissionRepository();
export const roleRepository = new RoleRepository();
export const userRepository = new UserRepository();
export const refreshTokenRepository = new RefreshTokenRepository();
export const passwordResetRepository = new PasswordResetRepository();
export const emailVerificationRepository = new EmailVerificationRepository();
export const loginHistoryRepository = new LoginHistoryRepository();
export const subscriptionRepository = new SubscriptionRepository();
