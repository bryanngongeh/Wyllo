CREATE TABLE IF NOT EXISTS library_items (
  user_sub text NOT NULL,
  media_id varchar(160) NOT NULL,
  media_type varchar(8) NOT NULL CHECK (media_type IN ('anime', 'manga')),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_sub, media_id)
);

CREATE INDEX IF NOT EXISTS library_items_user_added_idx
  ON library_items (user_sub, added_at DESC);

CREATE TABLE IF NOT EXISTS user_progress (
  user_sub text NOT NULL,
  progress_key varchar(200) NOT NULL,
  progress_kind varchar(8) NOT NULL CHECK (progress_kind IN ('watch', 'read')),
  percent smallint NOT NULL CHECK (percent BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_sub, progress_kind, progress_key)
);

CREATE INDEX IF NOT EXISTS user_progress_user_updated_idx
  ON user_progress (user_sub, updated_at DESC);