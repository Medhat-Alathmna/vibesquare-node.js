/**
 * PRD Service
 *
 * Business logic for managing PRD (Product Requirements Document) entities.
 */

import {
  getPRDRepository,
  PRDData,
  PRDListResult,
  UpdatePRDDTO,
} from '../../shared/repositories';

export class PRDService {
  /**
   * Get PRD by ID
   */
  async getById(id: string): Promise<PRDData | null> {
    const repository = getPRDRepository();
    return repository.findById(id);
  }

  /**
   * Get PRDs by user ID with pagination
   */
  async getByUserId(userId: string, page = 1, limit = 10): Promise<PRDListResult> {
    const repository = getPRDRepository();
    return repository.findByUserId(userId, page, limit);
  }

  /**
   * Get PRDs by source URL
   */
  async getByUrl(url: string): Promise<PRDData[]> {
    const repository = getPRDRepository();
    return repository.findByUrl(url);
  }

  /**
   * Get PRD markdown for download
   */
  async getMarkdown(id: string): Promise<string | null> {
    const repository = getPRDRepository();
    return repository.getMarkdown(id);
  }

  /**
   * Update PRD
   */
  async update(id: string, data: UpdatePRDDTO): Promise<PRDData | null> {
    const repository = getPRDRepository();
    return repository.update(id, data);
  }

  /**
   * Delete PRD
   */
  async delete(id: string): Promise<boolean> {
    const repository = getPRDRepository();
    return repository.delete(id);
  }
}

export const prdService = new PRDService();
