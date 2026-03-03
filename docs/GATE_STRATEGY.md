# Gate Strategy (v1 / v2 / v3)

## 목적
- v1: 환경/연결성(신뢰 가능한 최소 신호)
- v2: 쓰기 경로의 제한적 검증(명시 승인 필요)
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

## v2 — Write Test Gate (Approved, Limited)

### Command
- `cd backend && QOO10_WRITE_APPROVED=1 npm run test:qoo10:write`

### Approval rule
- Without `QOO10_WRITE_APPROVED=1`:
  - MUST exit with BLOCKED (exit 2) and clear message

### Scope (must be explicit)
- One minimal write scenario only (lowest blast radius)
- Test category default: 300003183 (override allowed via env)
- Must use safe identifiers:
  - test SellerCode namespace / markers
  - no uncontrolled accumulation (prefer overwrite/update)

### Frequency
- On-demand only (explicit user approval)
- Typical: before merging write-impact PRs or after significant core changes

### Pass/Fail
- PASS: exit 0
- FAIL: exit 1
- BLOCKED: exit 2 (approval missing)

### Failure classification (required)
- permission (category/seller permission)
- auth
- network
- api
- validation
- unknown

### Diagnostic rule
- If FAIL and tag in (auth/network/api/unknown) → run v1 to disambiguate
- If FAIL and tag in (permission/validation) → do NOT run v1; treat as write-scope issue

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
  - write-impact changes: v2 required (approved)
  - release: v3 required (approved)
