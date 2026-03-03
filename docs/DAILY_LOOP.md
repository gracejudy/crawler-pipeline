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
3. If v2(write) is executed (explicit approval required) and fails:
   - unclear cause (`auth|network|api|unknown`) -> trigger v1 (`npm run gate`) immediately.
   - clear non-diagnostic cause (permission/category/validation/approval-missing) -> do **not** trigger v1.
4. Collect structured attempt logs (JSON lines with `run_id`).
5. Apply 2-strike policy and update decision log.
6. Shadow Day mode: produce report only, no merge.

## Output Artifacts
- Gate logs: `backend/.logs/gate/<run_id>.log`
- Decision record: `docs/DECISION_LOG.md`
- Failure mapping updates: `docs/FAILURE_REGISTRY.md`
- Shadow Day report: `docs/SHADOW_DAY_REPORT.md`
- Report fields required:
  - `v1_triggered: true|false`
  - `v1_skip_reason: <text>` when skipped

## Gate Purity Rules
- Gate must invoke read-only smoke only: `npm run smoke:readonly`
- Write path is excluded from gate: `npm run test:qoo10:write`
- Write path requires explicit approval: `QOO10_WRITE_APPROVED=1`
