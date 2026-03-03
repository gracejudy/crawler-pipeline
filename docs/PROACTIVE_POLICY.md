# PROACTIVE_POLICY (CORE: crawler-pipeline)

## Scope Lock
- Project: crawler-pipeline (CORE only)
- Gate/Smoke repo scope: `backend/` only
- Excluded: dashboard, unrelated threads

## Operating Window
- Daily target: **08:00–11:00 KST**
- Concurrency target: **2**
- READY scope: **Now + Next** (Now 우선, Next는 조건 충족 시)

## Gate/Smoke Standard
- Gate command: `cd backend && npm run gate`
- Smoke command (official only): `npm run test:qoo10:register`
- Qoo10 method: `ItemsLookup.GetSellerDeliveryGroupInfo`
- Nature: **read-only smoke** (no product create/update)

## No-Accumulation Rule
- Smoke is read-only, so overwrite-only is not applicable to remote state.
- Local evidence/logs must be **run_id-isolated** under `.logs/gate/<run_id>.log`.

## Merge Policy
- User selects merge batch ID (`MERGE_BATCH_ID`).
- Agent performs merge after explicit user approval.
- **Shadow Day:** NO MERGE.

## Failure Tags
- `auth`: missing/invalid auth, permission failure
- `network`: DNS/socket/timeout/connectivity
- `api`: upstream transient/5xx/rate-limit
- `unknown`: anything else

## 2-Strike Auto Stop
- `auth`: immediate BLOCKED (no retries beyond attempt 1)
- `network`/`api`: retries allowed inside gate; if same task gate fails twice, mark BLOCKED
- `unknown`: first failure escalates model tier for second run; if still fails, BLOCKED
