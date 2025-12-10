import { Request, Response } from 'express';
import { projectService } from './project.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { Framework, Category, SortOption } from '../../shared/types';

export const getProjects = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 12, framework, category, tags, sortBy = 'recent' } = req.query;

  const result = await projectService.getProjects({
    page: Number(page),
    limit: Number(limit),
    framework: framework as Framework,
    category: category as Category,
    tags: tags ? (tags as string).split(',') : undefined,
    sortBy: sortBy as SortOption
  });

  res.json(new ApiResponse(200, result, 'Projects retrieved successfully'));
});

export const searchProjects = asyncHandler(async (req: Request, res: Response) => {
  const { q, frameworks, categories, tags, sortBy = 'recent', page = 1, limit = 12 } = req.query;

  const result = await projectService.searchProjects({
    query: q as string,
    frameworks: frameworks ? (frameworks as string).split(',') as Framework[] : undefined,
    categories: categories ? (categories as string).split(',') as Category[] : undefined,
    tags: tags ? (tags as string).split(',') : undefined,
    sortBy: sortBy as SortOption,
    page: Number(page),
    limit: Number(limit)
  });

  res.json(new ApiResponse(200, result, 'Search completed successfully'));
});

export const getProjectById = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.getProjectById(req.params.id);
  res.json(new ApiResponse(200, project, 'Project retrieved successfully'));
});

export const recordView = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.incrementStat(req.params.id, 'views');
  res.json(new ApiResponse(200, { views: project.views }, 'View recorded'));
});

export const recordLike = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.incrementStat(req.params.id, 'likes');
  res.json(new ApiResponse(200, { likes: project.likes }, 'Like recorded'));
});

export const recordDownload = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.incrementStat(req.params.id, 'downloads');
  res.json(new ApiResponse(200, { downloads: project.downloads }, 'Download recorded'));
});
