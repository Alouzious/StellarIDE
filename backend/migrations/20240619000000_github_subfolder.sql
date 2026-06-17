-- Scope GitHub-linked projects to a contract subfolder within mixed repos
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS github_subfolder TEXT;
