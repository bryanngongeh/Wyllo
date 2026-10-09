ALTER TABLE provider_references
  ADD COLUMN IF NOT EXISTS parent_provider_ref varchar(500);