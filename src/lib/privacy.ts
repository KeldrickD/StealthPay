import type { Connection } from '@solana/web3.js'

export function toUsdcBaseUnits(amountCents: number): bigint {
  // cents (10^2) -> USDC base units (10^6) => * 10^4
  return BigInt(amountCents) * 10_000n
}

export async function sendPrivatePaymentViaPrivacyCash(args: {
  connection: Connection
  payerWallet: any // Wallet adapter (not used on server path)
  recipientPubkey: string
  amountCents: number
  usdcMint: string
}): Promise<string> {
  const { recipientPubkey, amountCents, usdcMint } = args

  // Demo mode: return mock signature without calling SDK
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  if (isDemoMode) {
    console.log('[Privacy] Demo mode enabled, returning mock signature')
    await new Promise((r) => setTimeout(r, 1500))
    return 'MockSig_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2)
  }

  // Production mode: call Privacy Cash SDK via API
  const r = await fetch('/api/privacy/pay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recipientPubkey, amountCents, usdcMint }),
  })

  if (!r.ok) {
    const errorBody = await r.json().catch(() => ({}))
    throw new Error(errorBody.error || `Privacy Cash API failed: ${r.status}`)
  }

  const j = await r.json()
  if (!j.tx) {
    throw new Error('No signature returned from Privacy Cash API')
  }

  return j.tx as string
}

