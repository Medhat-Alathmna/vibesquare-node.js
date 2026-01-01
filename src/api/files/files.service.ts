import { fileRepository, FileData } from '../../shared/repositories/postgres/file.repository';

export class FilesService {
  /**
   * Get file by ID
   */
  async getFileById(id: string): Promise<FileData | null> {
    return await fileRepository.findById(id);
  }
}

export const filesService = new FilesService();
