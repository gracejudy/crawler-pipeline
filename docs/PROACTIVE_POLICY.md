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

### v2a — Field Discovery Mode (automated in 08:00–11:00 loop)
- Goal: discover SAFE overwrite-only fieldset before gate promotion.
- Automation command: `cd backend && npm run test:qoo10:v2a:auto`
- Fixed target only: `QOO10_TEST_ITEMCODE=1194045329`
- Update path only: `ItemsBasic.UpdateGoods` (SetNewGoods 금지)
- Read-back assert: `ItemsLookup.GetItemDetailInfo`
- Keep `GetAllGoodsInfo` as secondary evidence only.

#### Strict Preconditions (ALL required)
1. `QOO10_WRITE_APPROVED=1`
2. `QOO10_TEST_ITEMCODE` exists (missing => **BLOCKED exit 2**)
3. Time window is 08:00–11:00 KST
4. Daily quota available
5. Not in STOP state from previous 2-strike failures

#### Quotas (defaults)
- Max **3 field trials** per session
- Max **2 attempts** per field (including retry)
- Max **10 total write-related calls** per session (`update + read-back`)
- If v2a fails twice consecutively => **STOP (BLOCKED)** and record in `docs/FAILURE_REGISTRY.md`

#### Execution Rules
- Tier1 first: `ItemDescription`, `ItemQty`, `ItemTitle`
- Exactly ONE field mutation per trial
- Must perform write + read-back assertion in same trial
- Trial log record (jsonl):
  - `{run_id, ts, field, mutation, write_ok, read_ok, tag, verdict}`

#### Stop Rules
- `auth` => immediate STOP
- `permission` / `validation` => STOP
- `network` / `api` => retry within attempt limit; 2 consecutive trial failures => STOP
- `unknown` => escalate model for second attempt, then STOP if still fail

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
