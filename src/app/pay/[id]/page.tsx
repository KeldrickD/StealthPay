'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { sendPrivatePaymentViaPrivacyCash } from '@/lib/privacy'

interface Invoice {
  id: string
  recipientPubkey: string
  amountCents: number
  mint: 'USDC'
  note: string
  createdAt: string
  expiry: string
  status: string
  privacy: boolean
  compliance: boolean
}

type RangeResult = {
  blocked: boolean
  checked_at?: string
  is_token_blacklisted?: boolean
  is_ofac_sanctioned?: boolean
  attribution?: any
}

async function rangeSanctionsCheck(address: string): Promise<RangeResult> {
  const r = await fetch('/api/range/sanctions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address }),
  })

  if (!r.ok) throw new Error('Range screening failed')
  return r.json()
}

export default function PayInvoice() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.id as string
  const { publicKey } = useWallet()
  const { connection } = useConnection()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(`invoice_${invoiceId}`)
    if (stored) setInvoice(JSON.parse(stored))
    else setError('Invoice not found')
  }, [invoiceId])

  const handlePrivatePayment = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!invoice) throw new Error('Missing invoice')
      if (!publicKey) throw new Error('Please connect a wallet to pay.')

      const recipient = invoice.recipientPubkey
      if (!recipient) throw new Error('Invoice missing recipient address.')

      // 1) Compliance gate (Range)
      let screening: RangeResult | null = null
      if (invoice.compliance) {
        screening = await rangeSanctionsCheck(publicKey.toBase58())
        if (screening.blocked) {
          setError('Payment blocked (sanctions/blacklist screening).')
          setLoading(false)
          return
        }
      }

      // 2) Execute private payment (Privacy Cash)
      const sig = await sendPrivatePaymentViaPrivacyCash({
        connection,
        payerWallet: { publicKey },
        recipientPubkey: recipient,
        amountCents: invoice.amountCents,
        usdcMint: process.env.NEXT_PUBLIC_USDC_MINT || '',
      })

      setTxSignature(sig)

      // 3) Update invoice status + store tx for receipt page
      const updated = {
        ...invoice,
        status: 'pending_confirmation',
      }

      localStorage.setItem(`invoice_${invoiceId}`, JSON.stringify(updated))
      localStorage.setItem(
        `receipt_${invoiceId}`,
        JSON.stringify({
          invoiceId,
          tx: sig,
          payer: publicKey.toBase58(),
          recipient,
          compliance: invoice.compliance,
          screening,
          createdAt: new Date().toISOString(),
        })
      )

      setTimeout(() => {
        router.push(`/receipt/${invoiceId}?tx=${sig}`)
      }, 700)
    } catch (err: any) {
      setError(err?.message || 'Payment failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-slate-700 rounded-lg p-8 max-w-md w-full text-center">
          <p className="text-white">{error || 'Loading...'}</p>
          {error && (
            <button
              onClick={() => router.push('/')}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    )
  }

  if (txSignature) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-slate-700 rounded-lg p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <div className="text-4xl">⏳</div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Payment Processing</h2>
          <p className="text-slate-300 mb-4">Confirming your private transfer...</p>
          <div className="bg-slate-600 rounded p-4 text-xs text-slate-300 break-all font-mono">
            {txSignature}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-slate-700 rounded-lg p-8 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Pay Invoice</h1>
          <WalletMultiButton />
        </div>

        <div className="bg-slate-600 rounded p-4 mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300">Amount Due</span>
            <span className="text-2xl font-bold text-white">{(invoice.amountCents / 100).toFixed(2)} USDC</span>
          </div>
          <p className="text-slate-400 text-xs mb-4">Sent privately — amount not visible on-chain</p>

          {invoice.note && (
            <div className="mb-4">
              <p className="text-slate-300 text-sm">Note</p>
              <p className="text-white">{invoice.note}</p>
            </div>
          )}
        </div>

        <div className="bg-yellow-900 border border-yellow-700 rounded p-3 mb-6 text-sm text-yellow-100">
          <p className="font-bold mb-1">Privacy Mode Active</p>
          <p>Your payment will be sent privately on Solana. No one can see the amount on-chain.</p>
        </div>

        {invoice.compliance && (
          <div className="bg-emerald-900 border border-emerald-700 rounded p-3 mb-6 text-sm text-emerald-100">
            <p className="font-bold mb-1">Compliance Mode Enabled</p>
            <p>Sender will be screened before payment is processed.</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-700 rounded p-3 mb-4 text-red-100 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handlePrivatePayment} className="space-y-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 text-white font-bold py-3 px-4 rounded text-lg transition"
          >
            {loading ? 'Processing Payment...' : 'Pay Privately'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded transition"
          >
            Cancel
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-500">
          <p className="text-xs text-slate-400">Invoice ID: {invoiceId}</p>
          <p className="text-xs text-slate-400 mt-1">Status: {invoice.status}</p>
        </div>
      </div>
    </div>
  )
}
