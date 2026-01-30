export async function heliusGetTransaction(signature: string) {
  const url = process.env.NEXT_PUBLIC_HELIUS_RPC_URL!;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "stealthpay",
      method: "getTransaction",
      params: [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
    }),
  });

  if (!res.ok) throw new Error(`Helius getTransaction failed: ${res.status}`);
  const json = await res.json();
  return json.result as any; // null until confirmed
}
