'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { QRCodeCanvas } from 'qrcode.react'

export default function CreateInvoice() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    amount: '',
    note: '',
    expiryHours: '24',
    recipientPubkey: '',
    compliance: false,
  })
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [qrValue, setQrValue] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  const handleCheckbox = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleCreateInvoice = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const id = uuidv4()
      const expiryTime = new Date(Date.now() + parseInt(formData.expiryHours) * 60 * 60 * 1000)
      const amountCents = Math.round(parseFloat(formData.amount || '0') * 100)
      const paymentLink = `${window.location.origin}/pay/${id}`

      // Store invoice data (in demo, just in memory/local)
      const invoiceData = {
        id,
        recipientPubkey: formData.recipientPubkey || '',
        amountCents,
        mint: 'USDC' as const,
        note: formData.note,
        createdAt: new Date().toISOString(),
        expiry: expiryTime.toISOString(),
        status: 'created',
        privacy: true,
        compliance: formData.compliance,
        requestUrl: paymentLink,
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))

      setQrValue(paymentLink)
      setInvoiceId(id)

      // Store in localStorage for demo
      localStorage.setItem(`invoice_${id}`, JSON.stringify(invoiceData))
    } catch (error) {
      console.error('Error creating invoice:', error)
    } finally {
      setLoading(false)
    }
  }

  if (invoiceId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-slate-700 rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-4">Payment Link Created ✅</h2>
          
          <div className="bg-white p-4 rounded-lg mb-6 text-center">
            {qrValue && <QRCodeCanvas value={qrValue} size={180} />}
            <p className="text-gray-600 text-sm mt-2">Scan to pay</p>
            <p className="text-gray-500 text-xs mt-2 break-all">{qrValue}</p>
          </div>

          <div className="text-white space-y-4 mb-6">
            <div>
              <p className="text-sm text-slate-300">Amount</p>
              <p className="text-xl font-bold">{formData.amount} USDC</p>
            </div>
            <div>
              <p className="text-sm text-slate-300">Invoice ID</p>
              <p className="text-xs font-mono text-slate-400 truncate">{invoiceId}</p>
            </div>
            {formData.recipientPubkey && (
              <div>
                <p className="text-sm text-slate-300">Recipient</p>
                <p className="text-xs font-mono text-slate-400 break-all">{formData.recipientPubkey}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-slate-300">Payment Link</p>
              <p className="text-xs font-mono text-slate-400 break-all">{qrValue}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(qrValue || '')
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Copy Link
            </button>
            <button
              onClick={() => {
                setInvoiceId(null)
                setQrValue(null)
                setFormData({ amount: '', note: '', expiryHours: '24', recipientPubkey: '', compliance: false })
              }}
              className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded"
            >
              New Invoice
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-slate-700 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-2">StealthPay</h1>
        <p className="text-slate-300 mb-6">Privacy by default. Proof by choice.</p>

        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div>
            <label className="block text-white text-sm font-bold mb-2">
              Amount (USDC)
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="100.00"
              step="0.01"
              required
              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-bold mb-2">
              Recipient (Solana address)
            </label>
            <input
              type="text"
              name="recipientPubkey"
              value={formData.recipientPubkey}
              onChange={handleChange}
              placeholder="Recipient public key"
              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-bold mb-2">
              Note (optional)
            </label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder="e.g., Payment for services"
              rows={3}
              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-bold mb-2">
              Expires in (hours)
            </label>
            <select
              name="expiryHours"
              value={formData.expiryHours}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
            >
              <option value="1">1 hour</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">1 week</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="compliance"
              name="compliance"
              type="checkbox"
              checked={formData.compliance}
              onChange={handleCheckbox}
              className="h-4 w-4"
            />
            <label htmlFor="compliance" className="text-slate-200 text-sm">
              Enable compliance screening (Range)
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.amount}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 text-white font-bold py-2 px-4 rounded transition"
          >
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
        </form>
      </div>
    </div>
  )
}
