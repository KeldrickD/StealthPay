import { NextResponse } from 'next/server'

// IMPORTANT: Privacy Cash SDK needs Node runtime (not Edge)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Body = {
  recipientPubkey?: string
  amountCents?: number | string
  usdcMint?: string
}

function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status })
}

function toUsdcBaseUnits(amountCents: number): string {
  // cents (10^2) -> USDC base units (10^6) => * 10^4
  return String(BigInt(amountCents) * 10_000n)
}

async function loadPrivacyCashSdk() {
  // Runtime import prevents Vercel from failing at build time
  return await import('@privacy-cash/privacy-cash-sdk')
}

export async function POST(req: Request) {
  try {
    const { recipientPubkey, amountCents, usdcMint } = (await req.json()) as Body

    if (!recipientPubkey) return jsonError('Missing recipientPubkey')
    if (amountCents === undefined || amountCents === null) return jsonError('Missing amountCents')
    if (!usdcMint) return jsonError('Missing usdcMint')

    const RPC_url = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.HELIUS_RPC_URL || process.env.RPC_URL
    const owner = process.env.PRIVACY_PAYER_SECRET

    if (!RPC_url) {
      return NextResponse.json({ ok: true, mocked: true, tx: `mock_no_rpc_${Date.now()}` })
    }
    if (!owner) {
      return NextResponse.json({ ok: true, mocked: true, tx: `mock_no_owner_${Date.now()}` })
    }

    let mod: any
    try {
      mod = await loadPrivacyCashSdk()
    } catch (e: any) {
      return NextResponse.json({ ok: true, mocked: true, tx: `mock_sdk_unavailable_${Date.now()}` })
    }

    const PrivacyCash = mod?.PrivacyCash
    if (!PrivacyCash) {
      return NextResponse.json({ ok: true, mocked: true, tx: `mock_sdk_exports_${Date.now()}` })
    }

    const pc = new PrivacyCash({ RPC_url, owner, enableDebug: false })
    const base_units = toUsdcBaseUnits(Number(amountCents))

    const dep = await pc.depositSPL({ mintAddress: usdcMint, base_units })
    const wd = await pc.withdrawSPL({ mintAddress: usdcMint, base_units, recipientAddress: recipientPubkey })

    const sig = wd?.signature || wd?.txSignature || wd?.tx || wd?.txid || dep?.signature
    if (!sig) return jsonError('No signature returned from Privacy Cash', 500, { detail: wd })

    return NextResponse.json({ ok: true, mocked: false, tx: sig })
  } catch (e: any) {
    return jsonError('Server error executing private payment', 500, { detail: String(e?.message ?? e) })
  }
}
