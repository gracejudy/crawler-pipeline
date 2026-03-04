# V2_FIELD_DISCOVERY

Purpose: discovery ledger for v2a write-safe fieldset.

## Rules
- Exactly one non-key field mutation per run.
- SellerCode/entity key must remain fixed.
- Must include write + read-back verification.
- No entity accumulation.

## SAFE_FIELDSET (draft)
- TBD (populate only after sufficient SAFE evidence)

## Discovery Runs
| run_id | field | value_pattern | write_result | read_back_result | error_code | SAFE/UNSAFE | notes |
|---|---|---|---|---|---|---|---|
| (example) 20260303-ab12cd | ItemDescription | marker:v2a-001 | PASS | PASS (marker confirmed) | 0 | SAFE | first probe |

## Promotion Checklist Snapshot
- [ ] SAFE_FIELDSET documented
- [ ] 3 consecutive PASS runs
- [ ] PASS runs have different run_id
- [ ] All PASS include read-back verification
- [ ] No open write-related issues in FAILURE_REGISTRY
- [ ] User command received: "Promote v2 to gate."
