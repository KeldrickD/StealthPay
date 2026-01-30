import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'StealthPay',
  description: 'Private USDC payments on Solana with optional selective disclosure',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <Providers>
          <div className="container mx-auto px-4">{children}</div>
        </Providers>
      </body>
    </html>
  )
}
