-- History of push attempts from StellarIDE to GitHub (success, conflict, or error),
-- so the IDE can show a push log linked to GitHub commits.
CREATE TABLE IF NOT EXISTS github_pushes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    branch      TEXT NOT NULL,
    message     TEXT NOT NULL,
    commit_sha  TEXT,
    file_count  INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL,            -- 'success' | 'conflict' | 'error'
    detail      TEXT,                     -- PR url on success, or the error/conflict reason
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_pushes_project_id
    ON github_pushes(project_id, created_at DESC);
