export const GITHUB_REPO = 'https://github.com/Alouzious/StellarIDE'
export const GITHUB_EDIT_BASE = `${GITHUB_REPO}/edit/main/frontend/src/docs/content`

export const DOCS_NAV = [
  { path: '/docs', slug: 'overview', title: 'Overview', editFile: 'overview.js' },
  { path: '/docs/getting-started', slug: 'getting-started', title: 'Getting Started', editFile: 'getting-started.js' },
  { path: '/docs/editor', slug: 'editor', title: 'The Editor', editFile: 'editor.js' },
  { path: '/docs/compile-test', slug: 'compile-test', title: 'Compile and Test', editFile: 'compile-test.js' },
  { path: '/docs/deploy', slug: 'deploy', title: 'Deploy Contracts', editFile: 'deploy.js' },
  { path: '/docs/wallet', slug: 'wallet', title: 'Wallet Integration', editFile: 'wallet.js' },
  { path: '/docs/github', slug: 'github', title: 'GitHub Integration', editFile: 'github.js' },
  { path: '/docs/collaboration', slug: 'collaboration', title: 'Real-time Collaboration', editFile: 'collaboration.js' },
  { path: '/docs/audit', slug: 'audit', title: 'Contract Auditing', editFile: 'audit.js' },
  { path: '/docs/ai-assistant', slug: 'ai-assistant', title: 'AI Assistant', editFile: 'ai-assistant.js' },
  { path: '/docs/api', slug: 'api', title: 'API Reference', editFile: 'api.js' },
]

export function getDocMeta(pathname) {
  const normalized = pathname.replace(/\/$/, '') || '/docs'
  const index = DOCS_NAV.findIndex((item) => item.path === normalized)
  if (index === -1) return { current: null, prev: null, next: null }
  return {
    current: DOCS_NAV[index],
    prev: index > 0 ? DOCS_NAV[index - 1] : null,
    next: index < DOCS_NAV.length - 1 ? DOCS_NAV[index + 1] : null,
  }
}
