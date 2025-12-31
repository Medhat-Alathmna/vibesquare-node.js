import multer from 'multer';
import multerS3 from 'multer-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { s3Client, s3Config, isS3Configured } from '../config/s3.config';
import { ApiError } from '../shared/utils/ApiError';
import httpStatus from 'http-status';

// Type for S3 key callback
type S3KeyCallback = (error: Error | null, key?: string) => void;

// Middleware to check if S3 is configured
const requireS3 = (req: Request, res: Response, next: NextFunction) => {
  if (!isS3Configured()) {
    return next(new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'File upload service is not configured. Please configure AWS S3 credentials.'
    ));
  }
  next();
};

// File filter for images
const imageFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (s3Config.allowedImageTypes.includes(file.mimetype) &&
      s3Config.allowedImageExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid image type. Allowed types: ${s3Config.allowedImageExtensions.join(', ')}`
    ));
  }
};

// File filter for archives (zip/rar)
const archiveFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (s3Config.allowedArchiveTypes.includes(file.mimetype) &&
      s3Config.allowedArchiveExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid archive type. Allowed types: ${s3Config.allowedArchiveExtensions.join(', ')}`
    ));
  }
};

// Generate unique filename
const generateKey = (folder: string, originalname: string): string => {
  const ext = path.extname(originalname).toLowerCase();
  const uniqueName = `${uuidv4()}${ext}`;
  return `${folder}/${uniqueName}`;
};

// Create multer upload instances only if S3 is configured
const createUploadMiddleware = () => {
  if (!isS3Configured() || !s3Client) {
    // Return dummy middleware that will be caught by requireS3
    const dummyMiddleware = (req: Request, res: Response, next: NextFunction) => next();
    return {
      singleImage: dummyMiddleware,
      multipleImages: dummyMiddleware,
      sourceCode: dummyMiddleware,
      thumbnail: dummyMiddleware,
      avatar: dummyMiddleware
    };
  }

  return {
    singleImage: multer({
      storage: multerS3({
        s3: s3Client,
        bucket: s3Config.bucket,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req: Request, file: Express.Multer.File, cb: S3KeyCallback) => {
          const folder = (req as any).uploadFolder || s3Config.folders.projectImages;
          cb(null, generateKey(folder, file.originalname));
        }
      }),
      fileFilter: imageFileFilter,
      limits: {
        fileSize: s3Config.maxImageSize
      }
    }).single('image'),

    multipleImages: multer({
      storage: multerS3({
        s3: s3Client,
        bucket: s3Config.bucket,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req: Request, file: Express.Multer.File, cb: S3KeyCallback) => {
          const folder = (req as any).uploadFolder || s3Config.folders.projectImages;
          cb(null, generateKey(folder, file.originalname));
        }
      }),
      fileFilter: imageFileFilter,
      limits: {
        fileSize: s3Config.maxImageSize
      }
    }).array('images', 10),

    sourceCode: multer({
      storage: multerS3({
        s3: s3Client,
        bucket: s3Config.bucket,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req: Request, file: Express.Multer.File, cb: S3KeyCallback) => {
          cb(null, generateKey(s3Config.folders.projectSourceCode, file.originalname));
        }
      }),
      fileFilter: archiveFileFilter,
      limits: {
        fileSize: s3Config.maxSourceCodeSize
      }
    }).single('sourceCode'),

    thumbnail: multer({
      storage: multerS3({
        s3: s3Client,
        bucket: s3Config.bucket,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req: Request, file: Express.Multer.File, cb: S3KeyCallback) => {
          cb(null, generateKey(s3Config.folders.projectThumbnails, file.originalname));
        }
      }),
      fileFilter: imageFileFilter,
      limits: {
        fileSize: s3Config.maxImageSize
      }
    }).single('thumbnail'),

    avatar: multer({
      storage: multerS3({
        s3: s3Client,
        bucket: s3Config.bucket,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req: Request, file: Express.Multer.File, cb: S3KeyCallback) => {
          cb(null, generateKey(s3Config.folders.userAvatars, file.originalname));
        }
      }),
      fileFilter: imageFileFilter,
      limits: {
        fileSize: s3Config.maxImageSize
      }
    }).single('avatar')
  };
};

const uploadMiddleware = createUploadMiddleware();

// Export middleware with S3 check
export const uploadSingleImage = [requireS3, uploadMiddleware.singleImage];
export const uploadMultipleImages = [requireS3, uploadMiddleware.multipleImages];
export const uploadSourceCode = [requireS3, uploadMiddleware.sourceCode];
export const uploadThumbnail = [requireS3, uploadMiddleware.thumbnail];
export const uploadAvatar = [requireS3, uploadMiddleware.avatar];
