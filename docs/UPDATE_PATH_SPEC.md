# UPDATE_PATH_SPEC (SSOT)

## 1) Entrypoint command (deterministic)

```bash
cd backend
QOO10_WRITE_APPROVED=1 npm run test:qoo10:update:overwrite
```

> Optional fixed target:
> `QOO10_UPDATE_TARGET_ITEM_CODE=<existing_item_code>`

---

## 2) Update method (proven)

- **Method:** `ItemsBasic.UpdateGoods`
- **Read-back method:** `ItemsLookup.GetItemDetailInfo`
- **Entity list/count method (accumulation guard):** `ItemsLookup.GetAllGoodsInfo`

Reference source (repo history, test/scripts):
- `backend/qoo10/updateGoods.js` (historical path in git, API method declaration)
- `scripts/qoo10-auto-register.js` (historical path in git, UPDATE flow using `ItemCode`)

---

## 3) Targeting identifiers

- **Primary key:** `ItemCode` (existing Qoo10 entity)
- **Secondary check:** `SellerCode` (read-back metadata consistency)
- **Rule:** key fields (`ItemCode`, category key) remain fixed across consecutive runs.

Target selection policy in probe:
1. `QOO10_UPDATE_TARGET_ITEM_CODE` 있으면 해당 값 사용
2. 없으면 `ItemsLookup.GetAllGoodsInfo`에서 `S1` 우선, 없으면 `S2` 첫 엔티티 사용

---

## 4) Minimal payload (known-good for this repo/account)

아래 필드 세트가 현재 계정에서 `ItemsBasic.UpdateGoods` 성공으로 검증됨.

- `returnType`: `application/json`
- `ItemCode`: `<existing item code>`
- `SecondSubCat`: `<detail.SecondSubCatCd>`
- `ItemTitle`: `<original + run_id marker>`
- `ItemPrice`: `<detail.SellPrice normalized integer string>`
- `ItemQty`: `<detail.ItemQty>`
- `AvailableDateType`: `0`
- `AvailableDateValue`: `2`
- `ShippingNo`: `<detail.ShippingNo>`
- `StandardImage`: `<detail.ImageUrl>`
- `ItemDescription`: `<detail.ItemDetail>`
- `TaxRate`: `S`
- `ExpireDate`: `<detail.ExpireDate>`
- `AdultYN`: `<detail.AdultYN>`
- `RetailPrice`: `<detail.RetailPrice normalized>`
- `ProductionPlaceType`: `2`
- `ProductionPlace`: `Overseas`
- `Weight`: `1`

### Constraints
- `ItemsBasic.SetNewGoods` 사용 금지 (누적 생성 리스크)
- 동일 `ItemCode`에 대해 2회 연속 업데이트 수행
- 업데이트마다 **정확히 1개 비키 필드(ItemTitle)** 만 run_id marker로 변경
- read-back에서 marker 일치 확인 실패 시 즉시 STOP
- 상태별 총 아이템 수 변화 시 accumulation signal로 STOP

---

## 5) Environment prerequisites

- `QOO10_SAK` (필수)
- `QOO10_WRITE_APPROVED=1` (필수, write gate)
- `QOO10_UPDATE_TARGET_ITEM_CODE` (선택, 고정 타깃)
- `backend/.env` 로드 가능해야 함

---

## 6) Evidence output

프로브 성공 시 JSON 증적 파일 생성:

- `backend/logs/qoo10-update-overwrite-proof-<runBase>.json`

포함 내용:
- target item code / seller code
- update 2회 결과 및 read-back title
- status totals before/after
- accumulation signal 여부