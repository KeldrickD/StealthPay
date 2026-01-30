import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    const token = process.env.RANGE_API_KEY;

    if (!token) return NextResponse.json({ error: "Missing RANGE_API_KEY" }, { status: 500 });
    if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

    const r = await fetch(`https://api.range.org/v1/risk/sanctions/${address}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return NextResponse.json({ error: `Range error ${r.status}`, detail: text }, { status: 500 });
    }

    const data = await r.json();
    const blocked = Boolean(data.is_token_blacklisted || data.is_ofac_sanctioned);

    return NextResponse.json({
      blocked,
      checked_at: data.checked_at,
      is_token_blacklisted: data.is_token_blacklisted,
      is_ofac_sanctioned: data.is_ofac_sanctioned,
      attribution: data.attribution,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
