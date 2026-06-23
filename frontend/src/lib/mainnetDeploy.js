export const MAINNET_MIN_XLM = 2
export const MAINNET_CONFIRM_TEXT = 'DEPLOY'

export function buildMainnetChecklist({
  wasmFile,
  connectedAddress,
  networkOk,
  balance,
  testStatus,
  auditStatus,
}) {
  const bal = parseFloat(balance || '0')
  return [
    {
      id: 'wasm',
      label: 'WASM artifact compiled',
      ok: !!wasmFile,
      required: true,
    },
    {
      id: 'wallet',
      label: 'External wallet connected',
      ok: !!connectedAddress,
      required: true,
    },
    {
      id: 'network',
      label: 'Wallet network matches Mainnet',
      ok: networkOk,
      required: true,
    },
    {
      id: 'balance',
      label: `At least ${MAINNET_MIN_XLM} XLM available for fees`,
      ok: bal >= MAINNET_MIN_XLM,
      required: true,
    },
    {
      id: 'tests',
      label: 'Tests passed in this session',
      ok: testStatus === 'success',
      required: false,
    },
    {
      id: 'audit',
      label: 'Scout audit completed in this session',
      ok: auditStatus === 'success',
      required: false,
    },
  ]
}

export function mainnetDeployReady(checklist) {
  return checklist.filter((item) => item.required).every((item) => item.ok)
}

export function mainnetRecommendedComplete(checklist) {
  return checklist.every((item) => item.ok)
}
