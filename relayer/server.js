import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { Connection, PublicKey } from '@solana/web3.js'

const app = express()
app.use(express.json())

// ============================================================================
// Safety limits
// ============================================================================
const MAX_BASE_UNITS_PER_TX = BigInt(process.env.MAX_BASE_UNITS_PER_TX || '2000000') // $2 USDC default for demo
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_PER_WINDOW = parseInt(process.env.RATE_LIMIT_PER_MIN || '10')

// In-memory rate limiter (for demo; use Redis in production)
const requestLog = new Map()

function checkRateLimit(key) {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  
  if (!requestLog.has(key)) {
    requestLog.set(key, [])
  }
  
  const reqs = requestLog.get(key).filter(t => t > windowStart)
  if (reqs.length >= RATE_LIMIT_MAX_PER_WINDOW) {
    return false
  }
  
  reqs.push(now)
  requestLog.set(key, reqs)
  return true
}

app.use(cors({
  origin: (process.env.CORS_ORIGIN || '*').split(','),
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.get('/health', (_, res) => res.json({ ok: true }))

app.get('/whoami', async (_, res) => {
  try {
    const owner = process.env.PRIVACY_PAYER_SECRET
    if (!owner) return res.status(500).json({ error: 'Missing PRIVACY_PAYER_SECRET' })

    // Try JSON array format (Solana keypair)
    try {
      const arr = JSON.parse(owner)
      const { Keypair } = await import('@solana/web3.js')
      const kp = Keypair.fromSecretKey(Uint8Array.from(arr))
      return res.json({ 
        pubkey: kp.publicKey.toBase58(),
        rpc: process.env.HELIUS_RPC_URL,
        format: 'json-array'
      })
    } catch {}

    // Try base58 format
    try {
      const { default: bs58 } = await import('bs58')
      const { Keypair } = await import('@solana/web3.js')
      const decoded = bs58.decode(owner)
      const kp = Keypair.fromSecretKey(decoded)
      return res.json({ 
        pubkey: kp.publicKey.toBase58(),
        rpc: process.env.HELIUS_RPC_URL,
        format: 'base58'
      })
    } catch {}

    return res.status(500).json({ error: 'Could not decode PRIVACY_PAYER_SECRET' })
  } catch (e) {
    return res.status(500).json({ error: String(e?.message ?? e) })
  }
})

app.get('/debug/token-accounts', async (req, res) => {
  try {
    const RPC_url = process.env.HELIUS_RPC_URL
    const ownerPubkey = 'CPAd5VvTcfWTtg8rhhaL9xQyzyKT8t3DuHbAEPiX8nT5'
    const mint = req.query.mint?.toString()

    if (!mint) return res.status(400).json({ ok: false, error: 'missing ?mint=' })

    const connection = new Connection(RPC_url)
    const out = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(ownerPubkey),
      { mint: new PublicKey(mint) }
    )

    res.json({
      ok: true,
      count: out.value.length,
      accounts: out.value.map(v => ({
        pubkey: v.pubkey.toBase58(),
        uiAmount: v.account.data.parsed.info.tokenAmount.uiAmountString,
        decimals: v.account.data.parsed.info.tokenAmount.decimals
      }))
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) })
  }
})

app.get('/debug/all-tokens', async (req, res) => {
  try {
    const RPC_url = process.env.HELIUS_RPC_URL
    const ownerPubkey = 'CPAd5VvTcfWTtg8rhhaL9xQyzyKT8t3DuHbAEPiX8nT5'
    const connection = new Connection(RPC_url)

    const out = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(ownerPubkey),
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    )

    const tokens = out.value
      .map(v => ({
        tokenAccount: v.pubkey.toBase58(),
        mint: v.account.data.parsed.info.mint,
        uiAmount: v.account.data.parsed.info.tokenAmount.uiAmountString,
        decimals: v.account.data.parsed.info.tokenAmount.decimals
      }))
      .filter(t => t.uiAmount !== '0')

    res.json({ ok: true, tokens })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) })
  }
})

app.post('/pay', async (req, res) => {
  try {
    const auth = req.headers.authorization || ''
    if (process.env.RELAYER_TOKEN && auth !== `Bearer ${process.env.RELAYER_TOKEN}`) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }

    const { recipientAddress, mintAddress, base_units } = req.body || {}
    if (!recipientAddress || !mintAddress || base_units === undefined) {
      return res.status(400).json({ ok: false, error: 'Missing recipientAddress/mintAddress/base_units' })
    }

    const RPC_url = process.env.HELIUS_RPC_URL
    const owner = process.env.PRIVACY_PAYER_SECRET
    if (!RPC_url) return res.status(500).json({ ok: false, error: 'Missing HELIUS_RPC_URL' })
    if (!owner) return res.status(500).json({ ok: false, error: 'Missing PRIVACY_PAYER_SECRET' })

    // Runtime import avoids bundler problems
    const mod = await import('@privacy-cash/privacy-cash-sdk')
    const PrivacyCash = mod?.PrivacyCash
    if (!PrivacyCash) {
      return res.status(500).json({ ok: false, error: 'PrivacyCash export not found', exports: Object.keys(mod ?? {}) })
    }

    const pc = new PrivacyCash({ RPC_url, owner, enableDebug: true })

    const amountStr = typeof base_units === 'string' ? base_units : String(Math.trunc(base_units))

    const dep = await pc.depositSPL({ mintAddress, base_units: amountStr })
    const wd = await pc.withdrawSPL({ mintAddress, base_units: amountStr, recipientAddress })

    const signature =
      wd?.signature || wd?.txSignature || wd?.txid || wd?.transactionSignature || dep?.signature

    return res.json({ ok: true, signature, deposit: dep, withdraw: wd })
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message ?? e) })
  }
})

// NEW: /withdraw endpoint for Option 2 (client deposits, relayer withdraws)
// Expects: { recipientAddress, mintAddress, base_units, invoiceId, depositSig }
// The SDK will fetch the payer's encrypted UTXOs and prove withdrawal
app.post('/withdraw', async (req, res) => {
  try {
    // Rate limit check
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown'
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ ok: false, error: 'Rate limit exceeded' })
    }

    // Auth check
    const auth = req.headers.authorization || ''
    if (process.env.RELAYER_TOKEN && auth !== `Bearer ${process.env.RELAYER_TOKEN}`) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }

    const { recipientAddress, mintAddress, base_units, invoiceId, depositSig } = req.body || {}
    if (!recipientAddress || !mintAddress || base_units === undefined) {
      return res.status(400).json({ ok: false, error: 'Missing recipientAddress/mintAddress/base_units' })
    }

    // Safety: check base_units against max
    const amountInt = typeof base_units === 'string' ? BigInt(base_units) : BigInt(Math.trunc(base_units))
    if (amountInt > MAX_BASE_UNITS_PER_TX) {
      return res.status(400).json({ 
        ok: false, 
        error: `Amount exceeds limit (max: ${MAX_BASE_UNITS_PER_TX.toString()}, got: ${amountInt.toString()})` 
      })
    }

    // Safety: only allow mainnet USDC for now
    const expectedUsdcMint = process.env.USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    if (mintAddress !== expectedUsdcMint) {
      return res.status(400).json({ 
        ok: false, 
        error: `Unsupported mint. Expected ${expectedUsdcMint}` 
      })
    }

    const RPC_url = process.env.HELIUS_RPC_URL
    const owner = process.env.PRIVACY_PAYER_SECRET
    if (!RPC_url) return res.status(500).json({ ok: false, error: 'Missing HELIUS_RPC_URL' })
    if (!owner) return res.status(500).json({ ok: false, error: 'Missing PRIVACY_PAYER_SECRET' })

    // Runtime import
    const mod = await import('@privacy-cash/privacy-cash-sdk')
    const PrivacyCash = mod?.PrivacyCash
    if (!PrivacyCash) {
      return res.status(500).json({ ok: false, error: 'PrivacyCash export not found' })
    }

    // Create SDK instance with relayer key (relayer pays for withdrawal)
    const pc = new PrivacyCash({ RPC_url, owner, enableDebug: true })

    const amountStr = amountInt.toString()

    // Perform withdraw only (SDK will fetch payer's UTXOs internally)
    const wd = await pc.withdrawSPL({
      mintAddress,
      base_units: amountStr,
      recipientAddress,
      // Note: SDK uses the connection RPC to fetch UTXOs for payerPublicKey
      // If SDK doesn't auto-detect payer, we may need to pass publicKey param
    })

    const signature = wd?.signature || wd?.txSignature || wd?.txid || wd?.transactionSignature || wd?.tx

    return res.json({ ok: true, signature, withdraw: wd })
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message ?? e) })
  }
})

const port = process.env.PORT || 8080
app.listen(port, () => console.log(`Relayer listening on :${port}`))
