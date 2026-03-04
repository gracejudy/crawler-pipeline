# V2_FIELD_DISCOVERY_PLAN (after UPDATE_CONFIRMED)

## Preconditions
- `UPDATE_PATH_SPEC.md`의 overwrite-only 증적 통과 상태여야 함.
- read-back API(`ItemsLookup.GetItemDetailInfo`) 안정 동작 필요.
- **고정 테스트 아이템 강제:** `QOO10_TEST_ITEMCODE` 필수
  - 누락 시 **BLOCKED (exit 2)**
  - auto target selection 금지

## Fixed target rule (v2a)
- v2a discovery runner는 아래를 하드코딩 규칙으로 사용:
  - `ItemCode = process.env.QOO10_TEST_ITEMCODE`
- same entity invariant:
  - before/after `ItemNo === QOO10_TEST_ITEMCODE`

## Tier1 (Top 3)
1. `ItemDescription`
2. `ItemQty`
3. `ItemTitle`

## Mutation patterns

### A) ItemDescription
- 패턴: 기존 description 말미에 단일 marker 주석 추가
- 예: `<!--V2A-RUN-<id>-DESC-->`
- 주의: HTML 구조 파손 금지

### B) ItemQty
- 패턴: 작은 정수 증감(예: +1 / -1)

### C) ItemTitle
- 패턴: suffix marker 추가 후 길이 제한 내 유지
- 예: `... [V2A-<id>-TITLE]`

## Read-back assertions (primary proof)
- API: `ItemsLookup.GetItemDetailInfo(ItemCode)`
- 공통:
  - `ResultCode == 0`
  - `ItemNo == QOO10_TEST_ITEMCODE`
- 필드별:
  - ItemDescription: marker 포함 여부
  - ItemQty: 기대 수량과 정확 일치
  - ItemTitle: marker 포함 여부

## Secondary evidence (optional)
- `ItemsLookup.GetAllGoodsInfo` 상태별 총량 before/after
- 참고값이며 primary proof 대체 불가

## Rollback / restore
- 사전 baseline 저장: title/description/qty
- 복구 명령:
  - `cd backend && QOO10_WRITE_APPROVED=1 npm run test:qoo10:update:restore`
- 복구 검증:
  - same `ItemNo`
  - baseline title/qty 일치
  - description 복원

## UNSAFE stop rules
1. read-back 실패 또는 필드 반영 불일치
2. `ItemNo != QOO10_TEST_ITEMCODE`
3. key field 변경 감지
4. API/권한 오류 반복(동일 원인 2회)

## Execution gating
- Discovery default: `QOO10_WRITE_APPROVED=1`
- Promotion requires explicit command: **"Promote v2 to gate"**
- Promotion 후:
  - `QOO10_WRITE_APPROVED=0`
  - `QOO10_WRITE_GATE=1`