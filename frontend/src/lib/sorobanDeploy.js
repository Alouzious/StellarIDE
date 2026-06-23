import {
  Address,
  Operation,
  StrKey,
  TransactionBuilder,
  Networks,
  rpc,
} from '@stellar/stellar-sdk'

export const RPC_URLS = {
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: 'https://soroban.stellar.org',
}

export function getNetworkPassphrase(network) {
  return network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET
}

export function getExplorerContractUrl(contractId, network) {
  const segment = network === 'mainnet' ? 'public' : 'testnet'
  return `https://stellar.expert/explorer/${segment}/contract/${contractId}`
}

export function getStellarLabContractUrl(contractId, network) {
  const labNet = network === 'mainnet' ? 'public' : 'testnet'
  return `https://lab.stellar.org/contract/${contractId}?network=${labNet}`
}

function isUserRejection(err) {
  const msg = `${err?.message || ''} ${err?.ext || ''}`.toLowerCase()
  return (
    err?.code === -1 ||
    msg.includes('reject') ||
    msg.includes('denied') ||
    msg.includes('cancel') ||
    msg.includes('closed the modal')
  )
}

async function pollTransaction(server, hash) {
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 2000))
    const tx = await server.getTransaction(hash)
    if (tx.status === 'SUCCESS') return tx
    if (tx.status === 'FAILED') {
      throw new Error('Transaction failed on network')
    }
  }
  throw new Error('Transaction confirmation timed out')
}

async function signAndSend({ server, tx, networkPassphrase, address, signTransaction }) {
  const prepared = await server.prepareTransaction(tx)
  let signedTxXdr
  try {
    const result = await signTransaction(prepared.toXDR(), {
      networkPassphrase,
      address,
    })
    signedTxXdr = result.signedTxXdr
  } catch (err) {
    if (isUserRejection(err)) {
      throw new Error('Transaction rejected in wallet')
    }
    if (/passphrase|network/i.test(err?.message || '')) {
      throw new Error('Wallet network does not match the selected IDE network')
    }
    throw err
  }

  const signed = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase)
  const sendResult = await server.sendTransaction(signed)

  if (sendResult.status === 'SUCCESS') return sendResult
  if (sendResult.status === 'PENDING' || sendResult.status === 'TRY_AGAIN_LATER') {
    return pollTransaction(server, sendResult.hash)
  }

  throw new Error(sendResult.errorResult?.toString() || 'Transaction failed')
}

export async function deployContractWithWallet({
  wasmBytes,
  publicKey,
  network,
  signTransaction,
  onStatus,
}) {
  const networkPassphrase = getNetworkPassphrase(network)
  const server = new rpc.Server(RPC_URLS[network] || RPC_URLS.testnet)

  onStatus?.('Fetching account…')
  const account = await server.getAccount(publicKey)

  onStatus?.('Uploading WASM…')
  const uploadTx = new TransactionBuilder(account, {
    fee: '10000000',
    networkPassphrase,
  })
    .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes }))
    .setTimeout(180)
    .build()

  const uploadResult = await signAndSend({
    server,
    tx: uploadTx,
    networkPassphrase,
    address: publicKey,
    signTransaction,
  })

  const wasmHash = uploadResult.returnValue?.bytes()
  if (!wasmHash) {
    throw new Error('Upload succeeded but WASM hash was not returned')
  }

  onStatus?.('Creating contract…')
  const accountAfterUpload = await server.getAccount(publicKey)
  const deployTx = new TransactionBuilder(accountAfterUpload, {
    fee: '10000000',
    networkPassphrase,
  })
    .addOperation(
      Operation.createCustomContract({
        address: new Address(publicKey),
        wasmHash,
        salt: uploadResult.hash,
      })
    )
    .setTimeout(180)
    .build()

  const deployResult = await signAndSend({
    server,
    tx: deployTx,
    networkPassphrase,
    address: publicKey,
    signTransaction,
  })

  const contractId = StrKey.encodeContract(
    Address.fromScAddress(deployResult.returnValue.address()).toBuffer()
  )

  return { contractId, network, networkPassphrase }
}
