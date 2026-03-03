# DAILY_LOOP (08:00–11:00 KST)

## Inputs
- READY set: `docs/CURRENT_TASK.md` 기준 Now + Next
- Today candidates: Now 우선, Next는 조건 충족 시
- Concurrency: 2

## Loop (Shadow Day / Strict)
1. Pick up to 2 candidates from Now.
2. For each candidate, run gate in `backend/`:
   - `npm run gate`
3. Collect structured attempt logs (JSON lines with `run_id`).
4. Classify failures (`auth|network|api|unknown`).
5. Apply 2-strike policy and update decision log.
6. Shadow Day mode: produce report only, no merge.

## Output Artifacts
- Gate logs: `backend/.logs/gate/<run_id>.log`
- Decision record: `docs/DECISION_LOG.md`
- Failure mapping updates: `docs/FAILURE_REGISTRY.md`
- Shadow Day report: `docs/SHADOW_DAY_REPORT.md`
