-- Collection Projects junction table
CREATE TABLE IF NOT EXISTS collection_projects (
  id VARCHAR(255) PRIMARY KEY,
  collection_id VARCHAR(255) NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL DEFAULT 1000,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  added_by VARCHAR(255) NULL,
  notes VARCHAR(500) NULL,
  UNIQUE(collection_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_projects_order ON collection_projects(collection_id, position);

-- Collection Stats table
CREATE TABLE IF NOT EXISTS collection_stats (
  id VARCHAR(255) PRIMARY KEY,
  collection_id VARCHAR(255) NOT NULL UNIQUE REFERENCES collections(id) ON DELETE CASCADE,
  views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  clones INTEGER NOT NULL DEFAULT 0,
  project_clicks INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Collection Activity table
CREATE TABLE IF NOT EXISTS collection_activity (
  id VARCHAR(255) PRIMARY KEY,
  collection_id VARCHAR(255) NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor_id VARCHAR(255) NULL,
  actor_type VARCHAR(20) NOT NULL,
  details JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collection_activity_history
  ON collection_activity(collection_id, created_at DESC);
