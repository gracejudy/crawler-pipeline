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

type ProjectTask = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  deployedOnce?: boolean;
};

type ProjectIssueStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

type ProjectIssue = {
  id: string;
  title: string;
  description: string;
  status: ProjectIssueStatus;
  deployedOnce?: boolean;
};

type ProjectItem = {
  name: string;
  purpose: string;
  contextPath: string;
  openUrl: string;
  tasks: ProjectTask[];
  issues?: ProjectIssue[];
};

const statusClass: Record<TaskStatus, string> = {
  TODO: "bg-slate-500/30 text-slate-200",
  IN_PROGRESS: "bg-cyan-500/30 text-cyan-200",
  DONE: "bg-emerald-500/30 text-emerald-200",
  BLOCKED: "bg-rose-500/30 text-rose-200",
};

const CONTROL_STASH_IDS = new Set(["DASH-T06", "DASH-T09", "DASH-T10", "DASH-I02", "DASH-I05"]);

function formatSeoulDateTime(raw?: string | null) {
  if (!raw) return "-";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);

  const v = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const dayPeriod = v("dayPeriod") || "";
  const year = v("year");
  const month = v("month");
  const day = v("day");
  const hour = v("hour");
  const minute = v("minute");

  return `${year}-${month}-${day} ${dayPeriod} ${hour}:${minute}`.trim();
}

const effectiveTaskStatus = (task: ProjectTask): TaskStatus => {
  if (task.status === "DONE") return "DONE";
  if (task.deployedOnce) return "IN_PROGRESS";
  return task.status;
};

const effectiveIssueStatus = (issue: ProjectIssue): TaskStatus => {
  if (issue.status === "DONE") return "DONE";
  if (issue.deployedOnce) return "IN_PROGRESS";
  return issue.status as TaskStatus;
};

const initialProjectOverview: ProjectItem[] = [
  {
    name: "crawler-pipeline (CORE)",
    purpose: "Qoo10 상품 API 등록/업데이트 도메인 처리",
    contextPath: "/Users/judy/dev/crawler-pipeline/docs/PROJECT_CONTEXT.md",
    openUrl: "https://github.com/gracejudy/crawler-pipeline/blob/oc/roughdiamond-dashboard/docs/PROJECT_CONTEXT.md",
    tasks: [
      {
        id: "CORE-T01",
        title: "Import 경로 정리 범위 확정",
        description: "backend→src 전환 이후 import 경로를 어떤 단위로 정리할지 결정",
        status: "IN_PROGRESS" as TaskStatus,
      },
      {
        id: "CORE-T02",
        title: "start 스크립트 src 기본 전환 검증",
        description: "start:legacy fallback 유지 상태에서 src 기본 전환 안정성 점검",
        status: "TODO" as TaskStatus,
      },
      {
        id: "CORE-T03",
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
        id: "DASH-T01",
        title: "Project Overview 개선",
        description: "프로젝트별 task 리스트를 접기/펴기 UI로 제공",
        status: "DONE" as TaskStatus,
      },
      {
        id: "DASH-T02",
        title: "OpenClaw Chat 왕복 E2E 캡처",
        description: "전송→응답 성공 판정/오류 노출 흐름을 캡처해 검증",
        status: "TODO" as TaskStatus,
        deployedOnce: true,
      },
      {
        id: "DASH-T03",
        title: "상태/로그 가독성 개선",
        description: "모바일 기준 배지/로그 밀도 조정 및 에러 표현 정리",
        status: "TODO" as TaskStatus,
        deployedOnce: true,
      },
      {
        id: "DASH-T04",
        title: "Issues 섹션(tasks와 분리) 추가",
        description: "프로젝트별 이슈를 task와 별도로 등록/표시하는 섹션 추가",
        status: "DONE" as TaskStatus,
        deployedOnce: true,
      },
      {
        id: "DASH-T05",
        title: "타이틀 ID 체계 적용",
        description: "모든 task/issue에 고유 ID를 부여하고 ID + title 형식으로 표시",
        status: "DONE" as TaskStatus,
      },
      {
        id: "DASH-T06",
        title: "issues 섹션에 실행버튼 추가",
        description: "issues 항목에도 task와 유사한 실행 제어 버튼을 추가",
        status: "TODO" as TaskStatus,
      },
      {
        id: "DASH-T07",
        title: "task / issue 우선순위 타입 + 정렬 규칙 적용",
        description: "우선순위 높은 항목 상단, 우선순위 동일 시 등록일(오래된 순) 우선 정렬",
        status: "TODO" as TaskStatus,
      },
      {
        id: "DASH-T08",
        title: "완료된 작업 별도 리스트 분리(기본 접힘)",
        description: "완료된 작업은 tasks 리스트와 분리하여 별도 섹션으로 표시하고 기본은 접힌 상태로 관리",
        status: "TODO" as TaskStatus,
      },
      {
        id: "DASH-T09",
        title: "OpenClaw 연결 URL 영구 named tunnel 고정",
        description: "quick tunnel 대신 영구 Cloudflare named tunnel로 OPENCLAW_BASE_URL을 고정해 실행 안정성 확보",
        status: "TODO" as TaskStatus,
      },
      {
        id: "DASH-T10",
        title: "1차 목표에서 제어 기능 제외 기준 확정",
        description: "대시보드 1차 목표를 관측 중심으로 확정하고 제어 기능은 2차 고도화로 분리",
        status: "DONE" as TaskStatus,
      },
      {
        id: "DASH-T11",
        title: "task/issue 실행·중단 버튼 제거(롤백 포함)",
        description: "제어 기능 제거 방향에 맞춰 실행/중단 버튼 제거 및 되돌릴 수 있는 롤백 작업 항목 포함",
        status: "DONE" as TaskStatus,
      },
      {
        id: "DASH-T12",
        title: "task에 stash 섹션 추가 + 제어 관련 항목 이동",
        description: "제어 기능 관련 task/issue를 stash 섹션으로 이동해 2차 고도화 참조용으로 보존",
        status: "DONE" as TaskStatus,
      },
    ],
    issues: [
      {
        id: "DASH-I01",
        title: "최신 빌드 커밋번호 + Vercel 배포번호 표현",
        description: "대시보드에 최신 빌드의 git commit과 Vercel deployment 식별자를 표시",
        status: "TODO",
        deployedOnce: true,
      },
      {
        id: "DASH-I02",
        title: "Task 실행 버튼 오류 해결 및 정상동작",
        description: "task 실행 버튼 클릭 시 발생하는 에러를 해결하고 정상 동작 보장",
        status: "TODO",
        deployedOnce: true,
      },
      {
        id: "DASH-I03",
        title: "클라이언트 에러 서버 로그화",
        description: "클라이언트에서 발생하는 모든 에러를 서버에서 수집/로그화하여 사용자 수동 전달 의존 제거",
        status: "TODO",
        deployedOnce: true,
      },
      {
        id: "DASH-I04",
        title: "Logs 탭 사용성 복구",
        description: "현재 Logs 탭이 테스트/운영에서 충분히 활용되지 못하는 상태를 개선",
        status: "TODO",
      },
      {
        id: "DASH-I05",
        title: "1차 목표에서 제어 기능 제외 후속 정리",
        description: "기존 제어 기능 요구사항/잔여 구현을 2차 고도화로 이관하고 문서·화면 반영 누락 방지",
        status: "TODO",
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
  const [projectOverview, setProjectOverview] = useState(initialProjectOverview);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const apiUrl = (path: string) => {
    if (typeof window === "undefined") return path;
    // Basic Auth userinfo가 현재 URL에 포함되어 있어도 안전한 origin 기준으로 재구성
    return new URL(path, window.location.origin).toString();
  };

  const addLog = (level: LogLevel, event: string, detail?: string) => {
    // 요청사항: warning/info 제외, error만 기록
    if (level !== "ERROR") return;
    setLogs((prev) => [
      { ts: new Date().toLocaleTimeString(), level, event, detail },
      ...prev,
    ]);
  };

  const patchProjectTask = (projectName: string, taskId: string, patch: Partial<ProjectTask>) => {
    setProjectOverview((prev) =>
      prev.map((project) => {
        if (project.name !== projectName) return project;
        return {
          ...project,
          tasks: project.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
        };
      }),
    );
  };

  const updateProjectTaskStatus = (projectName: string, task: ProjectTask, status: TaskStatus) => {
    patchProjectTask(projectName, task.id, { status });
    addLog("INFO", "overview.task.status_changed", `${projectName} | ${task.id} ${task.title} -> ${status}`);
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
      const r = await fetch(apiUrl("/api/openclaw/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      const d = await r.json();
      if (!r.ok || !d?.accepted) {
        const rid = d?.requestId ? ` (requestId: ${d.requestId})` : "";
        throw new Error(`${d?.error || d?.data?.error || "send failed"}${rid}`);
      }

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
        <p className="text-[11px] text-slate-400 mt-1 break-all">
          Deploy: {chatConfig?.deploy?.vercelEnv || "local"} | {chatConfig?.deploy?.gitBranch || "-"} | {(chatConfig?.deploy?.gitCommit || "-").slice(0, 8)} | dep:{(chatConfig?.deploy?.deploymentId || "-").slice(0, 12)}
        </p>
      </header>

      <section className="glass rounded-2xl p-4 min-h-[60vh]">
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Card title="Total Rows" value={String(summary?.rowCount ?? "-")} />
              <Card title="Registered" value={String(summary?.registeredCount ?? "-")} />
              <Card title="Needs Update" value={String(summary?.needsUpdateCount ?? "-")} />
              <Card title="Last Sync" value={formatSeoulDateTime(summary?.lastSyncTime)} />
            </div>

            <div className="glass rounded-xl p-3">
              <div className="text-sm font-semibold mb-2">Project Overview</div>
              <div className="space-y-2">
                {projectOverview.map((p) => {
                  const visibleTasks = p.tasks.filter((task) => !CONTROL_STASH_IDS.has(task.id));
                  const stashTasks = p.tasks.filter((task) => CONTROL_STASH_IDS.has(task.id));
                  const visibleIssues = (p.issues || []).filter((issue) => !CONTROL_STASH_IDS.has(issue.id));
                  const stashIssues = (p.issues || []).filter((issue) => CONTROL_STASH_IDS.has(issue.id));

                  return (
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
                      <summary className="cursor-pointer text-slate-200 font-semibold">Tasks ({visibleTasks.length})</summary>
                      <div className="mt-2 space-y-2">
                        {visibleTasks.map((task, idx) => (
                          <div key={`${p.name}-${idx}`} className="rounded-md bg-white/5 p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold text-slate-100">[{task.id}] {task.title}</div>
                            </div>
                            <div className="mt-1 text-slate-300">{task.description}</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as TaskStatus[]).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => updateProjectTaskStatus(p.name, task, s)}
                                  className={`px-2 py-0.5 rounded text-[10px] border ${effectiveTaskStatus(task) === s ? "bg-cyan-500/40 text-cyan-100 border-cyan-300/50" : "bg-white/5 text-slate-300 border-white/10"}`}
                                >
                                  TAG:{s}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>

                    {visibleIssues.length ? (
                      <details className="mt-2 rounded-md bg-black/20 p-2" open>
                        <summary className="cursor-pointer text-slate-200 font-semibold">Issues (tasks와 분리) ({visibleIssues.length})</summary>
                        <div className="mt-2 space-y-2">
                          {visibleIssues.map((issue, i) => (
                            <div key={`${p.name}-issue-${i}`} className="rounded-md bg-white/5 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-slate-100">[{issue.id}] {issue.title}</div>
                                <span className={`px-2 py-0.5 rounded text-[10px] ${statusClass[effectiveIssueStatus(issue)]}`}>{effectiveIssueStatus(issue)}</span>
                              </div>
                              <div className="mt-1 text-slate-300">{issue.description}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}

                    {stashTasks.length || stashIssues.length ? (
                      <details className="mt-2 rounded-md bg-amber-950/30 p-2" open>
                        <summary className="cursor-pointer text-amber-200 font-semibold">Stash (2차 고도화 이관)</summary>
                        <div className="mt-2 space-y-2">
                          {stashTasks.map((task, i) => (
                            <div key={`${p.name}-stash-task-${i}`} className="rounded-md bg-white/5 p-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-slate-100">[{task.id}] {task.title}</div>
                                <span className="px-2 py-1 rounded text-[11px] bg-white/10 text-slate-300">제어 기능은 2차 고도화(stash)</span>
                              </div>
                              <div className="mt-1 text-slate-300">{task.description}</div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as TaskStatus[]).map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => updateProjectTaskStatus(p.name, task, s)}
                                    className={`px-2 py-0.5 rounded text-[10px] border ${effectiveTaskStatus(task) === s ? "bg-cyan-500/40 text-cyan-100 border-cyan-300/50" : "bg-white/5 text-slate-300 border-white/10"}`}
                                  >
                                    TAG:{s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}

                          {stashIssues.map((issue, i) => (
                            <div key={`${p.name}-stash-issue-${i}`} className="rounded-md bg-white/5 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-slate-100">[{issue.id}] {issue.title}</div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 rounded text-[11px] bg-white/10 text-slate-300">제어 기능은 2차 고도화(stash)</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] ${statusClass[effectiveIssueStatus(issue)]}`}>{effectiveIssueStatus(issue)}</span>
                                </div>
                              </div>
                              <div className="mt-1 text-slate-300">{issue.description}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                  );
                })}
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
              <div>Deploy Env: {chatConfig?.deploy?.vercelEnv || "local"}</div>
              <div>Deploy Branch: {chatConfig?.deploy?.gitBranch || "-"}</div>
              <div>Deploy Commit: {(chatConfig?.deploy?.gitCommit || "-").slice(0, 12)}</div>
              <div>Deploy ID: {(chatConfig?.deploy?.deploymentId || "-").slice(0, 24)}</div>
              <div>Deploy URL: {chatConfig?.deploy?.vercelUrl || "-"}</div>
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
