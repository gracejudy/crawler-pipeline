# UPDATE_PATH_SPEC (SSOT)

## 1) Entrypoint command (deterministic, fixed test item only)

```bash
cd backend
QOO10_WRITE_APPROVED=1 npm run test:qoo10:update:overwrite
```

필수 env:
- `QOO10_TEST_ITEMCODE` (예: `1194045329`)

누락 시 동작:
- **BLOCKED (exit 2)** with clear message

---

## 2) Update method (proven)

- **Update:** `ItemsBasic.UpdateGoods`
- **Primary proof (read-back):** `ItemsLookup.GetItemDetailInfo`
- **Secondary evidence only:** `ItemsLookup.GetAllGoodsInfo`

Reference source (repo history, test/scripts):
- `backend/qoo10/updateGoods.js` (historical path in git)
- `scripts/qoo10-auto-register.js` (historical path in git, UPDATE flow using `ItemCode`)

---

## 3) Targeting identifiers

- **Primary key:** `ItemCode = process.env.QOO10_TEST_ITEMCODE`
- **Rule:** auto item selection 금지 (v2 overwrite probe / v2a discovery 모두)
- **Same entity invariant:**
  - before/after read-back에서 `ItemNo === QOO10_TEST_ITEMCODE` 이어야 함

---

## 4) Minimal payload (known-good for this repo/account)

- `returnType`: `application/json`
- `ItemCode`: `<QOO10_TEST_ITEMCODE>`
- `SecondSubCat`
- `ItemTitle` (run_id marker 반영)
- `ItemPrice`
- `ItemQty`
- `AvailableDateType`: `0`
- `AvailableDateValue`: `2`
- `ShippingNo`
- `StandardImage`
- `ItemDescription`
- `TaxRate`: `S`
- `ExpireDate`
- `AdultYN`
- `RetailPrice`
- `ProductionPlaceType`: `2`
- `ProductionPlace`: `Overseas`
- `Weight`: `1`

### Constraints
- `ItemsBasic.SetNewGoods` 금지
- 동일 `ItemCode`로 2회 연속 update
- 각 run은 단일 비키 필드(marker 포함 title)만 변이
- read-back 불일치 시 즉시 STOP

---

## 5) Evidence rules

### Primary proof (필수)
`ItemsLookup.GetItemDetailInfo(ItemCode)` before/after로 아래를 확인:
1. **SAME ItemCode** (`ItemNo` 동일)
2. 변이 필드가 run_id marker를 반영

### Secondary evidence (보조)
- `ItemsLookup.GetAllGoodsInfo` 상태별 총량(before/after)
- 보조 참고값이며, primary proof를 대체하지 않음

---

## 6) Rollback / restore

프로브는 baseline을 저장:
- `backend/logs/qoo10-test-item-baseline-<QOO10_TEST_ITEMCODE>.json`

복구 명령:
```bash
cd backend
QOO10_WRITE_APPROVED=1 npm run test:qoo10:update:restore
```

복구 스크립트:
- baseline의 title/description/qty를 같은 ItemCode에 재적용
- read-back으로 item/title/qty 복구 일치 검증

---

## 7) Environment prerequisites

- `QOO10_SAK` (required)
- `QOO10_WRITE_APPROVED=1` (required for write/restore)
- `QOO10_TEST_ITEMCODE` (required; missing => BLOCKED exit 2)
- `backend/.env` readable