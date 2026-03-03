# PROACTIVE_POLICY (CORE: crawler-pipeline)

## Scope Lock
- Project: crawler-pipeline (CORE only)
- Gate/Smoke repo scope: `backend/` only
- Excluded: dashboard, unrelated threads

## Operating Window
- Daily operation window: **08:00–11:00 KST**
- Concurrency target: **2**
- READY scope: **Now + Next** (Now 우선, Next는 조건 충족 시)

## v1 Cadence (Frozen Baseline)
- v1 read-only gate is **sparse** (not daily):
  - default: **every 3 days** OR
  - weekly mode: **every Monday**
- Choose one cadence and keep it explicit in ops notes.

## v1 Standard (Read-only)
- Gate command: `cd backend && npm run gate`
- Read-only smoke command: `npm run smoke:readonly`
- Method: `ItemsLookup.GetSellerDeliveryGroupInfo`
- Nature: **read-only only** (no write call)
- Required logs: run_id + parallel-safe log isolation

## v2 Write Strategy (Redesign)

### v2a — Field Discovery Mode (current)
- Goal: discover SAFE overwrite-only fieldset before gate promotion.
- Write tests are allowed by default **during discovery**.
- `QOO10_WRITE_APPROVED=1` is default expectation in discovery runs.
- Exactly **ONE non-key field** mutation per run.
- Must execute **write + read-back verification** in same run.
- Must keep entity key fixed (e.g., SellerCode / target entity key).
- Must prevent entity accumulation.
- Every run must be recorded in `docs/V2_FIELD_DISCOVERY.md` with:
  - `{ run_id, field, value_pattern, write_result, read_back_result, error_code, SAFE/UNSAFE }`

### v2b — Write Gate Mode (future)
- Activated only after explicit promotion.
- Requires finalized `SAFE_FIELDSET`.
- Runs only on approved days or by merge policy.

## v2 Promotion Rules (STRICT)
v2 can be promoted to write gate only if all are true:
1. `SAFE_FIELDSET` documented.
2. At least **3 consecutive PASS** runs.
3. PASS runs use different `run_id`.
4. PASS runs include read-back verification.
5. No open write-related issues in `docs/FAILURE_REGISTRY.md`.
6. User explicitly sends: **"Promote v2 to gate."**

Upon promotion:
- Set `QOO10_WRITE_GATE=1`
- Set `QOO10_WRITE_APPROVED=0` (default block)
- Update this policy and gate strategy docs

## Diagnostic Trigger Rule (v2 -> v1)
- If v2 fails with unclear cause (`auth|network|api|unknown`) -> trigger v1 read-only gate.
- If v2 fails with clear non-diagnostic cause -> skip v1:
  - `permission`
  - `validation`
  - `approval-missing`
- Reports must include:
  - `v1_triggered: true|false`
  - `v1_skip_reason` when skipped

## Merge Policy
- User selects merge batch ID (`MERGE_BATCH_ID`).
- Agent performs merge after explicit user approval.
- **Shadow Day:** NO MERGE.
