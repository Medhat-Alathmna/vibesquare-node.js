import { Router } from 'express';
import { authenticate, requireAdminAccess, requirePermission } from '../../../middleware/auth.middleware';
import { validate } from '../../../middleware/validation.middleware';
import * as collectionController from './admin-collection.controller';
import * as collectionValidation from './admin-collection.validator';
import * as sharedValidation from '../../collection/collection.validator';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate(), requireAdminAccess());

router.route('/')
    .get(
        requirePermission('collections.read'),
        validate(collectionValidation.listAdminCollections),
        collectionController.listCollections
    )
    .post(
        requirePermission('collections.create'),
        validate(collectionValidation.createSystemCollection),
        collectionController.createCollection
    );

router.route('/:id')
    .get(
        requirePermission('collections.read'),
        validate(sharedValidation.getCollectionById),
        collectionController.getCollection
    )
    .patch(
        requirePermission('collections.update'),
        validate(collectionValidation.updateAdminCollection),
        collectionController.updateCollection
    )
    .delete(
        requirePermission('collections.delete'),
        validate(sharedValidation.getCollectionById),
        collectionController.deleteCollection
    );

router.post(
    '/:id/restore',
    requirePermission('collections.update'),
    validate(sharedValidation.getCollectionById),
    collectionController.restoreCollection
);

// Project management routes
router.post(
    '/:id/projects',
    requirePermission('collections.update'),
    validate(sharedValidation.addProject),
    collectionController.addProject
);

router.delete(
    '/:id/projects/:projectId',
    requirePermission('collections.update'),
    validate(sharedValidation.removeProject),
    collectionController.removeProject
);

router.put(
    '/:id/projects/reorder',
    requirePermission('collections.update'),
    validate(sharedValidation.reorderProjects),
    collectionController.reorderProjects
);

export const adminCollectionsRouter = router;
