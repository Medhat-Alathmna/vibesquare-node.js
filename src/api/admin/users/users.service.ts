import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import {
  userRepository,
  roleRepository,
  subscriptionRepository
} from '../../../shared/repositories/postgres/auth.repository';
import { passwordService } from '../../auth/services/password.service';
import { IUser, SafeUser, IRole } from '../../auth/auth.types';

interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleId: string; // Required - every user must have a role
  subscriptionTier?: 'free' | 'premium' | 'enterprise';
  isActive?: boolean;
  emailVerified?: boolean;
}

interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  roleId?: string; // Cannot be null - role is always required
  subscriptionTier?: 'free' | 'premium' | 'enterprise';
  isActive?: boolean;
  emailVerified?: boolean;
}

interface UsersQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: string;
  subscriptionTier?: string;
  isActive?: boolean;
}

export class UsersService {
  /**
   * Get all users with pagination
   */
  async getUsers(options: UsersQueryOptions = {}) {
    const { page = 1, limit = 20 } = options;
    const { users, total } = await userRepository.findAll(page, limit);

    // Get roles for users
    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        let role: IRole | null = null;
        if (user.roleId) {
          role = await roleRepository.findById(user.roleId);
        }
        return this.toSafeUser(user, role);
      })
    );

    return {
      users: usersWithRoles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<SafeUser> {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    let role: IRole | null = null;
    if (user.roleId) {
      role = await roleRepository.findById(user.roleId);
    }

    return this.toSafeUser(user, role);
  }

  /**
   * Create new user (admin action)
   */
  async createUser(data: CreateUserData): Promise<SafeUser> {
    // Check if email exists
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ApiError(httpStatus.CONFLICT, 'Email already registered');
    }

    // Validate role - required
    const role = await roleRepository.findById(data.roleId);
    if (!role) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid role ID');
    }

    // Check if role is active
    if (!role.isActive) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot assign inactive role to user');
    }

    // Hash password
    const hashedPassword = await passwordService.hash(data.password);

    // Create user
    const user = await userRepository.create({
      email: data.email.toLowerCase(),
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      roleId: data.roleId,
      subscriptionTier: data.subscriptionTier || 'free',
      isActive: data.isActive ?? true,
      emailVerified: data.emailVerified ?? false,
      mustChangePassword: true, // Force password change on first login
      isSystem: false
    });

    // Create subscription
    await subscriptionRepository.create({
      userId: user.id,
      tier: data.subscriptionTier || 'free',
      status: 'active'
    });

    return this.toSafeUser(user, role);
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: UpdateUserData): Promise<SafeUser> {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Prevent modifying system users
    if (user.isSystem) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Cannot modify system user');
    }

    // Check email uniqueness if being changed
    if (data.email && data.email.toLowerCase() !== user.email) {
      const existingUser = await userRepository.findByEmail(data.email);
      if (existingUser) {
        throw new ApiError(httpStatus.CONFLICT, 'Email already in use');
      }
    }

    // Validate role if provided
    if (data.roleId) {
      const role = await roleRepository.findById(data.roleId);
      if (!role) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid role ID');
      }

      // Check if role is active
      if (!role.isActive) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot assign inactive role to user');
      }
    }

    // Update user
    const updatedUser = await userRepository.update(id, {
      ...(data.email && { email: data.email.toLowerCase() }),
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName && { lastName: data.lastName }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      ...(data.roleId && { roleId: data.roleId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.emailVerified !== undefined && { emailVerified: data.emailVerified })
    });

    if (!updatedUser) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update user');
    }

    // Update subscription tier if changed
    if (data.subscriptionTier) {
      const subscription = await subscriptionRepository.findByUserId(id);
      if (subscription) {
        await subscriptionRepository.update(subscription.id, { tier: data.subscriptionTier });
      }
      await userRepository.update(id, { subscriptionTier: data.subscriptionTier });
    }

    let role: IRole | null = null;
    if (updatedUser.roleId) {
      role = await roleRepository.findById(updatedUser.roleId);
    }

    return this.toSafeUser(updatedUser, role);
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Prevent deleting system users
    if (user.isSystem) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Cannot delete system user');
    }

    const deleted = await userRepository.delete(id);

    if (!deleted) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete user');
    }
  }

  /**
   * Reset user password (admin action)
   */
  async resetUserPassword(id: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const hashedPassword = await passwordService.hash(newPassword);

    await userRepository.update(id, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      mustChangePassword: true
    });
  }

  /**
   * Toggle user active status
   */
  async toggleUserStatus(id: string): Promise<SafeUser> {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (user.isSystem) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Cannot modify system user status');
    }

    const updatedUser = await userRepository.update(id, { isActive: !user.isActive });

    if (!updatedUser) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update user');
    }

    let role: IRole | null = null;
    if (updatedUser.roleId) {
      role = await roleRepository.findById(updatedUser.roleId);
    }

    return this.toSafeUser(updatedUser, role);
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string): Promise<SafeUser> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const role = await roleRepository.findById(roleId);
    if (!role) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid role ID');
    }

    // Check if role is active
    if (!role.isActive) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot assign inactive role to user');
    }

    const updatedUser = await userRepository.update(userId, { roleId });

    if (!updatedUser) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update user');
    }

    return this.toSafeUser(updatedUser, role);
  }

  /**
   * Convert user to safe user
   */
  private toSafeUser(user: IUser, role?: IRole | null): SafeUser {
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
        permissions: role.permissions
      };
    }

    return safeUser;
  }
}

export const usersService = new UsersService();
