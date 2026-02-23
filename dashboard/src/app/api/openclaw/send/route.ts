import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const base = process.env.OPENCLAW_BASE_URL?.trim();
    const token = process.env.OPENCLAW_API_TOKEN?.trim();
    const session = process.env.OPENCLAW_SESSION_ID?.trim();

    if (!base || !token || !session) {
      return NextResponse.json({ ok: false, error: "Missing OpenClaw config" }, { status: 400 });
    }

    const upstream = await fetch(`${base}/sessions/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionKey: session, message }),
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json({ ok: upstream.ok, data }, { status: upstream.ok ? 200 : 502 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "send failed" }, { status: 500 });
  }
}
