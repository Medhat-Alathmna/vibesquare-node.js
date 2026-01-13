-- Add ownership columns
ALTER TABLE collections ADD COLUMN IF NOT EXISTS owner_id VARCHAR(255) NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) NOT NULL DEFAULT 'system';
ALTER TABLE collections ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public';
ALTER TABLE collections ADD COLUMN IF NOT EXISTS cloned_from_id VARCHAR(255) NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add check constraint for owner_type
ALTER TABLE collections ADD CONSTRAINT chk_owner_type
  CHECK (owner_type IN ('system', 'gallery_user'));

-- Add check constraint for visibility
ALTER TABLE collections ADD CONSTRAINT chk_visibility
  CHECK (visibility IN ('private', 'public'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_collections_featured ON collections(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(is_deleted) WHERE is_deleted = FALSE;

-- Add full-text search
ALTER TABLE collections ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_collections_search ON collections USING GIN(search_vector);

-- Create search vector update trigger
CREATE OR REPLACE FUNCTION update_collection_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_collection_search_update
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_collection_search_vector();
