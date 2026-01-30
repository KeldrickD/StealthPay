# StealthPay Relayer

Node/Express relayer for Privacy Cash SDK. Deploy to Railway/Fly/Render and call from the Vercel frontend.

## Environment Variables

- HELIUS_RPC_URL: Helius RPC endpoint (devnet)
- PRIVACY_PAYER_SECRET: Devnet private key (base58 or JSON)
- CORS_ORIGIN: Allowed origins (comma-separated), e.g. `https://stealth-pay-chi.vercel.app`
- RELAYER_TOKEN: Optional bearer token for simple auth

## Run locally

```
npm install
npm start
# GET http://localhost:8080/health
```

## API

POST /pay
```
{
  "recipientAddress": "<Solana pubkey>",
  "mintAddress": "<USDC mint>",
  "base_units": "<amount in base units>"
}
```

Response:
```
{ ok: true, signature: "..." }
```
