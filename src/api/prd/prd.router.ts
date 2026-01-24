/**
 * PRD Router
 *
 * Routes for PRD (Product Requirements Document) management.
 */

import { Router } from 'express';
import * as prdController from './prd.controller';
// import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/prd
 * Get PRDs for authenticated user
 *
 * @requires Authentication
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10)
 *
 * @returns {object} Response
 * @returns {array} Response.prds - Array of PRD summaries
 * @returns {object} Response.pagination - Pagination info
 */
router.get('/',
  // authenticate(),
  prdController.getUserPRDs
);

/**
 * GET /api/prd/by-url
 * Get PRDs by source URL
 *
 * @query {string} url - Source URL to search for
 *
 * @returns {array} PRDs matching the URL
 */
router.get('/by-url',
  prdController.getPRDsByUrl
);

/**
 * GET /api/prd/:id
 * Get PRD by ID
 *
 * @param {string} id - PRD ID
 *
 * @returns {object} Full PRD data including all analysis results
 */
router.get('/:id',
  prdController.getPRDById
);

/**
 * GET /api/prd/:id/download
 * Download PRD as markdown file
 *
 * @param {string} id - PRD ID
 *
 * @returns {file} Markdown file download
 */
router.get('/:id/download',
  prdController.downloadPRD
);

/**
 * DELETE /api/prd/:id
 * Delete PRD by ID
 *
 * @requires Authentication (ownership check)
 * @param {string} id - PRD ID
 *
 * @returns {object} Deletion confirmation
 */
router.delete('/:id',
  // authenticate(),
  prdController.deletePRD
);

export default router;
