CREATE TABLE IF NOT EXISTS provider_references (
  wyllo_id uuid NOT NULL,
  module_id varchar(120) NOT NULL,
  entity_type varchar(16) NOT NULL CHECK (entity_type IN ('media', 'episode', 'chapter')),
  provider_ref varchar(500) NOT NULL,
  media_type varchar(8) NOT NULL CHECK (media_type IN ('anime', 'manga')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wyllo_id, entity_type),
  UNIQUE (module_id, entity_type, provider_ref)
);

CREATE INDEX IF NOT EXISTS provider_references_module_ref_idx
  ON provider_references (module_id, provider_ref);