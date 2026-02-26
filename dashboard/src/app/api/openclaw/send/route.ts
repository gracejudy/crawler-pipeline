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

function parseMaybeJson(raw: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function stripTrailingSlash(s: string) {
  return s.replace(/\/+$/, "");
}

function deriveBaseCandidates(base: string) {
  const raw = stripTrailingSlash(base.trim());
  const cands = new Set<string>();
  cands.add(raw);

  // 흔한 오입력 보정: .../sessions 또는 .../sessions/send 를 base로 넣은 경우
  if (raw.endsWith("/sessions/send")) cands.add(raw.replace(/\/sessions\/send$/, ""));
  if (raw.endsWith("/sessions")) cands.add(raw.replace(/\/sessions$/, ""));

  // URL 형태면 pathname도 분석해서 루트 후보를 추가
  try {
    const u = new URL(raw);
    const p = stripTrailingSlash(u.pathname);
    const origin = `${u.protocol}//${u.host}`;
    cands.add(origin + p);
    if (p.endsWith("/sessions/send")) cands.add(origin + p.replace(/\/sessions\/send$/, ""));
    if (p.endsWith("/sessions")) cands.add(origin + p.replace(/\/sessions$/, ""));
  } catch {
    // raw가 URL이 아니면 무시
  }

  return [...cands].map(stripTrailingSlash).filter(Boolean);
}

function buildSendCandidates(base: string) {
  const roots = deriveBaseCandidates(base);
  const endpoints: string[] = [];

  for (const r of roots) {
    const hasApiSuffix = r.endsWith("/api");
    if (hasApiSuffix) {
      endpoints.push(`${r}/sessions/send`);
      endpoints.push(`${r}/v1/sessions/send`);
    } else {
      endpoints.push(`${r}/sessions/send`);
      endpoints.push(`${r}/api/sessions/send`);
      endpoints.push(`${r}/v1/sessions/send`);
    }
  }

  return [...new Set(endpoints.map(stripTrailingSlash))];
}

function getDeployMeta() {
  return {
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || null,
    appVersion: process.env.npm_package_version || null,
  };
}

export async function POST(req: Request) {
  const requestId = `send-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const deploy = getDeployMeta();

  try {
    const { message } = await req.json();
    const base = process.env.OPENCLAW_BASE_URL?.trim();
    const token = process.env.OPENCLAW_API_TOKEN?.trim();
    const session = process.env.OPENCLAW_SESSION_ID?.trim();

    if (!base || !token || !session) {
      console.error("[openclaw/send] missing_config", {
        requestId,
        deploy,
        hasBase: Boolean(base),
        hasToken: Boolean(token),
        hasSession: Boolean(session),
      });
      return NextResponse.json({ ok: false, accepted: false, error: "Missing OpenClaw config", requestId, deploy }, { status: 400 });
    }

    const endpoints = buildSendCandidates(base);
    const attempts: Array<{ endpoint: string; status: number; statusText: string; error: string; bodySnippet: string }> = [];

    let lastStatus = 0;
    let lastStatusText = "";
    let lastError = "upstream request failed";
    let lastData: unknown = {};
    let selectedEndpoint = endpoints[0] || `${base}/sessions/send`;

    for (const endpoint of endpoints) {
      selectedEndpoint = endpoint;
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionKey: session, message }),
      });

      const raw = await upstream.text();
      const data = parseMaybeJson(raw);
      const accepted = isUpstreamAccepted(upstream.ok, data);
      const error = accepted ? "" : extractError(data, `upstream ${upstream.status}`);

      if (accepted) {
        return NextResponse.json(
          { ok: true, accepted: true, status: upstream.status, endpoint, data, error: null, attempts, requestId, deploy },
          { status: 200 },
        );
      }

      lastStatus = upstream.status;
      lastStatusText = upstream.statusText;
      lastError = error || `upstream ${upstream.status}`;
      lastData = data;

      const bodySnippet = raw.slice(0, 800);
      attempts.push({ endpoint, status: upstream.status, statusText: upstream.statusText, error: lastError, bodySnippet });

      console.error("[openclaw/send] upstream_error", {
        requestId,
        deploy,
        endpoint,
        status: upstream.status,
        statusText: upstream.statusText,
        error: lastError,
        bodySnippet,
      });

      // 404/405는 경로 미스 가능성이 높아서 다음 후보를 시도한다.
      if (upstream.status !== 404 && upstream.status !== 405) {
        break;
      }
    }

    return NextResponse.json(
      {
        ok: false,
        accepted: false,
        status: lastStatus || 502,
        statusText: lastStatusText,
        endpoint: selectedEndpoint,
        data: lastData,
        error: lastError,
        attempts,
        requestId,
        deploy,
      },
      { status: 502 },
    );
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "send failed";
    console.error("[openclaw/send] internal_error", { requestId, deploy, error });
    return NextResponse.json({ ok: false, accepted: false, error, requestId, deploy }, { status: 500 });
  }
}
