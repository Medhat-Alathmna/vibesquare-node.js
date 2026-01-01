import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { filesService } from './files.service';

export const filesController = {
  /**
   * Get and serve file by ID
   * GET /api/files/:id
   */
  getFile: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const file = await filesService.getFileById(id);

    if (!file) {
      return res.status(httpStatus.NOT_FOUND).json(
        ApiResponse.notFound('File not found')
      );
    }

    // Set proper headers for file serving
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);

    // Enable browser caching (1 year for immutable files)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${file.id}"`);

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Allow cross-origin resource sharing for images
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Send binary data
    res.send(file.fileData);
  })
};
