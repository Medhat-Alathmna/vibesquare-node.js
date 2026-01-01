/**
 * Upload Configuration
 * Defines file size limits, allowed types, and categories for file uploads
 * Replaces S3 configuration with database-centric settings
 */

// File size limits
export const uploadConfig = {
  maxImageSize: 10 * 1024 * 1024, // 10 MB
  maxSourceCodeSize: 50 * 1024 * 1024, // 50 MB

  // Allowed file types for images
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  allowedImageExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],

  // Allowed file types for archives
  allowedArchiveTypes: [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/vnd.rar',
    'application/x-rar',
    'application/rar',
    'application/x-compressed',
    'application/octet-stream' // Generic binary, check extension
  ],
  allowedArchiveExtensions: ['.zip', '.rar'],

  // File categories mapping to database enum
  categories: {
    projectImage: 'project_image',
    projectThumbnail: 'project_thumbnail',
    sourceCode: 'source_code',
    userAvatar: 'user_avatar'
  } as const
};

// Type for file categories
export type FileCategory = typeof uploadConfig.categories[keyof typeof uploadConfig.categories];
