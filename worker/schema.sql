CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'maintainer',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  device_label TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plants (
  id TEXT PRIMARY KEY,
  category_id TEXT,
  name TEXT NOT NULL,
  cover_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS specs (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (plant_id, label),
  FOREIGN KEY (plant_id) REFERENCES plants(id)
);

CREATE TABLE IF NOT EXISTS price_records (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  uploaded_date TEXT NOT NULL,
  price TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (spec_id) REFERENCES specs(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES
  ('cat_tree', '乔木', 10),
  ('cat_shrub', '灌木', 20),
  ('cat_groundcover', '地被', 30),
  ('cat_lawn', '草皮', 40),
  ('cat_flower', '花卉', 50),
  ('cat_indoor', '室内植物', 60),
  ('cat_material', '资材器材', 70),
  ('cat_pesticide', '农药', 80);

