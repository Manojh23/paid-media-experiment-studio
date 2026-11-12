CREATE TABLE IF NOT EXISTS media_experiments (
  id uuid PRIMARY KEY, digest text UNIQUE NOT NULL,
  report jsonb NOT NULL, brief jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','declined')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
