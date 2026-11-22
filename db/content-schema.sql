CREATE TABLE IF NOT EXISTS site_content (
  section TEXT PRIMARY KEY CHECK (section IN ('music', 'about', 'contact', 'follow')),
  draft TEXT NOT NULL,
  published TEXT,
  previous TEXT,
  revision INTEGER NOT NULL DEFAULT 1
);
