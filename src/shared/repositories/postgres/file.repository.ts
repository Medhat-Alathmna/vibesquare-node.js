import { pgPool } from '../../../config/database';
import { FileCategory } from '../../../config/upload.config';

// File data interface
export interface FileData {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  fileData: Buffer;
  uploadedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// DTO for creating files
export interface CreateFileDTO {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  fileData: Buffer;
  uploadedBy?: string;
}

// Repository interface
export interface IFileRepository {
  create(data: CreateFileDTO): Promise<FileData>;
  findById(id: string): Promise<FileData | null>;
  delete(id: string): Promise<boolean>;
  deleteMultiple(ids: string[]): Promise<number>;
}

// PostgreSQL File Repository Implementation
export class PostgresFileRepository implements IFileRepository {
  /**
   * Map database row to FileData
   */
  private mapRowToFileData(row: any): FileData {
    return {
      id: row.id,
      filename: row.filename,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: row.size,
      category: row.category,
      fileData: row.file_data,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Create a new file in the database
   */
  async create(data: CreateFileDTO): Promise<FileData> {
    const query = `
      INSERT INTO files (filename, original_name, mime_type, size, category, file_data, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      data.filename,
      data.originalName,
      data.mimeType,
      data.size,
      data.category,
      data.fileData,
      data.uploadedBy || null
    ];

    const result = await pgPool.query(query, values);
    return this.mapRowToFileData(result.rows[0]);
  }

  /**
   * Find file by ID
   */
  async findById(id: string): Promise<FileData | null> {
    const query = 'SELECT * FROM files WHERE id = $1';
    const result = await pgPool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToFileData(result.rows[0]);
  }

  /**
   * Delete file by ID
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM files WHERE id = $1 RETURNING id';
    const result = await pgPool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Delete multiple files by IDs
   */
  async deleteMultiple(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const query = 'DELETE FROM files WHERE id = ANY($1) RETURNING id';
    const result = await pgPool.query(query, [ids]);
    return result.rowCount || 0;
  }
}

// Export singleton instance
export const fileRepository = new PostgresFileRepository();
