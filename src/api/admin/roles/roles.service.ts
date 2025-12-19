import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import {
  roleRepository,
  permissionRepository,
  userRepository
} from '../../../shared/repositories/postgres/auth.repository';
import { IRole, IPermission } from '../../auth/auth.types';

interface CreateRoleData {
  name: string;
  description?: string;
  canAccessAdmin: boolean;
  permissions: string[]; // Permission IDs
}

interface UpdateRoleData {
  name?: string;
  description?: string;
  canAccessAdmin?: boolean;
  permissions?: string[]; // Permission IDs
}

export class RolesService {
  /**
   * Get all roles
   */
  async getRoles(): Promise<{ roles: IRole[]; total: number }> {
    const roles = await roleRepository.findAll();

    return {
      roles,
      total: roles.length
    };
  }

  /**
   * Get role by ID with full permission details
   */
  async getRoleById(id: string): Promise<IRole & { permissionDetails?: IPermission[] }> {
    const role = await roleRepository.findById(id);

    if (!role) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }

    // Get full permission details
    const permissionDetails = await permissionRepository.findByIds(role.permissions);

    return {
      ...role,
      permissionDetails
    };
  }

  /**
   * Create new role
   */
  async createRole(data: CreateRoleData): Promise<IRole> {
    // Check if role name exists
    const existingRole = await roleRepository.findByName(data.name);
    if (existingRole) {
      throw new ApiError(httpStatus.CONFLICT, 'Role name already exists');
    }

    // Validate permission IDs
    if (data.permissions.length > 0) {
      const permissions = await permissionRepository.findByIds(data.permissions);
      if (permissions.length !== data.permissions.length) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'One or more invalid permission IDs');
      }
    }

    const role = await roleRepository.create({
      name: data.name,
      description: data.description,
      isSystem: false,
      canAccessAdmin: data.canAccessAdmin,
      isActive: true,
      permissions: data.permissions
    });

    return role;
  }

  /**
   * Update role
   */
  async updateRole(id: string, data: UpdateRoleData): Promise<IRole> {
    const role = await roleRepository.findById(id);

    if (!role) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }

    // Prevent modifying system roles
    if (role.isSystem) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Cannot modify system role');
    }

    // Check name uniqueness if being changed
    if (data.name && data.name !== role.name) {
      const existingRole = await roleRepository.findByName(data.name);
      if (existingRole) {
        throw new ApiError(httpStatus.CONFLICT, 'Role name already exists');
      }
    }

    // Validate permission IDs if being updated
    if (data.permissions && data.permissions.length > 0) {
      const permissions = await permissionRepository.findByIds(data.permissions);
      if (permissions.length !== data.permissions.length) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'One or more invalid permission IDs');
      }
    }

    const updatedRole = await roleRepository.update(id, data);

    if (!updatedRole) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update role');
    }

    return updatedRole;
  }

  /**
   * Delete role
   */
  async deleteRole(id: string): Promise<void> {
    const role = await roleRepository.findById(id);

    if (!role) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }

    // Prevent deleting system roles
    if (role.isSystem) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Cannot delete system role');
    }

    // Check if any users are assigned to this role
    const userCount = await userRepository.countByRoleId(id);
    if (userCount > 0) {
      throw new ApiError(
        httpStatus.CONFLICT,
        `Cannot delete role. ${userCount} user(s) are assigned to this role. Please reassign them first or disable the role instead.`
      );
    }

    const deleted = await roleRepository.delete(id);

    if (!deleted) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete role');
    }
  }

  /**
   * Enable role
   */
  async enableRole(id: string): Promise<IRole> {
    const role = await roleRepository.findById(id);

    if (!role) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }

    if (role.isSystem) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Cannot modify system role status');
    }

    if (role.isActive) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Role is already active');
    }

    const updatedRole = await roleRepository.setActiveStatus(id, true);

    if (!updatedRole) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to enable role');
    }

    return updatedRole;
  }

  /**
   * Disable role
   */
  async disableRole(id: string): Promise<IRole> {
    const role = await roleRepository.findById(id);

    if (!role) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }

    if (role.isSystem) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Cannot modify system role status');
    }

    if (!role.isActive) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Role is already inactive');
    }

    const updatedRole = await roleRepository.setActiveStatus(id, false);

    if (!updatedRole) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to disable role');
    }

    return updatedRole;
  }

  /**
   * Toggle role status (enable/disable)
   */
  async toggleRoleStatus(id: string): Promise<IRole> {
    const role = await roleRepository.findById(id);

    if (!role) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }

    if (role.isActive) {
      return this.disableRole(id);
    } else {
      return this.enableRole(id);
    }
  }

  /**
   * Get all permissions
   */
  async getPermissions(): Promise<{ permissions: IPermission[]; total: number }> {
    const permissions = await permissionRepository.findAll();

    return {
      permissions,
      total: permissions.length
    };
  }

  /**
   * Get permissions grouped by module
   */
  async getPermissionsGrouped(): Promise<Record<string, IPermission[]>> {
    const permissions = await permissionRepository.findAll();

    const grouped: Record<string, IPermission[]> = {};

    for (const perm of permissions) {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    }

    return grouped;
  }
}

export const rolesService = new RolesService();
