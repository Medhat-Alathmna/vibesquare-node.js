import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { adminProjectsService } from './admin-projects.service';
import { Framework, Category } from '../../../shared/types';

export const adminProjectsController = {
  /**
   * List projects
   * GET /api/admin/projects
   */
  list: asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, search, framework, category } = req.query;

    const result = await adminProjectsService.listProjects({
      page: Number(page),
      limit: Number(limit),
      search: search as string | undefined,
      framework: framework as Framework | undefined,
      category: category as Category | undefined
    });

    res.json(ApiResponse.success(result));
  }),

  /**
   * Get project by ID
   * GET /api/admin/projects/:id
   */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const project = await adminProjectsService.getProjectById(id);

    res.json(ApiResponse.success(project));
  }),

  /**
   * Create project
   * POST /api/admin/projects
   */
  create: asyncHandler(async (req: Request, res: Response) => {
    const project = await adminProjectsService.createProject(req.body);

    res.status(httpStatus.CREATED).json(
      ApiResponse.success(project, 'Project created successfully')
    );
  }),

  /**
   * Update project
   * PATCH /api/admin/projects/:id
   */
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const project = await adminProjectsService.updateProject(id, req.body);

    res.json(ApiResponse.success(project, 'Project updated successfully'));
  }),

  /**
   * Delete project
   * DELETE /api/admin/projects/:id
   */
  delete: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await adminProjectsService.deleteProject(id);

    res.json(ApiResponse.success(null, 'Project deleted successfully'));
  })
};
