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
