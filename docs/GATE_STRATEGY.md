# Gate Strategy (v1 / v2 / v3)

## 목적
- v1: 환경/연결성(신뢰 가능한 최소 신호)
- v2: 쓰기 경로의 제한적 검증(안전 필드셋 탐색 → 게이트 승격)
- v3: 풀 e2e 회귀(릴리즈급 검증)

---

## v1 — Read-only Gate (Baseline, Frozen)

### Command
- `cd backend && npm run gate`

### What it does
- Read-only smoke only:
  - ItemsLookup.GetSellerDeliveryGroupInfo (official lookup)

### Frequency
- Sparse (not daily):
  - Weekly OR every 3 days
- Diagnostic trigger:
  - Run v1 when v2 fails with unclear cause (auth/network/api/unknown)

### Pass/Fail
- PASS: exit 0
- FAIL: non-zero
- Classification: auth/network/api/unknown
- run_id required, parallel-safe logs required

### What it proves
- Qoo10 auth + basic network reachability + minimal API health

### What it does NOT prove
- write path correctness
- payload validity
- category permission

---

## v2 — Write Strategy (Redesigned)

## v2a — Field Discovery Mode (current)

### Goal
- Discover SAFE overwrite-only dataset before v2 gate promotion.

### Command (example)
- `cd backend && QOO10_WRITE_APPROVED=1 npm run test:qoo10:write`

### Rules
- Discovery phase: write tests allowed by default.
- Exactly ONE non-key field changed per run.
- Must perform write + read-back verification.
- SellerCode/entity key must remain fixed.
- No entity accumulation.

### Logging (mandatory)
- Log every attempt in `docs/V2_FIELD_DISCOVERY.md` with:
  - `{ run_id, field, value_pattern, write_result, read_back_result, error_code, SAFE/UNSAFE }`

### Failure tags
- permission
- auth
- network
- api
- validation
- approval-missing
- unknown

### Diagnostic rule
- If FAIL tag in (auth/network/api/unknown) → run v1
- If FAIL tag in (permission/validation/approval-missing) → do NOT run v1

---

## v2b — Write Gate Mode (future)
- Activated only after explicit promotion.
- Requires SAFE_FIELDSET.
- Runs only on approved days or as required by merge policy.

### Promotion rules (STRICT)
Promote only if:
1. SAFE_FIELDSET documented.
2. 3 consecutive PASS runs.
3. PASS runs have different run_id.
4. Read-back verification included.
5. No open write-related issues in FAILURE_REGISTRY.
6. User explicitly says: "Promote v2 to gate."

Upon promotion:
- `QOO10_WRITE_GATE=1`
- `QOO10_WRITE_APPROVED=0` (default block)
- policy/docs updated

---

## v3 — Full E2E Gate (Release Grade)

### Command
- `cd backend && QOO10_E2E_APPROVED=1 npm run test:e2e` (example)

### Scope
- End-to-end workflow:
  - input → transformation → Qoo10 write → post-check → (optional cleanup)
- Must include:
  - run_id correlation across steps
  - strict logging
  - rollback/cleanup strategy or overwrite-only strategy

### Frequency
- Rare:
  - Release day / major refactor / migration
- Never automatic without explicit approval

### Safety
- Dedicated test account or strict namespace
- Rate-limit guard + backoff
- Timeboxed execution

### Pass/Fail
- PASS: exit 0
- FAIL: exit 1
- BLOCKED: exit 2 (approval missing)

---

## Merge Policy coupling
- main merge is batch-approved by user (`MERGE_BATCH_ID`)
- Agent performs merge only for approved batch
- Gates required per PR type:
  - Read-only changes: v1 optional
  - write-impact changes:
    - discovery stage: v2a evidence required
    - promoted stage: v2b gate required
  - release: v3 required (approved)
