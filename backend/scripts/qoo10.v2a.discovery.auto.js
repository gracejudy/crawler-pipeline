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

const TIER1_FIELDS = ['ItemDescription', 'ItemQty', 'ItemTitle'];
const KST = 'Asia/Seoul';

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
  const s = fmt.format(now).replace(' ', 'T'); // YYYY-MM-DDTHH:mm:ss
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

function classifyError(errMsg = '', apiMsg = '') {
  const t = `${errMsg} ${apiMsg}`.toLowerCase();

  if (t.includes('missing env qoo10_sak') || t.includes('unauthorized') || t.includes('forbidden') || t.includes('invalid') && t.includes('certification')) {
    return 'auth';
  }
  if (t.includes('enotfound') || t.includes('econnreset') || t.includes('etimedout') || t.includes('fetch failed') || t.includes('network') || t.includes('socket hang up')) {
    return 'network';
  }
  if (t.includes('permission') || t.includes('not permitted') || t.includes('forbidden category')) {
    return 'permission';
  }
  if (t.includes('required') || t.includes('invalid') || t.includes('must') || t.includes('validation')) {
    return 'validation';
  }
  if (t.includes('500') || t.includes('502') || t.includes('503') || t.includes('504') || t.includes('rate') || t.includes('quota') || t.includes('too many requests')) {
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
    StandardImage: String(detail.ImageUrl || 'https://dp.image-qoo10.jp/GMKT.IMG/loading_2017/qoo10_loading.v_20170420.png'),
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

function assertReadBack(field, detail, expected, itemCode) {
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

async function main() {
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
  let writeCalls = 0;
  const trials = [];

  for (const field of TIER1_FIELDS.slice(0, MAX_FIELD_TRIALS)) {
    let trialVerdict = 'FAIL';
    let trialTag = 'unknown';
    let lastErr = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_FIELD; attempt++) {
      if (writeCalls + 2 > MAX_WRITE_CALLS_PER_SESSION) {
        trialTag = 'quota';
        lastErr = 'write-call quota would exceed limit';
        break;
      }

      const ts = nowIso();
      const run_id = `${RUN_ID}-${field}-a${attempt}`;

      try {
        const before = await readDetail(itemCode);
        const { payload, mutation, expected } = mutateOneField(field, before, run_id);

        const wr = await qoo10PostMethod('ItemsBasic.UpdateGoods', payload);
        writeCalls += 1;

        if (wr.data?.ResultCode !== 0) {
          trialTag = classifyError('', wr.data?.ResultMsg || '');
          lastErr = wr.data?.ResultMsg || 'write failed';

          appendRunLog({ run_id, ts, field, mutation, write_ok: false, read_ok: false, tag: trialTag, verdict: 'FAIL' });

          if (trialTag === 'auth' || trialTag === 'permission' || trialTag === 'validation') {
            throw new Error(`hard-stop:${trialTag}:${lastErr}`);
          }

          // unknown => second attempt with escalation marker only
          if (trialTag === 'unknown' && attempt === 1) {
            appendRunLog({ run_id, ts: nowIso(), field, mutation: 'escalate_model_for_retry', write_ok: false, read_ok: false, tag: 'unknown', verdict: 'RETRY' });
          }

          continue;
        }

        const after = await readDetail(itemCode);
        writeCalls += 1;
        const assert = assertReadBack(field, after, expected, itemCode);

        const read_ok = Boolean(assert.ok);
        const write_ok = true;
        trialTag = read_ok ? 'ok' : 'api';
        trialVerdict = read_ok ? 'PASS' : 'FAIL';

        appendRunLog({ run_id, ts, field, mutation, write_ok, read_ok, tag: trialTag, verdict: trialVerdict });

        if (read_ok) break;
        lastErr = `read_assert_failed:${assert.reason}`;
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg.startsWith('hard-stop:')) {
          const [, tag, reason] = msg.split(':');
          state.stopped = true;
          state.consecutiveTrialFailures = STOP_STRIKE;
          state.lastFailureTag = tag;
          state.updatedAt = nowIso();
          writeJson(STATE_PATH, state);
          writeJson(QUOTA_PATH, { ...quota, writeCallsUsed: Number(quota.writeCallsUsed || 0) + writeCalls });
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
          writeJson(QUOTA_PATH, { ...quota, writeCallsUsed: Number(quota.writeCallsUsed || 0) + writeCalls });
          appendFailureState({ reason_tag: 'auth', field, attempts: attempt, verdict: 'BLOCKED' });
          blocked(`v2a STOP by auth: ${msg}`);
        }
      }
    }

    trials.push({ field, verdict: trialVerdict, tag: trialTag, err: lastErr });

    if (trialVerdict !== 'PASS') {
      state.consecutiveTrialFailures = Number(state.consecutiveTrialFailures || 0) + 1;
      state.lastFailureTag = trialTag;
      if (state.consecutiveTrialFailures >= STOP_STRIKE) {
        state.stopped = true;
        state.updatedAt = nowIso();
        writeJson(STATE_PATH, state);
        writeJson(QUOTA_PATH, { ...quota, writeCallsUsed: Number(quota.writeCallsUsed || 0) + writeCalls });
        appendFailureState({ reason_tag: trialTag, field, attempts: MAX_ATTEMPTS_PER_FIELD, verdict: 'BLOCKED' });
        blocked(`v2a STOP: two consecutive trial failures (${trialTag})`);
      }
    } else {
      state.consecutiveTrialFailures = 0;
      state.lastFailureTag = null;
    }
  }

  state.updatedAt = nowIso();
  writeJson(STATE_PATH, state);
  writeJson(QUOTA_PATH, { ...quota, writeCallsUsed: Number(quota.writeCallsUsed || 0) + writeCalls });

  console.log(JSON.stringify({
    run_id: RUN_ID,
    ts: nowIso(),
    itemCode,
    writeCalls,
    quota: {
      maxFieldTrials: MAX_FIELD_TRIALS,
      maxAttemptsPerField: MAX_ATTEMPTS_PER_FIELD,
      maxWriteCallsPerSession: MAX_WRITE_CALLS_PER_SESSION,
    },
    trials,
    verdict: trials.some((t) => t.verdict === 'PASS') ? 'PARTIAL_OR_BETTER' : 'FAIL',
    runLog: RUN_LOG_PATH,
  }));
}

main().catch((e) => {
  console.error(`[STOP] ${e?.message || String(e)}`);
  process.exit(1);
});
