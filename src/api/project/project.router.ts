import { Router } from 'express';
import * as projectController from './project.controller';
import { validate } from '../../middleware/validation.middleware';
import * as projectValidator from './project.validator';
import { optionalGalleryAuth } from '../../middleware/gallery-auth.middleware';

const router = Router();

// GET /api/projects - List with pagination & filters
router.get('/',
  optionalGalleryAuth(),
  validate(projectValidator.listProjects),
  projectController.getProjects
);

// GET /api/projects/search - Search with filters
router.get('/search',
  optionalGalleryAuth(),
  validate(projectValidator.searchProjects),
  projectController.searchProjects
);

// GET /api/projects/:id - Single project
router.get('/:id',
  optionalGalleryAuth(),
  validate(projectValidator.getProjectById),
  projectController.getProjectById
);

// POST /api/projects/:id/view - Record view
router.post('/:id/view', projectController.recordView);

// POST /api/projects/:id/like - Record like
router.post('/:id/like', projectController.recordLike);

// POST /api/projects/:id/download - Record download
router.post('/:id/download', projectController.recordDownload);

export default router;
