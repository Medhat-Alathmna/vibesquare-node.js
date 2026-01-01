-- Migration: Add new columns to projects table
-- Run this SQL in your PostgreSQL database

-- Add builder column (JSONB for storing builder info)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS builder JSONB;

-- Add builder_social_links column (JSONB for storing social links)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS builder_social_links JSONB;

-- Add source_code_file column (URL to the uploaded archive)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS source_code_file VARCHAR(500);

-- Create index on builder for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_projects_builder ON projects USING GIN (builder);

-- Example of how builder data looks:
-- {
--   "userId": "user-123",
--   "name": "John Doe",
--   "avatarUrl": "https://example.com/avatar.jpg"
-- }

-- Example of how builder_social_links looks:
-- {
--   "github": "https://github.com/johndoe",
--   "twitter": "https://twitter.com/johndoe",
--   "linkedin": "https://linkedin.com/in/johndoe",
--   "portfolio": "https://johndoe.dev"
-- }
