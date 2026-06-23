-- Track the GitHub commit SHA a project was last synced to (import/link/push),
-- so pushes can detect when the remote branch has moved ahead (conflict).
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS github_last_synced_sha TEXT;
