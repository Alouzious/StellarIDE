-- GitHub OAuth token storage and project repo linkage

CREATE TABLE IF NOT EXISTS oauth_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    access_token    TEXT NOT NULL,
    scopes          TEXT,
    provider_login  TEXT,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS github_owner  TEXT,
    ADD COLUMN IF NOT EXISTS github_repo   TEXT,
    ADD COLUMN IF NOT EXISTS github_branch TEXT DEFAULT 'main';

ALTER TABLE project_files
    ADD COLUMN IF NOT EXISTS github_sha TEXT;

CREATE INDEX IF NOT EXISTS idx_oauth_connections_user_id ON oauth_connections(user_id);
