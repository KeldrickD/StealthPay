# StealthPay

Private USDC payments on Solana — with optional selective disclosure

“Privacy by default. Proof by choice.”

StealthPay enables cash-like private payments using USDC on Solana, while still allowing recipients to generate compliance-ready receipts only when required.

## Problem

Most crypto payments are:

* Fully public — sender, receiver, and amount are visible on-chain
* Permanently traceable — histories are immutable and linkable
* Misaligned with real-world privacy norms — cash does not expose counterparties

At the same time, businesses and institutions still need:

* Proof of payment — verifiable transaction evidence
* Compliance options — screening and auditability
* Selective disclosure — control over when details are revealed

## Solution

StealthPay delivers:

✅ Privacy by default — Payments are sent privately using Solana privacy rails
✅ Disclosure by choice — Recipients opt-in to reveal details when needed
✅ Compliance without surveillance — Screening and proof are generated only on demand

## How It Works

### 1. Create Payment Request

* Recipient creates an invoice (amount, note, expiry)
* A payment link + QR code is generated
* Link can be shared via text, email, or messaging apps

### 2. Sender Pays Privately

* Sender opens the link and connects a wallet
* Payment is sent privately (amount hidden on-chain)
* Uses the Privacy Cash SDK for private USDC transfers

### 3. Confirmation

* Transaction is confirmed using Helius RPC
* Receipt page shows status, timestamp, and privacy state
* On-chain observers cannot see the amount

### 4. Optional Selective Disclosure

* Recipient can click “Generate Disclosure Receipt”
* Receipt reveals: amount, parties, timestamp, tx signature
* Disclosure includes a deterministic hash for verification
* Default state remains private

## Features (Hackathon MVP)

* [x] Invoice creation with QR code
* [x] Private payment flow
* [x] Wallet-based UX
* [x] Receipt with Helius confirmation
* [x] Selective disclosure JSON + hash
* [x] Compliance screening (Range API)
* [ ] On-chain invoice registry (future)
* [ ] Mobile PWA (future)

## Demo Mode vs Production Mode

Demo Mode (Hackathon):

* Uses a server-side relayer wallet to execute private transfers
* Simplifies testing and avoids wallet setup friction
* No private keys are exposed to the client

Production Mode:

* Users sign deposit/withdraw directly from their own wallets
* Relayer is optional (broadcast/proving only)
* Architecture already supports this swap

## Technology Stack

| Layer      | Tech                        |
| ---------- | --------------------------- |
| Frontend   | Next.js 14 + Tailwind CSS   |
| Wallet     | Solana Wallet Adapter       |
| Payments   | Privacy Cash SDK            |
| RPC        | Helius                      |
| Compliance | Range (sanctions/blacklist) |
| Storage    | localStorage (demo)         |
| Chain      | Solana Devnet               |

## Getting Started

### Prerequisites

* Node.js 22+ (SDK recommends 24+)
* npm or pnpm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Visit http://localhost:3000

## Usage Flow

1. Create Invoice — amount, recipient, optional compliance
2. Share Link / QR — send to payer
3. Pay Privately — wallet connects, amount hidden
4. Confirm Receipt — Helius confirms transaction
5. Optional Disclosure — generate compliance receipt if needed

## Architecture

### Frontend (Next.js App Router)

```
/app
  /page.tsx               → Create invoice
  /pay/[id]/page.tsx      → Private payment
  /receipt/[id]/page.tsx  → Confirmation & disclosure
```

### Backend (API Routes)

```
/api
  /privacy/pay      → Privacy Cash deposit + withdraw
  /screening        → Range sanctions/blacklist check
```

### Storage (Demo)

* Invoice metadata: localStorage
* Disclosure receipts: JSON (hashable, exportable)

## Integration Notes

### Privacy Cash

* Provides private SPL transfers
* Hides amounts from the public ledger
* Deposit → withdraw flow breaks linkability

### Helius

* getTransaction used for confirmations
* Supports sponsor prize eligibility

### Range

* Optional compliance screening per invoice
* Results embedded in disclosure receipts
* Enables compliant privacy workflows

## Prize Alignment

✅ Private Payments Track
✅ Privacy Cash Sponsor Prize
✅ Range Compliant Privacy Prize
✅ Helius Sponsor Prize

## What’s Next

* Mobile PWA + NFC payments
* Verifier dashboard for disclosed receipts
* PDF receipt export
* On-chain invoice registry (Anchor)
* Privacy Cash Rebalancer integration

## License

MIT
