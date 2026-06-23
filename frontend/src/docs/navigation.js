export const GUIDE_NAV = [
  { path: '/docs/guide', slug: 'guide', title: 'Overview', editFile: 'guide/index.js' },
  { path: '/docs/guide/create-account', slug: 'create-account', title: 'Creating your account', editFile: 'guide/create-account.js' },
  { path: '/docs/guide/first-contract', slug: 'first-contract', title: 'Your First Contract', editFile: 'guide/first-contract.js' },
  { path: '/docs/guide/using-editor', slug: 'using-editor', title: 'Using the Editor', editFile: 'guide/using-editor.js' },
  { path: '/docs/guide/compile-errors', slug: 'compile-errors', title: 'Compile Errors', editFile: 'guide/compile-errors.js' },
  { path: '/docs/guide/deploy-testnet', slug: 'deploy-testnet', title: 'Deploy to Testnet', editFile: 'guide/deploy-testnet.js' },
  { path: '/docs/guide/connect-wallet', slug: 'connect-wallet', title: 'Connect Wallet', editFile: 'guide/connect-wallet.js' },
  { path: '/docs/guide/invite-team', slug: 'invite-team', title: 'Invite Team', editFile: 'guide/invite-team.js' },
  { path: '/docs/guide/import-github', slug: 'import-github', title: 'Import from GitHub', editFile: 'guide/import-github.js' },
  { path: '/docs/guide/audit-contract', slug: 'audit-contract', title: 'Audit a Contract', editFile: 'guide/audit-contract.js' },
  { path: '/docs/guide/faq', slug: 'faq', title: 'FAQ', editFile: 'guide/faq.js' },
]

export const TECH_NAV = [
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

export const ALL_DOC_PAGES = [...GUIDE_NAV, ...TECH_NAV]

export const GITHUB_REPO = 'https://github.com/Alouzious/StellarIDE'
export const GITHUB_EDIT_BASE = `${GITHUB_REPO}/edit/main/frontend/src/docs/content`

/** @deprecated use TECH_NAV */
export const DOCS_NAV = TECH_NAV

export function getDocMeta(pathname) {
  const normalized = pathname.replace(/\/$/, '') || '/docs'
  const index = ALL_DOC_PAGES.findIndex((item) => item.path === normalized)
  if (index === -1) return { current: null, prev: null, next: null }
  return {
    current: ALL_DOC_PAGES[index],
    prev: index > 0 ? ALL_DOC_PAGES[index - 1] : null,
    next: index < ALL_DOC_PAGES.length - 1 ? ALL_DOC_PAGES[index + 1] : null,
  }
}
