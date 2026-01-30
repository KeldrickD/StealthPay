import { NextResponse } from 'next/server'

function toUsdcBaseUnits(amountCents: number): bigint {
  return BigInt(amountCents) * 10_000n
}

export async function POST(req: Request) {
  try {
    const { recipientPubkey, amountCents, usdcMint } = await req.json()
    if (!recipientPubkey || !amountCents || !usdcMint) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }

    const RPC_url = process.env.NEXT_PUBLIC_HELIUS_RPC_URL
    const owner = process.env.PRIVACY_PAYER_SECRET
    if (!RPC_url) return NextResponse.json({ error: 'Missing NEXT_PUBLIC_HELIUS_RPC_URL' }, { status: 500 })
    if (!owner) return NextResponse.json({ error: 'Missing PRIVACY_PAYER_SECRET' }, { status: 500 })

    // Dynamic import to avoid bundling issues
    const importer = new Function('s', 'return import(s)') as (s: string) => Promise<any>
    const mod = await importer('@privacy-cash/privacy-cash-sdk')
    const { PrivacyCash } = mod
    if (!PrivacyCash) return NextResponse.json({ error: 'SDK export not found' }, { status: 500 })

    const pc = new PrivacyCash({ RPC_url, owner, enableDebug: false })
    const base_units = toUsdcBaseUnits(Number(amountCents))

    // Shield then unshield to recipient
    await pc.depositSPL({ mintAddress: usdcMint, base_units })
    const wd = await pc.withdrawSPL({ mintAddress: usdcMint, base_units, recipientAddress: recipientPubkey })

    const sig = wd?.signature || wd?.txSignature || wd?.tx || (typeof wd === 'string' ? wd : undefined)
    if (!sig) return NextResponse.json({ error: 'No signature returned', detail: wd }, { status: 500 })

    return NextResponse.json({ tx: sig })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Privacy Cash error' }, { status: 500 })
  }
}
