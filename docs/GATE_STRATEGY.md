# GATE_STRATEGY (v1 / v2 / v3)

## 목적
- v2 overwrite-only 안전성 확보 전까지 write 자동화를 제한한다.
- read-only 신호와 write 증적을 분리해 운영한다.

## v1 — Read-only Gate (기본 진단)
- 명령: `cd backend && npm run gate`
- 스크립트: `backend/scripts/qoo10.smoke.readonly.js`
- API: `ItemsLookup.GetSellerDeliveryGroupInfo`
- 성격: 읽기 전용, 누적/변형 없음

## v2 — Write Probe Gate (승인 필요)
- 기본값: 비활성
- 명령: `cd backend && QOO10_WRITE_APPROVED=1 npm run test:qoo10:update:overwrite`
- API:
  - update: `ItemsBasic.UpdateGoods`
  - read-back: `ItemsLookup.GetItemDetailInfo`
  - accumulation guard: `ItemsLookup.GetAllGoodsInfo`
- 목표: 동일 엔티티 2연속 overwrite + read-back 증적 확보

## v3 — Discovery Gate (v2a 이후)
- 전제: v2 overwrite 증적 통과
- 범위: 상위 필드군 점진 탐색 (Tier1 -> Tier2)
- 원칙: 단일 필드 변이, 즉시 read-back, 실패 즉시 중단

---

## 실행 정책
- Discovery default: `QOO10_WRITE_APPROVED=1`
- Promotion requires explicit command: **"Promote v2 to gate"**
- Promotion 이후:
  - `QOO10_WRITE_APPROVED=0`
  - `QOO10_WRITE_GATE=1`

---

## STOP 규칙
아래 중 하나라도 충족하면 즉시 중단:
1. read-back 불가 또는 marker 불일치
2. 누적 생성 신호(상태별 총 아이템 수 변화 등)
3. 업데이트 응답이 성공(0)이나 필드 반영 불일치
4. 승인 게이트 미충족 (`QOO10_WRITE_APPROVED!=1`)