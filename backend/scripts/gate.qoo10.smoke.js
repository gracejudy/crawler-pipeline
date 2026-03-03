#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_ATTEMPTS = 3; // initial 1 + retry 2
const BACKOFF_MS = [1000, 2000];
const TS = () => new Date().toISOString();
const run_id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const logDir = join(process.cwd(), '.logs', 'gate');
const logFile = join(logDir, `${run_id}.log`);
mkdirSync(logDir, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function classify(text, code) {
  const t = (text || '').toLowerCase();

  // auth
  if (
    t.includes('missing env qoo10_sak') ||
    t.includes('unauthorized') ||
    t.includes('forbidden') ||
    t.includes('invalid key') ||
    t.includes('invalid auth') ||
    t.includes('certification') && t.includes('invalid') ||
    t.includes('permission denied')
  ) return 'auth';

  // network
  if (
    t.includes('enotfound') ||
    t.includes('econnreset') ||
    t.includes('etimedout') ||
    t.includes('fetch failed') ||
    t.includes('socket hang up') ||
    t.includes('network')
  ) return 'network';

  // api/transient
  if (
    t.includes(' 500') || t.includes(' 502') || t.includes(' 503') || t.includes(' 504') ||
    t.includes('too many requests') || t.includes('rate limit') ||
    t.includes('resource exhausted') || t.includes('quota') ||
    t.includes('resultcode') && (t.includes('-999') || t.includes('transient'))
  ) return 'api';

  if (code === 0) return 'ok';
  return 'unknown';
}

function emit(attempt, tag, ok, summary) {
  const lineObj = { run_id, attempt, tag, ok, ts: TS(), summary };
  const line = JSON.stringify(lineObj);
  console.log(line);
  appendFileSync(logFile, `${line}\n`);
}

async function runSmokeAttempt() {
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', 'test:qoo10:register'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: process.env,
    });

    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); process.stdout.write(d); });
    child.stderr.on('data', (d) => { out += d.toString(); process.stderr.write(d); });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, output: out });
    });
  });
}

async function main() {
  if (!process.env.QOO10_SAK || String(process.env.QOO10_SAK).trim() === '') {
    emit(1, 'auth', false, 'QOO10_SAK missing; blocked without retry');
    process.exit(2);
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { code, output } = await runSmokeAttempt();
    const tag = classify(output, code);
    const ok = code === 0;

    emit(attempt, tag, ok, ok ? 'official smoke passed' : `official smoke failed (exit=${code})`);

    if (ok) process.exit(0);

    // auth never retries
    if (tag === 'auth') {
      emit(attempt, 'auth', false, 'blocked: auth failure; no further retries');
      process.exit(2);
    }

    if (attempt < MAX_ATTEMPTS) {
      const backoff = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 2000;
      await sleep(backoff);
      continue;
    }
  }

  process.exit(1);
}

main().catch((e) => {
  emit(1, 'unknown', false, `gate wrapper crashed: ${e?.message || String(e)}`);
  process.exit(1);
});
