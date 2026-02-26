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

function normalizeBase(base: string) {
  return base.replace(/\/+$/, "");
}

function buildSendCandidates(base: string) {
  const b = normalizeBase(base);
  const hasApiSuffix = b.endsWith("/api");
  const candidates = hasApiSuffix
    ? [`${b}/sessions/send`, `${b}/v1/sessions/send`]
    : [`${b}/sessions/send`, `${b}/api/sessions/send`, `${b}/v1/sessions/send`];
  return [...new Set(candidates)];
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const base = process.env.OPENCLAW_BASE_URL?.trim();
    const token = process.env.OPENCLAW_API_TOKEN?.trim();
    const session = process.env.OPENCLAW_SESSION_ID?.trim();

    if (!base || !token || !session) {
      console.error("[openclaw/send] missing_config", {
        hasBase: Boolean(base),
        hasToken: Boolean(token),
        hasSession: Boolean(session),
      });
      return NextResponse.json({ ok: false, accepted: false, error: "Missing OpenClaw config" }, { status: 400 });
    }

    const endpoints = buildSendCandidates(base);
    let lastStatus = 0;
    let lastStatusText = "";
    let lastError = "upstream request failed";
    let lastData: unknown = {};
    let selectedEndpoint = endpoints[0];

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
      const error = accepted ? null : extractError(data, `upstream ${upstream.status}`);

      if (accepted) {
        return NextResponse.json(
          { ok: true, accepted: true, status: upstream.status, endpoint, data, error: null },
          { status: 200 },
        );
      }

      lastStatus = upstream.status;
      lastStatusText = upstream.statusText;
      lastError = error || `upstream ${upstream.status}`;
      lastData = data;

      console.error("[openclaw/send] upstream_error", {
        endpoint,
        status: upstream.status,
        statusText: upstream.statusText,
        error: lastError,
        bodySnippet: raw.slice(0, 800),
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
        endpoint: selectedEndpoint,
        data: lastData,
        error: lastError,
      },
      { status: 502 },
    );
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : "send failed";
    console.error("[openclaw/send] internal_error", { error });
    return NextResponse.json({ ok: false, accepted: false, error }, { status: 500 });
  }
}
