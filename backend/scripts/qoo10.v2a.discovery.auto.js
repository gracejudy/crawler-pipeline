#!/usr/bin/env node
/**
 * v2a Field Discovery Automation (08:00-11:00 KST loop-safe)
 *
 * Strict preconditions:
 * - QOO10_WRITE_APPROVED=1
 * - QOO10_TEST_ITEMCODE exists
 * - Time window 08:00-11:00 KST
 * - Daily quota available
 * - Not in STOP state from previous 2-strike failures
 *
 * v2a propagation-delay-fix changes:
 * - Read-back now uses exponential backoff retry (2s,4s,8s, cap ~30s)
 * - propagation/stale_read tags do NOT trigger STOP
 * - 2x propagation for same field => UNKNOWN (session ends gracefully, no STOP)
 * - STOP only for: auth, permission, validation, 2x network/api hard failures
 * - Logging: read_attempts, total_wait_ms, final_read_value per trial
 * - Quota: each read-back retry counts toward write-related call ceiling
 * - STOP reset helper: clearStopIfPropagation() only clears when lastFailureTag=propagation
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { qoo10PostMethod } from '../src/qoo10Client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const LOG_DIR = join(__dirname, '..', 'logs');
const STATE_DIR = join(__dirname, '..', 'state');
const STATE_PATH = join(STATE_DIR, 'v2a-state.json');
const QUOTA_PATH = join(STATE_DIR, 'v2a-daily-quota.json');
const FAILURE_REGISTRY_PATH = join(STATE_DIR, 'failure_registry.jsonl');
const RUN_ID = `v2a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const RUN_LOG_PATH = join(LOG_DIR, `v2a-field-discovery-${RUN_ID}.jsonl`);

const MAX_FIELD_TRIALS = Number(process.env.V2A_MAX_FIELD_TRIALS || 3);
const MAX_ATTEMPTS_PER_FIELD = Number(process.env.V2A_MAX_ATTEMPTS_PER_FIELD || 2);
const MAX_WRITE_CALLS_PER_SESSION = Number(process.env.V2A_MAX_WRITE_CALLS || 10);
const STOP_STRIKE = 2;

// Propagation delay retry config
const READBACK_BACKOFF_MS = [2000, 4000, 8000]; // total max ~14s per attempt
const READBACK_MAX_TOTAL_MS = 30000;             // hard cap 30s total wait per attempt

const TIER1_FIELDS = ['ItemDescription', 'ItemQty', 'ItemTitle'];
const KST = 'Asia/Seoul';

// Tags that must NOT trigger STOP
const PROPAGATION_TAGS = new Set(['propagation', 'stale_read']);
// Tags that trigger immediate hard STOP
const HARD_STOP_TAGS = new Set(['auth', 'permission', 'validation']);

function nowIso() {
  return new Date().toISOString();
}

function kstNowParts() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const s = fmt.format(now).replace(' ', 'T');
  const [date, time] = s.split('T');
  const [hour] = time.split(':').map(Number);
  return { date, hour, time };
}

function ensureDirs() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function appendRunLog(obj) {
  fs.appendFileSync(RUN_LOG_PATH, JSON.stringify(obj) + '\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyError(errMsg = '', apiMsg = '') {
  const t = `${errMsg} ${apiMsg}`.toLowerCase();

  if (
    t.includes('missing env qoo10_sak') ||
    t.includes('unauthorized') ||
    (t.includes('forbidden') && !t.includes('forbidden category')) ||
    (t.includes('invalid') && t.includes('certification'))
  ) {
    return 'auth';
  }
  if (
    t.includes('enotfound') ||
    t.includes('econnreset') ||
    t.includes('etimedout') ||
    t.includes('fetch failed') ||
    t.includes('network') ||
    t.includes('socket hang up')
  ) {
    return 'network';
  }
  if (t.includes('permission') || t.includes('not permitted') || t.includes('forbidden category')) {
    return 'permission';
  }
  if (t.includes('required') || t.includes('invalid') || t.includes('must') || t.includes('validation')) {
    return 'validation';
  }
  if (
    t.includes('500') ||
    t.includes('502') ||
    t.includes('503') ||
    t.includes('504') ||
    t.includes('rate') ||
    t.includes('quota') ||
    t.includes('too many requests')
  ) {
    return 'api';
  }
  return 'unknown';
}

function normalizePrice(v, fallback = 1000) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? String(n) : String(fallback);
}

function buildBasePayload(detail, itemCode) {
  return {
    returnType: 'application/json',
    ItemCode: String(itemCode),
    SecondSubCat: String(detail.SecondSubCatCd || ''),
    ItemTitle: String(detail.ItemTitle || 'v2a test'),
    ItemPrice: normalizePrice(detail.SellPrice),
    ItemQty: String(detail.ItemQty || '1'),
    AvailableDateType: '0',
    AvailableDateValue: '2',
    ShippingNo: String(detail.ShippingNo || '0'),
    StandardImage: String(
      detail.ImageUrl ||
        'https://dp.image-qoo10.jp/GMKT.IMG/loading_2017/qoo10_loading.v_20170420.png'
    ),
    ItemDescription: String(detail.ItemDetail || '<p>v2a test</p>'),
    TaxRate: 'S',
    ExpireDate: String(detail.ExpireDate || '2030-12-31'),
    AdultYN: String(detail.AdultYN || 'N'),
    RetailPrice: normalizePrice(detail.RetailPrice, 0),
    ProductionPlaceType: '2',
    ProductionPlace: 'Overseas',
    Weight: '1',
  };
}

async function readDetail(itemCode) {
  const r = await qoo10PostMethod('ItemsLookup.GetItemDetailInfo', {
    returnType: 'application/json',
    ItemCode: String(itemCode),
  });
  if (r.data?.ResultCode !== 0) {
    throw new Error(`read-back failed: ${r.data?.ResultMsg || 'unknown'}`);
  }
  const d = r.data?.ResultObject?.[0];
  if (!d) throw new Error('read-back empty result');
  return d;
}

/**
 * Read-back with exponential backoff retry.
 * Counts each read call toward writeCallsCounter (passed by ref via object).
 *
 * Returns: { detail, read_attempts, total_wait_ms, final_read_value, tag }
 *   tag: 'ok' if assertion passed, 'propagation' if timed out, 'api' if hard read error
 */
async function readBackWithRetry({ itemCode, field, expected, quotaCounter, maxWriteCalls }) {
  const delays = READBACK_BACKOFF_MS;
  let read_attempts = 0;
  let total_wait_ms = 0;
  let lastDetail = null;
  let lastValue = null;

  // First immediate read (no wait)
  if (quotaCounter.reads + 1 > maxWriteCalls - quotaCounter.writes) {
    return { detail: null, read_attempts: 0, total_wait_ms: 0, final_read_value: null, tag: 'quota' };
  }

  try {
    lastDetail = await readDetail(itemCode);
    quotaCounter.reads += 1;
    read_attempts += 1;
    lastValue = extractFieldValue(field, lastDetail);
    if (assertValue(field, lastDetail, expected, itemCode).ok) {
      return { detail: lastDetail, read_attempts, total_wait_ms, final_read_value: lastValue, tag: 'ok' };
    }
  } catch (e) {
    return { detail: null, read_attempts, total_wait_ms, final_read_value: null, tag: classifyError(String(e?.message || e)) };
  }

  // Retry with backoff
  for (const delay of delays) {
    if (total_wait_ms >= READBACK_MAX_TOTAL_MS) break;

    // Check quota before each retry read
    if (quotaCounter.reads + 1 > maxWriteCalls - quotaCounter.writes) {
      return { detail: lastDetail, read_attempts, total_wait_ms, final_read_value: lastValue, tag: 'quota' };
    }

    await sleep(delay);
    total_wait_ms += delay;

    try {
      lastDetail = await readDetail(itemCode);
      quotaCounter.reads += 1;
      read_attempts += 1;
      lastValue = extractFieldValue(field, lastDetail);

      if (assertValue(field, lastDetail, expected, itemCode).ok) {
        return { detail: lastDetail, read_attempts, total_wait_ms, final_read_value: lastValue, tag: 'ok' };
      }
    } catch (e) {
      return { detail: lastDetail, read_attempts, total_wait_ms, final_read_value: lastValue, tag: classifyError(String(e?.message || e)) };
    }
  }

  // Never resolved within window
  return { detail: lastDetail, read_attempts, total_wait_ms, final_read_value: lastValue, tag: 'propagation' };
}

function extractFieldValue(field, detail) {
  if (field === 'ItemTitle') return String(detail?.ItemTitle || '');
  if (field === 'ItemQty') return String(detail?.ItemQty || '');
  return String(detail?.ItemDetail || '');
}

function mutateOneField(field, detail, runId) {
  const marker = `[${runId}:${field}]`;
  const payload = buildBasePayload(detail, process.env.QOO10_TEST_ITEMCODE);

  if (field === 'ItemTitle') {
    const max = 95;
    const keep = Math.max(1, max - (` ${marker}`).length);
    payload.ItemTitle = `${String(payload.ItemTitle).slice(0, keep)} ${marker}`;
    return { payload, mutation: `title_suffix:${marker}`, expected: marker };
  }

  if (field === 'ItemQty') {
    const current = Number(payload.ItemQty || '1');
    payload.ItemQty = String(current === 1 ? 2 : 1);
    return { payload, mutation: `qty_toggle:${current}->${payload.ItemQty}`, expected: payload.ItemQty };
  }

  // ItemDescription
  payload.ItemDescription = `${payload.ItemDescription}\n<!--${marker}-->`;
  return { payload, mutation: `description_marker:${marker}`, expected: marker };
}

function assertValue(field, detail, expected, itemCode) {
  const sameItem = String(detail.ItemNo || '') === String(itemCode);
  if (!sameItem) return { ok: false, reason: `item_mismatch:${detail.ItemNo}` };

  if (field === 'ItemTitle') {
    return { ok: String(detail.ItemTitle || '').includes(expected), reason: 'title_marker_check' };
  }
  if (field === 'ItemQty') {
    return { ok: String(detail.ItemQty || '') === String(expected), reason: 'qty_exact_check' };
  }
  return { ok: String(detail.ItemDetail || '').includes(expected), reason: 'description_marker_check' };
}

// Keep for compatibility (used in write-error path)
function assertReadBack(field, detail, expected, itemCode) {
  return assertValue(field, detail, expected, itemCode);
}

function appendFailureState({ reason_tag, field = null, attempts = null, verdict = 'BLOCKED' }) {
  const rec = {
    ts: nowIso(),
    run_id: RUN_ID,
    reason_tag,
    field,
    attempts,
    verdict,
  };
  fs.appendFileSync(FAILURE_REGISTRY_PATH, JSON.stringify(rec) + '\n');
}

function blocked(msg, code = 2) {
  console.error(`[BLOCKED] ${msg}`);
  process.exit(code);
}

/**
 * Safe STOP-state reset helper.
 * Clears STOP only when lastFailureTag is a propagation tag.
 * Otherwise prints reason and exits 1.
 */
export function clearStopIfPropagation() {
  const state = readJsonSafe(STATE_PATH, {});
  if (!state.stopped) {
    console.log('[clear-stop] Not in STOP state. Nothing to clear.');
    return;
  }
  if (PROPAGATION_TAGS.has(state.lastFailureTag)) {
    state.stopped = false;
    state.consecutiveTrialFailures = 0;
    state.lastFailureTag = null;
    state.updatedAt = nowIso();
    writeJson(STATE_PATH, state);
    console.log(`[clear-stop] STOP cleared (was: propagation). State reset.`);
  } else {
    console.error(
      `[clear-stop] STOP reason is "${state.lastFailureTag}" — not a propagation tag. Refusing to clear. Investigate manually.`
    );
    process.exit(1);
  }
}

async function main() {
  // Support: node script.js --clear-stop
  if (process.argv.includes('--clear-stop')) {
    ensureDirs();
    clearStopIfPropagation();
    return;
  }

  ensureDirs();

  // Preconditions
  if (String(process.env.QOO10_WRITE_APPROVED || '') !== '1') {
    blocked('QOO10_WRITE_APPROVED=1 required');
  }
  if (!String(process.env.QOO10_TEST_ITEMCODE || '').trim()) {
    blocked('QOO10_TEST_ITEMCODE required');
  }

  const { date, hour } = kstNowParts();
  if (hour < 8 || hour >= 11) {
    blocked('outside 08:00-11:00 KST window');
  }

  const state = readJsonSafe(STATE_PATH, {
    stopped: false,
    consecutiveTrialFailures: 0,
    lastFailureTag: null,
    updatedAt: null,
  });

  if (state.stopped || Number(state.consecutiveTrialFailures || 0) >= STOP_STRIKE) {
    blocked('v2a in STOP state from previous 2-strike failures');
  }

  const quota = readJsonSafe(QUOTA_PATH, { date, sessions: 0, writeCallsUsed: 0 });
  if (quota.date !== date) {
    quota.date = date;
    quota.sessions = 0;
    quota.writeCallsUsed = 0;
  }

  if (Number(quota.writeCallsUsed || 0) >= MAX_WRITE_CALLS_PER_SESSION) {
    blocked('daily quota exhausted (write calls)');
  }

  quota.sessions += 1;

  const itemCode = String(process.env.QOO10_TEST_ITEMCODE).trim();

  // Shared quota counter (writes + reads both count)
  const quotaCounter = { writes: 0, reads: 0 };
  const totalCallsUsed = () => quotaCounter.writes + quotaCounter.reads;

  const trials = [];
  // Track propagation occurrences per field for UNKNOWN policy
  const propagationCounts = {};

  for (const field of TIER1_FIELDS.slice(0, MAX_FIELD_TRIALS)) {
    let trialVerdict = 'FAIL';
    let trialTag = 'unknown';
    let lastErr = '';
    let trialReadAttempts = 0;
    let trialTotalWaitMs = 0;
    let trialFinalReadValue = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_FIELD; attempt++) {
      // Need at least 1 write + 1 read remaining
      if (totalCallsUsed() + 2 > MAX_WRITE_CALLS_PER_SESSION) {
        trialTag = 'quota';
        lastErr = 'write-call quota would exceed limit';
        appendRunLog({
          run_id: `${RUN_ID}-${field}-a${attempt}`,
          ts: nowIso(),
          field,
          mutation: null,
          write_ok: false,
          read_ok: false,
          tag: trialTag,
          verdict: 'FAIL',
          read_attempts: 0,
          total_wait_ms: 0,
          final_read_value: null,
        });
        break;
      }

      const ts = nowIso();
      const run_id = `${RUN_ID}-${field}-a${attempt}`;

      try {
        const before = await readDetail(itemCode);
        const { payload, mutation, expected } = mutateOneField(field, before, run_id);

        const wr = await qoo10PostMethod('ItemsBasic.UpdateGoods', payload);
        quotaCounter.writes += 1;

        if (wr.data?.ResultCode !== 0) {
          trialTag = classifyError('', wr.data?.ResultMsg || '');
          lastErr = wr.data?.ResultMsg || 'write failed';

          appendRunLog({
            run_id,
            ts,
            field,
            mutation,
            write_ok: false,
            read_ok: false,
            tag: trialTag,
            verdict: 'FAIL',
            read_attempts: 0,
            total_wait_ms: 0,
            final_read_value: null,
          });

          if (HARD_STOP_TAGS.has(trialTag)) {
            throw new Error(`hard-stop:${trialTag}:${lastErr}`);
          }

          if (trialTag === 'unknown' && attempt === 1) {
            appendRunLog({
              run_id,
              ts: nowIso(),
              field,
              mutation: 'escalate_model_for_retry',
              write_ok: false,
              read_ok: false,
              tag: 'unknown',
              verdict: 'RETRY',
              read_attempts: 0,
              total_wait_ms: 0,
              final_read_value: null,
            });
          }

          continue;
        }

        // Read-back with propagation delay retry
        const rb = await readBackWithRetry({
          itemCode,
          field,
          expected,
          quotaCounter,
          maxWriteCalls: MAX_WRITE_CALLS_PER_SESSION,
        });

        trialReadAttempts = rb.read_attempts;
        trialTotalWaitMs = rb.total_wait_ms;
        trialFinalReadValue = rb.final_read_value;

        const read_ok = rb.tag === 'ok';
        const write_ok = true;

        if (rb.tag === 'quota') {
          trialTag = 'quota';
          trialVerdict = 'FAIL';
          lastErr = 'read-back quota exhausted during propagation retry';
          appendRunLog({
            run_id, ts, field, mutation, write_ok, read_ok: false,
            tag: trialTag, verdict: 'FAIL',
            read_attempts: rb.read_attempts, total_wait_ms: rb.total_wait_ms, final_read_value: rb.final_read_value,
          });
          break;
        }

        if (read_ok) {
          trialTag = 'ok';
          trialVerdict = 'PASS';
          appendRunLog({
            run_id, ts, field, mutation, write_ok, read_ok: true,
            tag: trialTag, verdict: 'PASS',
            read_attempts: rb.read_attempts, total_wait_ms: rb.total_wait_ms, final_read_value: rb.final_read_value,
          });
          break;
        }

        // Not ok — check if propagation tag
        if (PROPAGATION_TAGS.has(rb.tag)) {
          trialTag = rb.tag;
          trialVerdict = 'FAIL';
          lastErr = `propagation timeout after ${rb.total_wait_ms}ms / ${rb.read_attempts} reads`;
          appendRunLog({
            run_id, ts, field, mutation, write_ok, read_ok: false,
            tag: trialTag, verdict: 'FAIL',
            read_attempts: rb.read_attempts, total_wait_ms: rb.total_wait_ms, final_read_value: rb.final_read_value,
          });
          // count propagation for this field
          propagationCounts[field] = (propagationCounts[field] || 0) + 1;
          // Don't continue retrying if propagation (no point — same delay issue)
          break;
        }

        // api or other read error
        trialTag = rb.tag || 'api';
        trialVerdict = 'FAIL';
        lastErr = `read_assert_failed after ${rb.read_attempts} attempts`;
        appendRunLog({
          run_id, ts, field, mutation, write_ok, read_ok: false,
          tag: trialTag, verdict: 'FAIL',
          read_attempts: rb.read_attempts, total_wait_ms: rb.total_wait_ms, final_read_value: rb.final_read_value,
        });
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg.startsWith('hard-stop:')) {
          const parts = msg.split(':');
          const tag = parts[1];
          const reason = parts.slice(2).join(':');
          state.stopped = true;
          state.consecutiveTrialFailures = STOP_STRIKE;
          state.lastFailureTag = tag;
          state.updatedAt = nowIso();
          writeJson(STATE_PATH, state);
          writeJson(QUOTA_PATH, { ...quota, writeCallsUsed: Number(quota.writeCallsUsed || 0) + totalCallsUsed() });
          appendFailureState({ reason_tag: tag, field, attempts: attempt, verdict: 'BLOCKED' });
          blocked(`v2a STOP by ${tag}: ${reason}`);
        }

        trialTag = classifyError(msg, '');
        lastErr = msg;

        if (trialTag === 'auth') {
          state.stopped = true;
          state.consecutiveTrialFailures = STOP_STRIKE;
          state.lastFailureTag = 'auth';
          state.updatedAt = nowIso();
          writeJson(STATE_PATH, state);
          writeJson(QUOTA_PATH, { ...quota, writeCallsUsed: Number(quota.writeCallsUsed || 0) + totalCallsUsed() });
          appendFailureState({ reason_tag: 'auth', field, attempts: attempt, verdict: 'BLOCKED' });
          blocked(`v2a STOP by auth: ${msg}`);
        }
      }
    }

    // --- Post-trial STOP / UNKNOWN evaluation ---

    // Propagation tag: do NOT increment consecutiveTrialFailures, mark UNKNOWN if repeated
    if (PROPAGATION_TAGS.has(trialTag)) {
      if ((propagationCounts[field] || 0) >= 2) {
        // 2x propagation on same field => UNKNOWN, end session gracefully (no STOP)
        trials.push({ field, verdict: 'UNKNOWN', tag: trialTag, err: lastErr, read_attempts: trialReadAttempts, total_wait_ms: trialTotalWaitMs, final_read_value: trialFinalReadValue });
        appendRunLog({
          run_id: `${RUN_ID}-${field}-summary`,
          ts: nowIso(),
          field,
          verdict: 'UNKNOWN',
          tag: trialTag,
          note: '2x propagation on same field — marking UNKNOWN, ending session gracefully',
          read_attempts: trialReadAttempts,
          total_wait_ms: trialTotalWaitMs,
          final_read_value: trialFinalReadValue,
        });
        // Persist state (no STOP), save quota, exit cleanly
        state.updatedAt = nowIso();
        writeJson(STATE_PATH, state);
        writeJson(QUOTA_PATH, { ...quota, writeCallsUsed: Number(quota.writeCallsUsed || 0) + totalCallsUsed() });
        console.log(JSON.stringify({
          run_id: RUN_ID,
          ts: nowIso(),
          itemCode,
          writeCalls: totalCallsUsed(),
          trials,
          verdict: 'UNKNOWN',
          note: `Field ${field} produced 2x propagation — session ended gracefully without STOP`,
          runLog: RUN_LOG_PATH,
        }));
        process.exit(0);
      }
      // 1x propagation: don't increment STOP counter, continue to next field
      trials.push({ field, verdict: 'FAIL', tag: trialTag, err: lastErr, read_attempts: trialReadAttempts, total_wait_ms: trialTotalWaitMs, final_read_value: trialFinalReadValue });
      // Reset consecutiveTrialFailures for propagation (not a hard failure)
      // Keep state.consecutiveTrialFailures unchanged — propagation is excluded
    } else if (trialVerdict !== 'PASS') {
      // Hard failure (api, network, unknown, quota) — count toward STOP
      trials.push({ field, verdict: trialVerdict, tag: trialTag, err: lastErr, read_attempts: trialReadAttempts, total_wait_ms: trialTotalWaitMs, final_read_value: trialFinalReadValue });
      state.consecutiveTrialFailures = Number(state.consecutiveTrialFailures || 0) + 1;
      state.lastFailureTag = trialTag;
      if (state.consecutiveTrialFailures >= STOP_STRIKE) {
        state.stopped = true;
        state.updatedAt = nowIso();
        writeJson(STATE_PATH, state);
        writeJson(QUOTA_PATH, { ...quota, writeCallsUsed: Number(quota.writeCallsUsed || 0) + totalCallsUsed() });
        appendFailureState({ reason_tag: trialTag, field, attempts: MAX_ATTEMPTS_PER_FIELD, verdict: 'BLOCKED' });
        blocked(`v2a STOP: two consecutive hard failures (${trialTag})`);
      }
    } else {
      // PASS
      trials.push({ field, verdict: 'PASS', tag: trialTag, err: '', read_attempts: trialReadAttempts, total_wait_ms: trialTotalWaitMs, final_read_value: trialFinalReadValue });
      state.consecutiveTrialFailures = 0;
      state.lastFailureTag = null;
    }
  }

  state.updatedAt = nowIso();
  writeJson(STATE_PATH, state);
  writeJson(QUOTA_PATH, { ...quota, writeCallsUsed: Number(quota.writeCallsUsed || 0) + totalCallsUsed() });

  const overallVerdict = trials.some((t) => t.verdict === 'PASS')
    ? 'PARTIAL_OR_BETTER'
    : trials.some((t) => t.verdict === 'UNKNOWN')
    ? 'UNKNOWN'
    : 'FAIL';

  console.log(
    JSON.stringify({
      run_id: RUN_ID,
      ts: nowIso(),
      itemCode,
      writeCalls: totalCallsUsed(),
      quota: {
        maxFieldTrials: MAX_FIELD_TRIALS,
        maxAttemptsPerField: MAX_ATTEMPTS_PER_FIELD,
        maxWriteCallsPerSession: MAX_WRITE_CALLS_PER_SESSION,
      },
      trials,
      verdict: overallVerdict,
      runLog: RUN_LOG_PATH,
    })
  );
}

main().catch((e) => {
  console.error(`[STOP] ${e?.message || String(e)}`);
  process.exit(1);
});
