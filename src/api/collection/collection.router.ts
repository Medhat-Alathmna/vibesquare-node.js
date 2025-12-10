import { Router } from 'express';
import * as collectionController from './collection.controller';
import { validate } from '../../middleware/validation.middleware';
import * as collectionValidator from './collection.validator';

const router = Router();

// GET /api/collections - List all collections
router.get('/',
  validate(collectionValidator.listCollections),
  collectionController.getCollections
);

// GET /api/collections/featured - Get featured collections
router.get('/featured', collectionController.getFeaturedCollections);

// GET /api/collections/:id - Single collection with projects
router.get('/:id',
  validate(collectionValidator.getCollectionById),
  collectionController.getCollectionById
);

export default router;
