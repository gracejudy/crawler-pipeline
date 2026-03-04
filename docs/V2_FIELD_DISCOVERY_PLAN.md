# V2_FIELD_DISCOVERY_PLAN (after UPDATE_CONFIRMED)

## Preconditions
- `UPDATE_PATH_SPEC.md` 경로로 overwrite-only 증적이 이미 확보되어야 함.
- read-back API(`ItemsLookup.GetItemDetailInfo`)가 안정적으로 동작해야 함.

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
- 주의: 운영 영향 최소화 위해 S1 또는 지정 테스트 엔티티 우선

### C) ItemTitle
- 패턴: suffix marker 추가 후 길이 제한 내 유지
- 예: `... [V2A-<id>-TITLE]`

## Read-back assertions
- 공통:
  - same `ItemCode`
  - `ResultCode == 0`
- 필드별:
  - ItemDescription: marker 포함 여부
  - ItemQty: 기대 수량과 정확 일치
  - ItemTitle: marker 포함 여부

## UNSAFE stop rules
1. read-back 실패 또는 필드 반영 불일치
2. 동일 run에서 key field(`ItemCode`, category key) 변경 감지
3. 예상치 못한 엔티티 증가/상태 총량 이상징후
4. API/권한 오류 반복(동일 원인 2회)

## Execution gating
- Discovery default: `QOO10_WRITE_APPROVED=1`
- Promotion requires explicit command: **"Promote v2 to gate"**
- Promotion 후:
  - `QOO10_WRITE_APPROVED=0`
  - `QOO10_WRITE_GATE=1`