# PROACTIVE_POLICY (CORE: crawler-pipeline)

## Scope Lock
- Project: crawler-pipeline (CORE only)
- Gate/Smoke repo scope: `backend/` only
- Excluded: dashboard, unrelated threads

## Operating Window
- Daily operation window: **08:00–11:00 KST**
- Concurrency target: **2**
- READY scope: **Now + Next** (Now 우선, Next는 조건 충족 시)

## Cost-Optimized Gate Cadence (v1)
- v1 read-only gate is **frozen baseline** and **sparse** (not daily):
  - default: **every 3 days** OR
  - weekly mode: **every Monday**
- Choose one cadence and keep it explicit in ops notes.

## Gate/Smoke Standard
- Gate command: `cd backend && npm run gate`
- Read-only smoke command (official only): `npm run smoke:readonly`
- Qoo10 method: `ItemsLookup.GetSellerDeliveryGroupInfo`
- Nature: **read-only smoke** (no product create/update)
- Write test is explicitly excluded from gate: `npm run test:qoo10:write`
- Write test requires explicit user approval (`QOO10_WRITE_APPROVED=1`).

## No-Accumulation Rule
- Smoke is read-only, so overwrite-only is not applicable to remote state.
- Local evidence/logs must be **run_id-isolated** under `.logs/gate/<run_id>.log`.

## Merge Policy
- User selects merge batch ID (`MERGE_BATCH_ID`).
- Agent performs merge after explicit user approval.
- **Shadow Day:** NO MERGE.

## Failure Tags
### v1 (read-only)
- `auth`: missing/invalid auth
- `network`: DNS/socket/timeout/connectivity
- `api`: upstream transient/5xx/rate-limit
- `unknown`: anything else

### v2 (write)
- `permission`: category/seller permission
- `validation`: payload/field validation
- `approval-missing`: `QOO10_WRITE_APPROVED` 미설정
- `auth`, `network`, `api`, `unknown`

## 2-Strike Auto Stop
- `auth`: immediate BLOCKED (no retries beyond attempt 1)
- `network`/`api`: retries allowed inside gate; if same task gate fails twice, mark BLOCKED
- `unknown`: first failure escalates model tier for second run; if still fails, BLOCKED

## v2(write) Diagnostic Trigger Rule
- v2(write) failure with **unclear cause** (`auth|network|api|unknown`) -> trigger v1 read-only gate to disambiguate environment vs payload issues.
- v2(write) failure with **clear non-diagnostic cause** -> **skip v1**:
  - `permission` (category/seller permission mismatch)
  - `validation` error
  - `approval-missing` (`QOO10_WRITE_APPROVED` not set)
- Reports must explicitly state: `v1_triggered: true|false` and `v1_skip_reason` when skipped.
