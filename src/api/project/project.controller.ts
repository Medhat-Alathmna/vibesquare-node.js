import { Request, Response } from 'express';
import { projectService } from './project.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { Framework, Category, SortOption } from '../../shared/types';
import { galleryFavoritesRepository } from '../../shared/repositories/postgres/gallery.repository';
import { ProjectSummary, ProjectData } from '../../shared/repositories/interfaces';

/**
 * Add hasLiked flag to projects based on user's favorites
 */
async function addHasLikedToProjects(
  projects: ProjectSummary[],
  userId?: string
): Promise<ProjectSummary[]> {
  if (!userId) {
    return projects.map(p => ({ ...p, hasLiked: false }));
  }

  const projectIds = projects.map(p => p.id);
  const favoriteProjectIds = await galleryFavoritesRepository.getProjectIds(userId);
  const favoriteSet = new Set(favoriteProjectIds);

  return projects.map(p => ({
    ...p,
    hasLiked: favoriteSet.has(p.id)
  }));
}

/**
 * Add hasLiked flag to single project
 */
async function addHasLikedToProject(
  project: ProjectData,
  userId?: string
): Promise<ProjectData> {
  if (!userId) {
    return { ...project, hasLiked: false };
  }

  const favorite = await galleryFavoritesRepository.findByUserAndProject(userId, project.id);
  return {
    ...project,
    hasLiked: !!favorite
  };
}

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

  // Add hasLiked flag
  const projectsWithLikes = await addHasLikedToProjects(
    result.projects,
    req.galleryUser?.id
  );

  res.json(new ApiResponse(200, {
    ...result,
    projects: projectsWithLikes
  }, 'Projects retrieved successfully'));
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

  // Add hasLiked flag
  const projectsWithLikes = await addHasLikedToProjects(
    result.projects,
    req.galleryUser?.id
  );

  res.json(new ApiResponse(200, {
    ...result,
    projects: projectsWithLikes
  }, 'Search completed successfully'));
});

export const getProjectById = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.getProjectById(req.params.id);

  // Add hasLiked flag
  const projectWithLike = await addHasLikedToProject(project, req.galleryUser?.id);

  res.json(new ApiResponse(200, projectWithLike, 'Project retrieved successfully'));
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
