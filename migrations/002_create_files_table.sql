-- Migration: Create files table for storing uploaded files
-- Description: Replaces AWS S3 storage with PostgreSQL BYTEA storage
-- Created: 2025-12-31

-- Create files table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL,
  file_data BYTEA NOT NULL,
  uploaded_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_files_category ON files(category);
CREATE INDEX idx_files_filename ON files(filename);
CREATE INDEX idx_files_created_at ON files(created_at DESC);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by) WHERE uploaded_by IS NOT NULL;

-- Add file size constraints based on category
ALTER TABLE files ADD CONSTRAINT chk_file_size
  CHECK (
    (category IN ('project_image', 'project_thumbnail', 'user_avatar') AND size <= 10485760) OR
    (category = 'source_code' AND size <= 52428800)
  );

-- Add category validation constraint
ALTER TABLE files ADD CONSTRAINT chk_file_category
  CHECK (category IN ('project_image', 'project_thumbnail', 'source_code', 'user_avatar'));

-- Add comments for documentation
COMMENT ON TABLE files IS 'Stores uploaded files as binary data (replaces S3 storage)';
COMMENT ON COLUMN files.id IS 'UUID primary key for file identification';
COMMENT ON COLUMN files.filename IS 'Generated unique filename with extension';
COMMENT ON COLUMN files.original_name IS 'Original filename from upload';
COMMENT ON COLUMN files.mime_type IS 'MIME type of the file (e.g., image/jpeg)';
COMMENT ON COLUMN files.size IS 'File size in bytes';
COMMENT ON COLUMN files.category IS 'File category: project_image, project_thumbnail, source_code, user_avatar';
COMMENT ON COLUMN files.file_data IS 'Binary file data stored as BYTEA';
COMMENT ON COLUMN files.uploaded_by IS 'Optional: ID of user who uploaded the file';
COMMENT ON COLUMN files.created_at IS 'Timestamp when file was uploaded';
COMMENT ON COLUMN files.updated_at IS 'Timestamp when file record was last updated';
