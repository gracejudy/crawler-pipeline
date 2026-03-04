# DAILY_LOOP (08:00–11:00 KST)

## Inputs
- READY set: `docs/CURRENT_TASK.md` 기준 Now + Next
- Today candidates: Now 우선, Next는 조건 충족 시
- Concurrency: 2

## Loop (Shadow Day / Strict)
1. Pick up to 2 candidates from Now.
2. Execute by cadence:
   - v1 read-only gate (`npm run gate`) runs on sparse schedule only (every 3 days or weekly Monday).
   - On non-cadence days, skip v1 by default.
3. v2 handling:
   - v2a automated discovery: `npm run test:qoo10:v2a:auto`
   - Strict preconditions (ALL):
     - `QOO10_WRITE_APPROVED=1`
     - `QOO10_TEST_ITEMCODE` exists (missing => BLOCKED exit 2)
     - current time in 08:00–11:00 KST
     - daily quota available
     - not in STOP state from previous 2-strike failures
   - Quotas (default):
     - max 3 field trials/session
     - max 2 attempts/field (retry 포함)
     - max 10 write-related calls/session (`update + read-back`)
   - Execution rules:
     - overwrite-only path (`ItemsBasic.UpdateGoods`) on fixed `QOO10_TEST_ITEMCODE=1194045329`
     - exactly one field mutation per trial (Tier1 first)
     - mandatory read-back assert (`ItemsLookup.GetItemDetailInfo`)
   - Trial logging format:
     - `{run_id, ts, field, mutation, write_ok, read_ok, tag, verdict}`
4. If v2 fails:
   - `auth` => immediate STOP/BLOCKED and record in `docs/FAILURE_REGISTRY.md`
   - `permission|validation` => STOP/BLOCKED and record
   - `network|api` => retry within attempt limit; 2 consecutive trial failures => STOP/BLOCKED and record
   - `unknown` => escalate model for second attempt; fail again => STOP/BLOCKED and record
5. Diagnostic trigger:
   - unclear cause (`auth|network|api|unknown`) -> trigger v1 (`npm run gate`) immediately.
   - clear non-diagnostic cause (`permission|validation|approval-missing`) -> do **not** trigger v1.
6. Collect structured attempt logs (JSON lines with `run_id`).
7. Apply 2-strike policy and update decision log.
8. Shadow Day mode: produce report only, no merge.

## Output Artifacts
- Gate logs: `backend/.logs/gate/<run_id>.log`
- v2a run logs: `backend/logs/v2a-field-discovery-<run_id>.jsonl`
- v2a state/quota: `backend/logs/v2a-state.json`, `backend/logs/v2a-daily-quota.json`
- Decision record: `docs/DECISION_LOG.md`
- Failure mapping updates: `docs/FAILURE_REGISTRY.md`
- Shadow Day report: `docs/SHADOW_DAY_REPORT.md`
- Discovery ledger: `docs/V2_FIELD_DISCOVERY.md`
- Report fields required:
  - `v1_triggered: true|false`
  - `v1_skip_reason: <text>` when skipped

## Gate Purity Rules
- Gate must invoke read-only smoke only: `npm run smoke:readonly`
- Write path is excluded from v1 gate: `npm run test:qoo10:write`
- v2a automation is write-enabled only under strict preconditions above.
