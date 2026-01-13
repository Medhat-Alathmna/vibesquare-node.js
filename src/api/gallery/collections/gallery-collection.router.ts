import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware'; // Removed requireRole('gallery_user') as auth is enough implies user. But typically we want to ensure role.
import { validate } from '../../../middleware/validation.middleware';
import * as collectionController from './gallery-collection.controller';
import * as collectionValidator from './gallery-collection.validator';
import * as sharedValidation from '../../collection/collection.validator';

const router = Router();

// Retrieve my collections
router.get(
    '/my-collections',
    authenticate(),
    collectionController.getMyCollections
);

// Create new collection
router.post(
    '/',
    authenticate(),
    validate(collectionValidator.createGalleryCollection),
    collectionController.createCollection
);

// Update collection
router.patch(
    '/:id',
    authenticate(),
    validate(collectionValidator.updateGalleryCollection),
    collectionController.updateCollection
);

// Delete collection
router.delete(
    '/:id',
    authenticate(),
    validate(sharedValidation.getCollectionById), // Just checks ID format
    collectionController.deleteCollection
);

// Project management
router.post(
    '/:id/projects',
    authenticate(),
    validate(sharedValidation.addProject),
    collectionController.addProject
);

router.delete(
    '/:id/projects/:projectId',
    authenticate(),
    validate(sharedValidation.removeProject),
    collectionController.removeProject
);

router.put(
    '/:id/projects/reorder',
    authenticate(),
    validate(sharedValidation.reorderProjects),
    collectionController.reorderProjects
);

export const galleryCollectionsRouter = router;
