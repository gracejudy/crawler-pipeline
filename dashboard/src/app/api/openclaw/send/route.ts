import { NextResponse } from "next/server";

function asRecord(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

function isUpstreamAccepted(upstreamOk: boolean, data: unknown) {
  if (!upstreamOk) return false;
  const d = asRecord(data);
  if (!d) return true;
  if (d.ok === false) return false;
  if (typeof d.error === "string" && d.error.trim()) return false;
  return true;
}

function extractError(data: unknown, fallback = "send failed") {
  const d = asRecord(data);
  if (!d) return fallback;
  if (typeof d.error === "string" && d.error.trim()) return d.error;
  if (typeof d.message === "string" && d.message.trim()) return d.message;
  return fallback;
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const base = process.env.OPENCLAW_BASE_URL?.trim();
    const token = process.env.OPENCLAW_API_TOKEN?.trim();
    const session = process.env.OPENCLAW_SESSION_ID?.trim();

    if (!base || !token || !session) {
      return NextResponse.json({ ok: false, accepted: false, error: "Missing OpenClaw config" }, { status: 400 });
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
    const accepted = isUpstreamAccepted(upstream.ok, data);
    const error = accepted ? null : extractError(data, `upstream ${upstream.status}`);

    return NextResponse.json(
      { ok: accepted, accepted, status: upstream.status, data, error },
      { status: accepted ? 200 : 502 },
    );
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "send failed";
    return NextResponse.json({ ok: false, accepted: false, error }, { status: 500 });
  }
}
