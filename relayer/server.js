import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
app.use(express.json())

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

    const pc = new PrivacyCash({ RPC_url, owner, enableDebug: false })

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

const port = process.env.PORT || 8080
app.listen(port, () => console.log(`Relayer listening on :${port}`))
