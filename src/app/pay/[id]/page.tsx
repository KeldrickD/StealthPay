'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Connection } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'

// ✅ your existing helpers
import { depositUsdcPrivately, withdrawViaRelayer } from '@/lib/privacy'

type InvoiceStatus =
  | 'created'
  | 'deposit_pending'
  | 'deposit_confirmed'
  | 'withdraw_pending'
  | 'confirmed'
  | 'failed'

interface Invoice {
  id: string
  recipientPubkey: string
  amountCents: number
  mint: 'USDC'
  note?: string
  createdAt: string
  expiry: string
  status: InvoiceStatus
  privacy: boolean
  compliance: boolean
}

function centsToUsdc(amountCents: number) {
  return (amountCents / 100).toFixed(2)
}

export default function PayInvoicePage() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.id as string

  const wallet = useWallet()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [depositSig, setDepositSig] = useState<string | null>(null)
  const [withdrawSig, setWithdrawSig] = useState<string | null>(null)

  const [busy, setBusy] = useState<{
    screening: boolean
    depositing: boolean
    withdrawing: boolean
    confirmingDeposit: boolean
  }>({
    screening: false,
    depositing: false,
    withdrawing: false,
    confirmingDeposit: false,
  })

  const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL
  const usdcMint = process.env.NEXT_PUBLIC_USDC_MINT
  const relayerUrl = process.env.NEXT_PUBLIC_RELAYER_URL

  const connection = useMemo(() => {
    if (!rpcUrl) return null
    return new Connection(rpcUrl, 'confirmed')
  }, [rpcUrl])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`invoice_${invoiceId}`)
      if (!stored) {
        setError('Invoice not found (local demo storage). Create a new invoice on this device.')
        return
      }
      const inv = JSON.parse(stored) as Invoice

      // Expiry check
      const exp = new Date(inv.expiry).getTime()
      if (Date.now() > exp) {
        setError('Invoice expired.')
        return
      }

      setInvoice(inv)
    } catch (e) {
      setError('Failed to load invoice.')
    }
  }, [invoiceId])

  function persistInvoice(update: Partial<Invoice>) {
    if (!invoice) return
    const next = { ...invoice, ...update }
    setInvoice(next)
    localStorage.setItem(`invoice_${invoiceId}`, JSON.stringify(next))
  }

  async function handleDeposit() {
    setError(null)

    if (!invoice) return setError('Invoice missing.')
    if (!connection) return setError('Missing NEXT_PUBLIC_HELIUS_RPC_URL.')
    if (!usdcMint) return setError('Missing NEXT_PUBLIC_USDC_MINT.')
    if (!wallet?.publicKey) return setError('Connect a wallet to pay.')

    try {
      setBusy((s) => ({ ...s, depositing: true }))
      persistInvoice({ status: 'deposit_pending' })

      // Convert cents -> base units (USDC has 6 decimals).
      // amountCents = dollars*100. USDC base units = dollars * 1e6
      // dollars = cents/100 => baseUnits = (cents/100) * 1e6 = cents * 10_000
      const baseUnits = (BigInt(invoice.amountCents) * 10_000n).toString()

      const sig = await depositUsdcPrivately({
        connection,
        wallet,
        usdcMint,
        baseUnits,
      })

      setDepositSig(sig)
      persistInvoice({ status: 'deposit_confirmed' })
    } catch (e: any) {
      persistInvoice({ status: 'failed' })
      setError(e?.message || 'Deposit failed.')
    } finally {
      setBusy((s) => ({ ...s, depositing: false }))
    }
  }

  async function confirmDepositOnChain() {
    if (!connection || !depositSig) return
    setError(null)
    try {
      setBusy((s) => ({ ...s, confirmingDeposit: true }))
      const res = await connection.confirmTransaction(depositSig, 'confirmed')
      if (res.value.err) throw new Error('Deposit transaction failed on-chain.')
    } catch (e: any) {
      setError(e?.message || 'Deposit confirmation failed.')
    } finally {
      setBusy((s) => ({ ...s, confirmingDeposit: false }))
    }
  }

  async function handleWithdraw() {
    setError(null)

    if (!invoice) return setError('Invoice missing.')
    if (!depositSig) return setError('Deposit first.')
    if (!relayerUrl) return setError('Missing NEXT_PUBLIC_RELAYER_URL.')
    if (!usdcMint) return setError('Missing NEXT_PUBLIC_USDC_MINT.')

    try {
      setBusy((s) => ({ ...s, withdrawing: true }))
      persistInvoice({ status: 'withdraw_pending' })

      const baseUnits = (BigInt(invoice.amountCents) * 10_000n).toString()

      const sig = await withdrawViaRelayer({
        relayerUrl,
        recipientAddress: invoice.recipientPubkey,
        mintAddress: usdcMint,
        base_units: baseUnits,
        depositSig,
        invoiceId: invoice.id,
      })

      setWithdrawSig(sig)
      persistInvoice({ status: 'confirmed' })

      // Send to receipt page with both sigs
      const qs = new URLSearchParams({
        deposit: depositSig,
        withdraw: sig,
      }).toString()

      router.push(`/receipt/${invoice.id}?${qs}`)
    } catch (e: any) {
      persistInvoice({ status: 'failed' })
      setError(e?.message || 'Withdraw failed.')
    } finally {
      setBusy((s) => ({ ...s, withdrawing: false }))
    }
  }

  if (error && !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full text-center">
          <p className="text-white">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full text-center">
          <p className="text-white">Loading…</p>
        </div>
      </div>
    )
  }

  const amountDue = `${centsToUsdc(invoice.amountCents)} USDC`

  const canDeposit =
    !!wallet?.publicKey && !depositSig && !busy.depositing && !busy.screening

  const canWithdraw =
    !!depositSig && !withdrawSig && !busy.withdrawing && invoice.status !== 'failed'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Pay Invoice</h1>
            <p className="text-slate-300 text-sm">Privacy by default. Proof by choice.</p>
          </div>

          <div className="text-right">
            <div className="text-slate-300 text-xs">Wallet</div>
            <div className="text-white text-sm">
              {wallet?.publicKey ? (
                <span className="font-mono">
                  {wallet.publicKey.toBase58().slice(0, 4)}…{wallet.publicKey.toBase58().slice(-4)}
                </span>
              ) : (
                <span className="text-slate-400">Not connected</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-700 rounded p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Amount Due</span>
            <span className="text-white font-bold text-lg">{amountDue}</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Sent privately — amount not visible on-chain.
          </p>

          {invoice.note ? (
            <div className="mt-3">
              <div className="text-slate-300 text-sm">Note</div>
              <div className="text-white">{invoice.note}</div>
            </div>
          ) : null}
        </div>

        <div className="bg-amber-900/40 border border-amber-700 rounded p-3 mb-3 text-sm text-amber-100">
          <div className="font-bold">Privacy Mode Active</div>
          <div>Your deposit enters the privacy pool; withdrawal delivers funds to the recipient.</div>
        </div>

        {invoice.compliance ? (
          <div className="bg-emerald-900/40 border border-emerald-700 rounded p-3 mb-3 text-sm text-emerald-100">
            <div className="font-bold">Compliance Mode Enabled</div>
            <div>Sender and recipient will be screened before deposit.</div>
          </div>
        ) : null}

        {error ? (
          <div className="bg-red-900/40 border border-red-700 rounded p-3 mb-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {/* Step 1: Deposit */}
        <button
          onClick={handleDeposit}
          disabled={!canDeposit}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded transition"
        >
          {busy.screening
            ? 'Screening…'
            : busy.depositing
              ? 'Depositing…'
              : depositSig
                ? 'Deposit complete ✅'
                : 'Deposit privately'}
        </button>

        {/* Optional: confirm deposit */}
        {depositSig ? (
          <button
            onClick={confirmDepositOnChain}
            disabled={busy.confirmingDeposit}
            className="w-full mt-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 text-white font-semibold py-2 px-4 rounded transition"
          >
            {busy.confirmingDeposit ? 'Confirming deposit…' : 'Confirm deposit on-chain'}
          </button>
        ) : null}

        {/* Step 2: Withdraw */}
        <button
          onClick={handleWithdraw}
          disabled={!canWithdraw}
          className="w-full mt-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded transition"
        >
          {busy.withdrawing
            ? 'Withdrawing…'
            : withdrawSig
              ? 'Withdrawal complete ✅'
              : 'Withdraw to recipient'}
        </button>

        {/* Signatures */}
        {(depositSig || withdrawSig) ? (
          <div className="mt-5 space-y-3">
            {depositSig ? (
              <div className="bg-slate-900/40 rounded p-3">
                <div className="text-slate-300 text-xs mb-1">Deposit signature</div>
                <div className="text-slate-100 text-xs font-mono break-all">{depositSig}</div>
              </div>
            ) : null}

            {withdrawSig ? (
              <div className="bg-slate-900/40 rounded p-3">
                <div className="text-slate-300 text-xs mb-1">Withdraw signature</div>
                <div className="text-slate-100 text-xs font-mono break-all">{withdrawSig}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 pt-4 border-t border-slate-700 text-xs text-slate-400 space-y-1">
          <div>Invoice ID: <span className="font-mono">{invoice.id}</span></div>
          <div>Recipient: <span className="font-mono">{invoice.recipientPubkey}</span></div>
          <div>Status: <span className="text-slate-300">{invoice.status}</span></div>
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
