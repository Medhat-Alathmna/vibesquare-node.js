-- Fix refresh_token column length
-- Current: VARCHAR(100) - too small for JWT tokens
-- New: VARCHAR(500) - sufficient for JWT refresh tokens

ALTER TABLE gallery_refresh_tokens
ALTER COLUMN token TYPE VARCHAR(500);

-- Optional: Add comment for documentation
COMMENT ON COLUMN gallery_refresh_tokens.token IS 'JWT refresh token (up to 500 characters)';
