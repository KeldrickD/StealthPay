'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { heliusGetTransaction } from '@/lib/helius'

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
  requestUrl?: string
}

export default function Receipt() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const invoiceId = params.id as string
  const txSignature = searchParams.get('tx')
  
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [disclosed, setDisclosed] = useState(false)
  const [complianceMode, setComplianceMode] = useState(false)
  const [showDisclosure, setShowDisclosure] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<'pending' | 'confirmed' | 'error'>('pending')
  const [confirmErr, setConfirmErr] = useState<string | null>(null)
  const [screeningInfo, setScreeningInfo] = useState<any | null>(null)
  const isMock = txSignature?.startsWith('mock_')

  useEffect(() => {
    const stored = localStorage.getItem(`invoice_${invoiceId}`)
    if (stored) {
      const inv = JSON.parse(stored)
      setInvoice(inv)
      setComplianceMode(inv.compliance)
    }
    // Load stored receipt details for screening, if any
    const r = localStorage.getItem(`receipt_${invoiceId}`)
    if (r) {
      try {
        const j = JSON.parse(r)
        if (j?.screening) setScreeningInfo(j.screening)
      } catch {}
    }
  }, [invoiceId])

  useEffect(() => {
    // Poll Helius for confirmation if we have a signature
    const sig = txSignature || (() => {
      const r = localStorage.getItem(`receipt_${invoiceId}`)
      if (!r) return null
      try {
        const j = JSON.parse(r)
        return j.tx as string
      } catch {
        return null
      }
    })()

    if (!sig || sig.startsWith('mock_')) return // skip polling for mock signatures

    let active = true
    let interval: any

    const poll = async () => {
      try {
        const res = await heliusGetTransaction(sig)
        if (res && res.meta && res.meta.err === null) {
          if (!active) return
          setConfirmStatus('confirmed')
          // Update invoice to confirmed
          const stored = localStorage.getItem(`invoice_${invoiceId}`)
          if (stored) {
            const inv = JSON.parse(stored)
            inv.status = 'confirmed'
            localStorage.setItem(`invoice_${invoiceId}`, JSON.stringify(inv))
            setInvoice(inv)
          }
          clearInterval(interval)
        }
      } catch (e: any) {
        if (!active) return
        setConfirmErr(e?.message || 'Confirmation error')
      }
    }

    // Start fast, then interval
    poll()
    interval = setInterval(poll, 2000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [invoiceId, txSignature])

  const handleGenerateDisclosure = () => {
    setDisclosed(true)
    setShowDisclosure(true)
  }

  const formatUsdc = (cents: number) => (cents / 100).toFixed(2)

  const downloadDisclosureJSON = async () => {
    if (!invoice) return

    const disclosure = {
      invoiceId: invoice.id,
      payer: undefined as any,
      recipient: invoice.recipientPubkey,
      amount: formatUsdc(invoice.amountCents),
      mint: invoice.mint,
      tx: txSignature,
      timestamp: new Date().toISOString(),
      compliance: { enabled: complianceMode, screening: undefined as any },
    }

    const enc = new TextEncoder()
    const data = enc.encode(JSON.stringify(disclosure))
    const digest = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(digest))
    const disclosureHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    const full = { ...disclosure, disclosureHash }
    const dataStr = JSON.stringify(full, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `receipt_${invoiceId}.json`
    link.click()
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-slate-700 rounded-lg p-8 max-w-md w-full text-center">
          <p className="text-white">Loading receipt...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-slate-700 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-2">
          {isMock ? 'Payment Simulated (Demo) 🧪' : confirmStatus === 'confirmed' ? 'Payment Received ✅' : 'Awaiting Confirmation ⏳'}
        </h1>
        <p className="text-slate-300 mb-6">
          {isMock
            ? 'This environment used a simulated tx (privacy SDK unavailable).'
            : confirmStatus === 'confirmed'
            ? 'Your transaction has been confirmed.'
            : 'We are confirming your transaction on-chain...'}
        </p>

        <div className="bg-slate-600 rounded p-4 mb-6 space-y-3">
          <div>
            <p className="text-slate-400 text-sm">Status</p>
            <p className="text-green-400 font-bold">
              {isMock ? 'Simulated' : confirmStatus === 'confirmed' ? 'Confirmed' : 'Pending'}
            </p>
          </div>
          
          {!disclosed && (
            <div>
              <p className="text-slate-400 text-sm">Privacy Status</p>
              <p className="text-blue-300 font-bold">🔒 Private Receipt</p>
            </div>
          )}
          
          {disclosed && (
            <>
              <div>
                <p className="text-slate-400 text-sm">Amount</p>
                <p className="text-white font-bold">{formatUsdc(invoice.amountCents)} USDC</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Invoice ID</p>
                <p className="text-xs text-slate-300 font-mono">{invoiceId}</p>
              </div>
            </>
          )}

          <div>
            <p className="text-slate-400 text-sm">Timestamp</p>
            <p className="text-xs text-slate-300">{new Date(invoice.createdAt).toLocaleString()}</p>
          </div>

          {txSignature && (
            <div>
              <p className="text-slate-400 text-sm">Transaction</p>
              <p className="text-xs text-slate-300 font-mono truncate">{txSignature}</p>
            </div>
          )}
          {!txSignature && (
            <div>
              <p className="text-slate-400 text-sm">Transaction</p>
              <p className="text-xs text-slate-300 font-mono">Not available</p>
            </div>
          )}
        </div>

        {confirmErr && (
          <div className="bg-red-900 border border-red-700 rounded p-3 mb-6 text-sm text-red-100">
            {confirmErr}
          </div>
        )}

        {complianceMode && (
          <div className="bg-purple-900 border border-purple-700 rounded p-3 mb-6 text-sm text-purple-100">
            <p className="font-bold mb-1">Compliance</p>
            {!screeningInfo ? (
              <p>Enabled (demo)</p>
            ) : screeningInfo.blocked ? (
              <p className="text-red-200">Blocked by screening</p>
            ) : (
              <p>Screening passed</p>
            )}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {!showDisclosure ? (
            <button
              onClick={handleGenerateDisclosure}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition"
            >
              Generate Disclosure Receipt
            </button>
          ) : (
            <button
              onClick={downloadDisclosureJSON}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition"
            >
              Download Receipt (JSON)
            </button>
          )}

          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded transition"
          >
            Create Another Invoice
          </button>
        </div>

        <div className="text-xs text-slate-400 pt-4 border-t border-slate-500">
          <p className="mb-2">
            <strong>Privacy by default.</strong> Your payment stays private unless you choose to disclose it.
          </p>
          <p>
            Disclosure receipts can be shared with verifiers or compliance partners.
          </p>
        </div>
      </div>
    </div>
  )
}
