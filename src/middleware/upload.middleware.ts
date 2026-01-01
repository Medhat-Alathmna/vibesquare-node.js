import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { uploadConfig } from '../config/upload.config';
import { ApiError } from '../shared/utils/ApiError';
import httpStatus from 'http-status';

// File filter for images
const imageFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (uploadConfig.allowedImageTypes.includes(file.mimetype) &&
      uploadConfig.allowedImageExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid image type. Allowed types: ${uploadConfig.allowedImageExtensions.join(', ')}`
    ));
  }
};

// File filter for archives (zip/rar)
const archiveFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Check extension first (more reliable than MIME type)
  if (!uploadConfig.allowedArchiveExtensions.includes(ext)) {
    cb(new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid archive type. Allowed types: ${uploadConfig.allowedArchiveExtensions.join(', ')}`
    ));
    return;
  }

  // If extension is valid, check MIME type
  // Accept if MIME type is in allowed list OR if it's any application/* type (rely on extension validation)
  const isApplicationType = file.mimetype.startsWith('application/');

  if (uploadConfig.allowedArchiveTypes.includes(file.mimetype) || isApplicationType) {
    cb(null, true);
  } else {
    cb(new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid archive MIME type: ${file.mimetype}. Expected application/* type for ${ext} files`
    ));
  }
};

// Create multer upload instances using memory storage
const singleImage = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: uploadConfig.maxImageSize
  }
}).single('image');

const multipleImages = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: uploadConfig.maxImageSize
  }
}).array('images', 10);

const sourceCode = multer({
  storage: multer.memoryStorage(),
  fileFilter: archiveFileFilter,
  limits: {
    fileSize: uploadConfig.maxSourceCodeSize
  }
}).single('sourceCode');

const thumbnail = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: uploadConfig.maxImageSize
  }
}).single('thumbnail');

const avatar = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: uploadConfig.maxImageSize
  }
}).single('avatar');

// Export middleware
export const uploadSingleImage = singleImage;
export const uploadMultipleImages = multipleImages;
export const uploadSourceCode = sourceCode;
export const uploadThumbnail = thumbnail;
export const uploadAvatar = avatar;
