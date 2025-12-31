import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, s3Config, isS3Configured } from '../../config/s3.config';
import { ApiError } from '../../shared/utils/ApiError';
import httpStatus from 'http-status';

// Custom type for MulterS3 file
export interface MulterS3File extends Express.Multer.File {
  location: string;
  key: string;
  bucket: string;
}

interface UploadedFile {
  url: string;
  key: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export class UploadService {
  /**
   * Process single uploaded file
   */
  processUploadedFile(file: MulterS3File): UploadedFile {
    return {
      url: file.location,
      key: file.key,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype
    };
  }

  /**
   * Process multiple uploaded files
   */
  processUploadedFiles(files: MulterS3File[]): UploadedFile[] {
    return files.map(file => this.processUploadedFile(file));
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    if (!isS3Configured() || !s3Client) {
      throw new ApiError(
        httpStatus.SERVICE_UNAVAILABLE,
        'File upload service is not configured'
      );
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: s3Config.bucket,
        Key: key
      });

      await s3Client.send(command);
    } catch (error) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to delete file from storage'
      );
    }
  }

  /**
   * Delete multiple files from S3
   */
  async deleteFiles(keys: string[]): Promise<void> {
    const deletePromises = keys.map(key => this.deleteFile(key));
    await Promise.all(deletePromises);
  }

  /**
   * Extract key from S3 URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Remove leading slash
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }

  /**
   * Validate that file was uploaded
   */
  validateFileUploaded(file: MulterS3File | undefined): void {
    if (!file) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
    }
  }

  /**
   * Validate that files were uploaded
   */
  validateFilesUploaded(files: MulterS3File[] | undefined): void {
    if (!files || files.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No files uploaded');
    }
  }
}

export const uploadService = new UploadService();
