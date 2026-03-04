## Summary
- [ ] Proactive Factory v1 bootstrap changes (atomic)

## Scope Check
- [ ] Project: crawler-pipeline CORE only
- [ ] Gate/smoke scope: backend/ only
- [ ] Excludes dashboard/unrelated threads

## Policy Check
- [ ] 08:00–11:00 KST daily loop reflected
- [ ] Concurrency=2 reflected
- [ ] READY=Now+Next reflected
- [ ] Smoke=official read-only only (`test:qoo10:register`) reflected
- [ ] 2-strike auto stop reflected
- [ ] Failure classification tags reflected

## Merge Policy
- [ ] MERGE_BATCH_ID user-approved flow documented
- [ ] Shadow Day: NO MERGE respected

## Evidence
- [ ] Gate run logs (`backend/.logs/gate/<run_id>.log`)
- [ ] Shadow Day report attached (`docs/SHADOW_DAY_REPORT.md`)
- [ ] Failure registry / decision log updated

## Risks / Rollback
- [ ] Risks listed
- [ ] Rollback steps listed
