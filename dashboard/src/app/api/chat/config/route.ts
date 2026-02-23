import { NextResponse } from "next/server";

export async function GET() {
  const base = (process.env.OPENCLAW_BASE_URL || "").trim();
  const session = (process.env.OPENCLAW_SESSION_ID || "").trim();
  const hasToken = Boolean(process.env.OPENCLAW_API_TOKEN);
  return NextResponse.json({ ok: true, base, session, hasToken });
}
