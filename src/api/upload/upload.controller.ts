import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { uploadService, MulterS3File } from './upload.service';
import {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSourceCode,
  uploadThumbnail
} from '../../middleware/upload.middleware';

// Wrapper to handle multer errors (for the multer middleware in array)
const wrapMulterMiddleware = (middlewareArray: any[]) => {
  return middlewareArray.map((middleware, index) => {
    // Last middleware in array is the actual multer upload
    if (index === middlewareArray.length - 1) {
      return (req: Request, res: Response, next: NextFunction) => {
        middleware(req, res, (err: any) => {
          if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(httpStatus.BAD_REQUEST).json(
                ApiResponse.error('File size exceeds the allowed limit')
              );
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
              return res.status(httpStatus.BAD_REQUEST).json(
                ApiResponse.error('Unexpected field name for file upload')
              );
            }
            return res.status(err.statusCode || httpStatus.BAD_REQUEST).json(
              ApiResponse.error(err.message || 'File upload failed')
            );
          }
          next();
        });
      };
    }
    return middleware;
  });
};

export const uploadController = {
  /**
   * Upload single image
   * POST /api/upload/image
   */
  uploadImage: [
    ...wrapMulterMiddleware(uploadSingleImage),
    asyncHandler(async (req: Request, res: Response) => {
      const file = req.file as MulterS3File;
      uploadService.validateFileUploaded(file);

      const result = uploadService.processUploadedFile(file);

      res.status(httpStatus.CREATED).json(
        ApiResponse.success(result, 'Image uploaded successfully')
      );
    })
  ],

  /**
   * Upload multiple images
   * POST /api/upload/images
   */
  uploadImages: [
    ...wrapMulterMiddleware(uploadMultipleImages),
    asyncHandler(async (req: Request, res: Response) => {
      const files = req.files as MulterS3File[];
      uploadService.validateFilesUploaded(files);

      const results = uploadService.processUploadedFiles(files);

      res.status(httpStatus.CREATED).json(
        ApiResponse.success(results, `${results.length} images uploaded successfully`)
      );
    })
  ],

  /**
   * Upload thumbnail
   * POST /api/upload/thumbnail
   */
  uploadThumbnail: [
    ...wrapMulterMiddleware(uploadThumbnail),
    asyncHandler(async (req: Request, res: Response) => {
      const file = req.file as MulterS3File;
      uploadService.validateFileUploaded(file);

      const result = uploadService.processUploadedFile(file);

      res.status(httpStatus.CREATED).json(
        ApiResponse.success(result, 'Thumbnail uploaded successfully')
      );
    })
  ],

  /**
   * Upload source code archive
   * POST /api/upload/source-code
   */
  uploadSourceCode: [
    ...wrapMulterMiddleware(uploadSourceCode),
    asyncHandler(async (req: Request, res: Response) => {
      const file = req.file as MulterS3File;
      uploadService.validateFileUploaded(file);

      const result = uploadService.processUploadedFile(file);

      res.status(httpStatus.CREATED).json(
        ApiResponse.success(result, 'Source code uploaded successfully')
      );
    })
  ],

  /**
   * Delete file
   * DELETE /api/upload/file?key=...
   */
  deleteFile: asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.query;

    if (!key || typeof key !== 'string') {
      return res.status(httpStatus.BAD_REQUEST).json(
        ApiResponse.error('File key is required')
      );
    }

    await uploadService.deleteFile(decodeURIComponent(key));

    res.json(ApiResponse.success(null, 'File deleted successfully'));
  })
};
