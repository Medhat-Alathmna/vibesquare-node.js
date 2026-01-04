import { fileRepository } from '../../shared/repositories/postgres/file.repository';
import { uploadConfig, FileCategory } from '../../config/upload.config';
import { ApiError } from '../../shared/utils/ApiError';
import httpStatus from 'http-status';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { env } from '../../config/env';

// Type for uploaded file (using memory storage)
export type UploadFile = Express.Multer.File;

interface UploadedFile {
  url: string;
  key: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export class UploadService {
  /**
   * Generate file URL from file ID
   */
  private generateFileUrl(fileId: string): string {
    // Priority: 1. Explicitly set BACKEND_URL (not default localhost)
    //           2. ADMIN_URL
    //           3. Default to current BACKEND_URL or relative path
    let baseUrl = env.BACKEND_URL;

    const isDefaultLocal = baseUrl === 'http://localhost:3000' || !baseUrl;

    if (isDefaultLocal && env.ADMIN_URL && env.ADMIN_URL !== 'http://localhost:4300') {
      baseUrl = env.ADMIN_URL;
    }

    // Clean trailing slash
    baseUrl = baseUrl?.replace(/\/$/, '') || '';

    return `${baseUrl}/api/files/${fileId}`;
  }

  /**
   * Save file to database
   */
  async saveFileToDatabase(
    file: UploadFile,
    category: FileCategory,
    uploadedBy?: string
  ): Promise<UploadedFile> {
    const filename = `${uuidv4()}${path.extname(file.originalname)}`;

    const fileData = await fileRepository.create({
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      category,
      fileData: file.buffer,
      uploadedBy
    });

    return {
      url: this.generateFileUrl(fileData.id),
      key: fileData.id,
      originalName: fileData.originalName,
      size: fileData.size,
      mimeType: fileData.mimeType
    };
  }

  /**
   * Delete file from database
   */
  async deleteFile(fileId: string): Promise<void> {
    const deleted = await fileRepository.delete(fileId);

    if (!deleted) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'File not found'
      );
    }
  }

  /**
   * Delete multiple files from database
   */
  async deleteFiles(fileIds: string[]): Promise<void> {
    await fileRepository.deleteMultiple(fileIds);
  }

  /**
   * Validate that file was uploaded
   */
  validateFileUploaded(file: UploadFile | undefined): void {
    if (!file) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
    }
  }

  /**
   * Validate that files were uploaded
   */
  validateFilesUploaded(files: UploadFile[] | undefined): void {
    if (!files || files.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No files uploaded');
    }
  }
}

export const uploadService = new UploadService();
