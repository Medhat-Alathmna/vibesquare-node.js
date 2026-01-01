import { Router } from 'express';
import { filesController } from './files.controller';

const router = Router();

/**
 * @route OPTIONS /api/files/:id
 * @desc Handle CORS preflight for file serving
 * @access Public
 */
router.options('/:id', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(204).send();
});

/**
 * @route GET /api/files/:id
 * @desc Serve file by ID
 * @access Public
 */
router.get('/:id', filesController.getFile);

export default router;
