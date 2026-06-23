import guideOverview from './guide/index'
import createAccount from './guide/create-account'
import firstContract from './guide/first-contract'
import usingEditor from './guide/using-editor'
import compileErrors from './guide/compile-errors'
import deployTestnet from './guide/deploy-testnet'
import connectWallet from './guide/connect-wallet'
import inviteTeam from './guide/invite-team'
import importGithub from './guide/import-github'
import auditContract from './guide/audit-contract'
import faq from './guide/faq'
import overview from './overview'
import gettingStarted from './getting-started'
import editor from './editor'
import compileTest from './compile-test'
import deploy from './deploy'
import wallet from './wallet'
import github from './github'
import collaboration from './collaboration'
import audit from './audit'
import aiAssistant from './ai-assistant'
import api from './api'

const CONTENT_BY_PATH = {
  '/docs/guide': guideOverview,
  '/docs/guide/create-account': createAccount,
  '/docs/guide/first-contract': firstContract,
  '/docs/guide/using-editor': usingEditor,
  '/docs/guide/compile-errors': compileErrors,
  '/docs/guide/deploy-testnet': deployTestnet,
  '/docs/guide/connect-wallet': connectWallet,
  '/docs/guide/invite-team': inviteTeam,
  '/docs/guide/import-github': importGithub,
  '/docs/guide/audit-contract': auditContract,
  '/docs/guide/faq': faq,
  '/docs': overview,
  '/docs/getting-started': gettingStarted,
  '/docs/editor': editor,
  '/docs/compile-test': compileTest,
  '/docs/deploy': deploy,
  '/docs/wallet': wallet,
  '/docs/github': github,
  '/docs/collaboration': collaboration,
  '/docs/audit': audit,
  '/docs/ai-assistant': aiAssistant,
  '/docs/api': api,
}

export default CONTENT_BY_PATH
