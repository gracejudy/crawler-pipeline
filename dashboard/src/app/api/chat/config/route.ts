import { NextResponse } from "next/server";

export async function GET() {
  const base = (process.env.OPENCLAW_BASE_URL || "").trim();
  const session = (process.env.OPENCLAW_SESSION_ID || "").trim();
  const hasToken = Boolean(process.env.OPENCLAW_API_TOKEN);

  const deploy = {
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || null,
    appVersion: process.env.npm_package_version || null,
  };

  return NextResponse.json({ ok: true, base, session, hasToken, deploy });
}
