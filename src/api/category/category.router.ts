import { Router } from 'express';
import { categoryController } from './category.controller';
import {
    createCategory,
    updateCategory,
    categoryIdParam,
    listCategories
} from './category.validator';
import { validate } from '../../middleware/validation.middleware';
import { auth, requireAdminAccess } from '../../middleware/auth.middleware';

const router = Router();

// Public routes
router.get(
    '/',
    validate(listCategories),
    categoryController.list
);

router.get(
    '/:id',
    validate(categoryIdParam),
    categoryController.getById
);

router.get(
    '/slug/:slug',
    categoryController.getBySlug
);

// Admin routes (Protected)
router.use(auth());
router.use(requireAdminAccess());

router.post(
    '/',
    validate(createCategory),
    categoryController.create
);

router.put(
    '/:id',
    validate(updateCategory),
    categoryController.update
);

router.delete(
    '/:id',
    validate(categoryIdParam),
    categoryController.delete
);

router.post(
    '/:id/restore',
    validate(categoryIdParam),
    categoryController.restore
);

export const categoryRouter = router;
