import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

// Check if S3 is configured
export const isS3Configured = (): boolean => {
  return !!(env.AWS_S3_BUCKET && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
};

// Create S3 client only if configured
export const s3Client: S3Client | null = isS3Configured()
  ? new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
      }
    })
  : null;

export const s3Config = {
  bucket: env.AWS_S3_BUCKET || '',
  region: env.AWS_REGION,

  // File size limits
  maxImageSize: 10 * 1024 * 1024, // 10 MB
  maxSourceCodeSize: 50 * 1024 * 1024, // 50 MB

  // Allowed file types
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  allowedImageExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],

  allowedArchiveTypes: ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/vnd.rar'],
  allowedArchiveExtensions: ['.zip', '.rar'],

  // S3 folders
  folders: {
    projectImages: 'projects/images',
    projectThumbnails: 'projects/thumbnails',
    projectSourceCode: 'projects/source-code',
    userAvatars: 'users/avatars'
  }
};

export const getS3Url = (key: string): string => {
  return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${key}`;
};
