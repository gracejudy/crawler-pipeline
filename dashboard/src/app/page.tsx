"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "overview" | "registration" | "tasks" | "logs" | "chat";
type LogLevel = "INFO" | "ERROR";

const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "registration", label: "Qoo10" },
  { key: "tasks", label: "Tasks" },
  { key: "logs", label: "Logs" },
  { key: "chat", label: "Chat" },
];

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

const statusClass: Record<TaskStatus, string> = {
  TODO: "bg-slate-500/30 text-slate-200",
  IN_PROGRESS: "bg-cyan-500/30 text-cyan-200",
  DONE: "bg-emerald-500/30 text-emerald-200",
  BLOCKED: "bg-rose-500/30 text-rose-200",
};

const projectOverview = [
  {
    name: "crawler-pipeline (CORE)",
    purpose: "Qoo10 상품 API 등록/업데이트 도메인 처리",
    contextPath: "/Users/judy/dev/crawler-pipeline/docs/PROJECT_CONTEXT.md",
    openUrl: "https://github.com/gracejudy/crawler-pipeline/blob/oc/roughdiamond-dashboard/docs/PROJECT_CONTEXT.md",
    tasks: [
      {
        title: "Import 경로 정리 범위 확정",
        description: "backend→src 전환 이후 import 경로를 어떤 단위로 정리할지 결정",
        status: "IN_PROGRESS" as TaskStatus,
      },
      {
        title: "start 스크립트 src 기본 전환 검증",
        description: "start:legacy fallback 유지 상태에서 src 기본 전환 안정성 점검",
        status: "TODO" as TaskStatus,
      },
      {
        title: "Qoo10 등록/업데이트 E2E 확인",
        description: "실데이터 기준 등록/업데이트 API 플로우 재검증 및 로그 점검",
        status: "TODO" as TaskStatus,
      },
    ],
  },
  {
    name: "roughdiamond-dashboard (DASHBOARD)",
    purpose: "진행 중 프로젝트 Tasks/Logs/Chat 운영 뷰",
    contextPath: "/Users/judy/dev/crawler-pipeline/dashboard/docs/PROJECT_CONTEXT.md",
    openUrl: "https://github.com/gracejudy/crawler-pipeline/blob/oc/roughdiamond-dashboard/dashboard/docs/PROJECT_CONTEXT.md",
    tasks: [
      {
        title: "Project Overview 개선",
        description: "프로젝트별 task 리스트를 접기/펴기 UI로 제공",
        status: "IN_PROGRESS" as TaskStatus,
      },
      {
        title: "OpenClaw Chat 왕복 E2E 캡처",
        description: "전송→응답 성공 판정/오류 노출 흐름을 캡처해 검증",
        status: "TODO" as TaskStatus,
      },
      {
        title: "상태/로그 가독성 개선",
        description: "모바일 기준 배지/로그 밀도 조정 및 에러 표현 정리",
        status: "TODO" as TaskStatus,
      },
    ],
  },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("registration");
  const [summary, setSummary] = useState<any>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [prompt, setPrompt] = useState("");
  const [chatConfig, setChatConfig] = useState<any>(null);
  const [chatHealth, setChatHealth] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ ts: string; level: LogLevel; event: string; detail?: string }[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const addLog = (level: LogLevel, event: string, detail?: string) => {
    setLogs((prev) => [
      { ts: new Date().toLocaleTimeString(), level, event, detail },
      ...prev,
    ]);
  };

  const loadSummary = async () => {
    const r = await fetch("/api/sheets/summary", { cache: "no-store" });
    const d = await r.json();
    setSummary(d);
  };

  const loadHistory = async () => {
    const r = await fetch("/api/openclaw/history", { cache: "no-store" });
    const d = await r.json();
    setHistory(d.messages || []);
  };

  const runHealth = async () => {
    const r = await fetch("/api/openclaw/health", { cache: "no-store" });
    const d = await r.json();
    setChatHealth(d);
    addLog(d.ok ? "INFO" : "ERROR", "chat.health", JSON.stringify(d));
  };

  useEffect(() => {
    loadSummary();
    fetch("/api/chat/config").then((r) => r.json()).then(setChatConfig).catch(() => null);
  }, []);

  useEffect(() => {
    if (tab !== "chat") return;
    loadHistory();
    const t = setInterval(loadHistory, 3000);
    return () => clearInterval(t);
  }, [tab]);

  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/registration/status?jobId=${jobId}`, { cache: "no-store" });
      const d = await r.json();
      setJob(d);

      if (d?.status === "done") {
        addLog("INFO", "qoo10.job.end", "done");
        clearInterval(t);
      }
      if (d?.status === "error") {
        addLog("ERROR", "qoo10.job.end", "error");
        clearInterval(t);
      }
    }, 1800);
    return () => clearInterval(t);
  }, [jobId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const runRegistration = async () => {
    if (job?.status === "running") return;
    addLog("INFO", "qoo10.job.start");
    const r = await fetch("/api/registration/run", { method: "POST" });
    const d = await r.json();
    setJobId(d.jobId);
    setJob({ status: "running" });
  };

  const sendPrompt = async (text?: string) => {
    console.log("SEND_TRIGGERED");
    const message = (text ?? prompt).trim();
    if (!message || isSending) return;

    addLog("INFO", "chat.send.attempt", message.slice(0, 80));
    setIsSending(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const r = await fetch("/api/openclaw/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      const d = await r.json();
      if (!r.ok || !d?.accepted) throw new Error(d?.error || d?.data?.error || "send failed");

      setPrompt("");
      addLog("INFO", "chat.send.success", `status=${d?.status ?? "?"}`);
      setTimeout(loadHistory, 500);
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Chat send timeout (>10s)" : `Chat send failed: ${e.message}`;
      setToast(msg);
      addLog("ERROR", "chat.send.error", msg);
      setTimeout(() => setToast(null), 3500);
    } finally {
      clearTimeout(timeout);
      setIsSending(false);
    }
  };

  const parsedProposal = useMemo(() => {
    const last = history[history.length - 1]?.text || "";
    const m = last.match(/```json\n([\s\S]*?)\n```/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }, [history]);

  const confirmProposal = async (confirm: boolean) => {
    await sendPrompt(confirm ? `CONFIRM:\n${JSON.stringify(parsedProposal)}` : "CANCEL proposal");
  };

  const statusBadge = job?.status === "running" ? "RUNNING" : job?.status === "error" ? "ERROR" : "IDLE";

  return (
    <main className="safe-wrap pb-[calc(86px+env(safe-area-inset-bottom))] pt-4 overflow-x-hidden">
      {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-rose-500 text-white text-sm px-3 py-2 rounded-xl">{toast}</div>}

      <header className="glass rounded-2xl p-4 mb-4">
        <h1 className="text-xl font-semibold">💎 RoughDiamond Dashboard</h1>
        <p className="text-sm text-slate-300">Coupang → Qoo10 Control Room</p>
      </header>

      <section className="glass rounded-2xl p-4 min-h-[60vh]">
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Card title="Total Rows" value={String(summary?.rowCount ?? "-")} />
              <Card title="Registered" value={String(summary?.registeredCount ?? "-")} />
              <Card title="Needs Update" value={String(summary?.needsUpdateCount ?? "-")} />
              <Card title="Last Sync" value={summary?.lastSyncTime || "-"} />
            </div>

            <div className="glass rounded-xl p-3">
              <div className="text-sm font-semibold mb-2">Project Overview</div>
              <div className="space-y-2">
                {projectOverview.map((p) => (
                  <div key={p.name} className="rounded-lg bg-white/5 p-3 text-xs">
                    <div className="font-semibold text-cyan-300">{p.name}</div>
                    <div className="text-slate-200 mt-1">{p.purpose}</div>
                    <div className="text-slate-400 mt-1 break-all">{p.contextPath}</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(p.contextPath);
                            addLog("INFO", "overview.path.copied", p.contextPath);
                          } catch {
                            addLog("ERROR", "overview.path.copy_failed", p.contextPath);
                          }
                        }}
                        className="px-2 py-1 rounded bg-white/10 text-[11px]"
                      >
                        Copy Path
                      </button>
                      <button
                        onClick={() => {
                          const w = window.open(p.openUrl, "_blank", "noopener,noreferrer");
                          if (!w) addLog("ERROR", "overview.path.open_failed", p.openUrl);
                        }}
                        className="px-2 py-1 rounded bg-white/10 text-[11px]"
                      >
                        Open
                      </button>
                    </div>

                    <details className="mt-3 rounded-md bg-black/20 p-2" open>
                      <summary className="cursor-pointer text-slate-200 font-semibold">Tasks ({p.tasks.length})</summary>
                      <div className="mt-2 space-y-2">
                        {p.tasks.map((task, idx) => (
                          <div key={`${p.name}-${idx}`} className="rounded-md bg-white/5 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold text-slate-100">{task.title}</div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusClass[task.status]}`}>
                                {task.status}
                              </span>
                            </div>
                            <div className="mt-1 text-slate-300">{task.description}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "registration" && (
          <div className="space-y-3">
            <div className="text-xs inline-flex px-2 py-1 rounded-lg bg-white/10">Status: {statusBadge}</div>
            <button
              onClick={runRegistration}
              disabled={job?.status === "running"}
              className="px-4 py-3 rounded-xl bg-cyan-500 text-black font-semibold w-full disabled:opacity-40"
            >
              {job?.status === "running" ? "Running..." : "Run Registration"}
            </button>
            <div className="text-sm">Job: {jobId || "-"}</div>
            <pre className="text-xs overflow-auto max-h-72">{JSON.stringify(job || { status: "idle" }, null, 2)}</pre>
          </div>
        )}

        {tab === "tasks" && <div className="text-sm">- Start registration{"\n"}- Review logs{"\n"}- Confirm next action from Chat</div>}

        {tab === "logs" && (
          <div className="space-y-2">
            {logs.map((l, i) => (
              <div key={i} className="text-xs p-2 rounded bg-white/5">
                <b className={l.level === "ERROR" ? "text-rose-300" : "text-cyan-300"}>{l.level}</b> [{l.ts}] {l.event}
                {l.detail ? <div className="text-slate-300 mt-1 break-all">{l.detail}</div> : null}
              </div>
            ))}
            {!logs.length && <div className="text-sm text-slate-300">No events yet</div>}
          </div>
        )}

        {tab === "chat" && (
          <div className="flex flex-col gap-3 h-[65vh] max-h-[65vh]">
            <div className="glass rounded-xl p-2 text-xs">
              <div>OpenClaw Base: {chatConfig?.base || "(unset)"}</div>
              <div>Session: {chatConfig?.session || "(unset)"}</div>
              <div>Token: {chatConfig?.hasToken ? "configured" : "missing"}</div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={runHealth} className="text-xs px-3 py-1 rounded-lg bg-white/10">Health Check</button>
                <span>{chatHealth ? `${chatHealth.ok ? "OK" : "FAIL"} ${chatHealth.latencyMs}ms` : "-"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {["Build Dashboard Task 0", "Run Registration", "Summarize Errors"].map((t) => (
                <button key={t} onClick={() => sendPrompt(t)} className="text-xs px-3 py-2 rounded-xl bg-white/10">{t}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-xl bg-black/20 p-3">
              {history.map((m, i) => (
                <div key={i} className="mb-2 text-sm">
                  <b className="text-cyan-300">{m.role || "msg"}</b>
                  <div className="whitespace-pre-wrap break-words">{m.text || ""}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {parsedProposal && (
              <div className="glass rounded-xl p-3">
                <div className="text-xs mb-2">Proposed Action</div>
                <pre className="text-xs overflow-auto max-h-32">{JSON.stringify(parsedProposal, null, 2)}</pre>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => confirmProposal(true)} className="flex-1 py-2 rounded bg-emerald-400 text-black font-semibold">Confirm</button>
                  <button onClick={() => confirmProposal(false)} className="flex-1 py-2 rounded bg-rose-400 text-black font-semibold">Cancel</button>
                </div>
              </div>
            )}

            <div className="flex gap-2 sticky bottom-0 pb-[env(safe-area-inset-bottom)]">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Prompt to current OpenClaw session"
                className="flex-1 rounded-xl px-3 py-3 bg-white/10 outline-none"
              />
              <button
                onClick={() => sendPrompt()}
                disabled={isSending}
                className="px-4 rounded-xl bg-cyan-400 text-black font-bold disabled:opacity-40"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        )}
      </section>

      <nav className="fixed left-0 right-0 bottom-0 p-2 z-40 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="safe-wrap glass rounded-2xl p-2 grid grid-cols-5 gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs py-2 rounded-xl ${tab === t.key ? "bg-cyan-400 text-black font-semibold" : "bg-white/10"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3 min-h-[86px]">
      <div className="text-xs text-slate-300">{title}</div>
      <div className="text-lg font-semibold mt-2 break-words">{value}</div>
    </div>
  );
}
