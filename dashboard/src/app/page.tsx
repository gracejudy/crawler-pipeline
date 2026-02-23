"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "overview" | "registration" | "tasks" | "logs" | "chat";

const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "registration", label: "Qoo10" },
  { key: "tasks", label: "Tasks" },
  { key: "logs", label: "Logs" },
  { key: "chat", label: "Chat" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("registration");
  const [summary, setSummary] = useState<any>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [prompt, setPrompt] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [chatConfig, setChatConfig] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadSummary = async () => {
    const r = await fetch("/api/sheets/summary");
    setSummary(await r.json());
  };

  const loadHistory = async () => {
    const r = await fetch("/api/chat/history");
    const d = await r.json();
    setHistory(d.messages || []);
  };

  useEffect(() => {
    loadSummary();
    loadHistory();
    fetch("/api/chat/config").then((r) => r.json()).then(setChatConfig).catch(() => null);
  }, []);
  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/registration/status?jobId=${jobId}`);
      const d = await r.json();
      setJob(d);
      if (d?.status === "done" || d?.status === "error") clearInterval(t);
    }, 1800);
    return () => clearInterval(t);
  }, [jobId]);

  useEffect(() => {
    const t = setInterval(loadHistory, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const runRegistration = async () => {
    const r = await fetch("/api/registration/run", { method: "POST" });
    const d = await r.json();
    setJobId(d.jobId);
    setLogs((p) => [`[${new Date().toLocaleTimeString()}] registration started`, ...p]);
  };

  const sendPrompt = async (text?: string) => {
    const message = (text ?? prompt).trim();
    if (!message) return;
    await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setPrompt("");
    setTimeout(loadHistory, 500);
  };

  const parsedProposal = useMemo(() => {
    const last = history[history.length - 1]?.text || "";
    const m = last.match(/```json\n([\s\S]*?)\n```/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch { return null; }
  }, [history]);

  const confirmProposal = async (confirm: boolean) => {
    await sendPrompt(confirm ? `CONFIRM:\n${JSON.stringify(parsedProposal)}` : "CANCEL proposal");
  };

  return (
    <main className="safe-wrap pb-24 pt-4">
      <header className="glass rounded-2xl p-4 mb-4">
        <h1 className="text-xl font-semibold">💎 RoughDiamond Dashboard</h1>
        <p className="text-sm text-slate-300">Coupang → Qoo10 Control Room</p>
      </header>

      <section className="glass rounded-2xl p-4 min-h-[60vh]">
        {tab === "overview" && <pre className="text-xs overflow-auto">{JSON.stringify(summary, null, 2)}</pre>}

        {tab === "registration" && (
          <div className="space-y-3">
            <button onClick={runRegistration} className="px-4 py-3 rounded-xl bg-cyan-500 text-black font-semibold w-full">Run Registration</button>
            <div className="text-sm">Job: {jobId || "-"}</div>
            <pre className="text-xs overflow-auto max-h-72">{JSON.stringify(job || { status: "idle" }, null, 2)}</pre>
          </div>
        )}

        {tab === "tasks" && <div className="text-sm">- Start registration{"\n"}- Review logs{"\n"}- Confirm next action from Chat</div>}

        {tab === "logs" && (
          <div className="space-y-2">
            {logs.map((l, i) => <div key={i} className="text-xs p-2 rounded bg-white/5">{l}</div>)}
            {!logs.length && <div className="text-sm text-slate-300">No alerts yet</div>}
          </div>
        )}

        {tab === "chat" && (
          <div className="flex flex-col gap-3 h-[65vh]">
            <div className="glass rounded-xl p-2 text-xs">
              <div>OpenClaw Base: {chatConfig?.base || "(unset)"}</div>
              <div>Session: {chatConfig?.session || "(unset)"}</div>
              <div>Token: {chatConfig?.hasToken ? "configured" : "missing"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "Build Dashboard Task 0",
                "Run Registration",
                "Summarize Errors",
              ].map((t) => (
                <button key={t} onClick={() => sendPrompt(t)} className="text-xs px-3 py-2 rounded-xl bg-white/10">{t}</button>
              ))}
            </div>
            <div className="flex-1 overflow-auto rounded-xl bg-black/20 p-3">
              {history.map((m, i) => (
                <div key={i} className="mb-2 text-sm">
                  <b className="text-cyan-300">{m.role || "msg"}</b>
                  <div className="whitespace-pre-wrap">{m.text || ""}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {parsedProposal && (
              <div className="glass rounded-xl p-3">
                <div className="text-xs mb-2">Proposed Action</div>
                <pre className="text-xs overflow-auto">{JSON.stringify(parsedProposal, null, 2)}</pre>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => confirmProposal(true)} className="flex-1 py-2 rounded bg-emerald-400 text-black font-semibold">Confirm</button>
                  <button onClick={() => confirmProposal(false)} className="flex-1 py-2 rounded bg-rose-400 text-black font-semibold">Cancel</button>
                </div>
              </div>
            )}

            <div className="flex gap-2 sticky bottom-0">
              <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Prompt to current OpenClaw session" className="flex-1 rounded-xl px-3 py-3 bg-white/10 outline-none" />
              <button onClick={() => sendPrompt()} className="px-4 rounded-xl bg-cyan-400 text-black font-bold">Send</button>
            </div>
          </div>
        )}
      </section>

      <nav className="fixed left-0 right-0 bottom-0 p-2">
        <div className="safe-wrap glass rounded-2xl p-2 grid grid-cols-5 gap-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`text-xs py-2 rounded-xl ${tab === t.key ? "bg-cyan-400 text-black font-semibold" : "bg-white/10"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
