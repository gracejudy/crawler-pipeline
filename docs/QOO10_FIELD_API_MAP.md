# QOO10_FIELD_API_MAP.md

> **목적:** Qoo10 QAPI에서 각 상품 필드를 실제로 제어하는 엔드포인트를 매핑한 문서.
> **작성일:** 2026-03-05
> **데이터 출처:** 실험적 API 탐색 + 실제 응답 분석 (테스트 아이템 ItemCode: 1194045329)

---

## 1. 핵심 발견 요약

| 구분 | 내용 |
|---|---|
| UpdateGoods 성공 후 ItemTitle 반영 | ✅ 즉시 반영 (readBackAttempts: 1, delay ~0ms) |
| UpdateGoods 성공 후 ItemQty 반영 | ❌ **반영 안 됨** — 14초 대기 후에도 원본값 유지 |
| UpdateGoods 성공 후 ItemDescription 반영 | ❌ **반영 안 됨** — 14초 대기 후에도 원본값 유지 |
| ChangedDate 갱신 여부 | ✅ 갱신됨 (API는 성공, 필드만 무시됨) |
| 재고 전용 API 존재 여부 | ❌ 확인 불가 (ItemsInventory, ItemsStock 서비스 없음) |
| 설명 전용 API 존재 여부 | ❌ 없음 (SetDescription, UpdateDescription 메서드 없음) |

**핵심 결론: UpdateGoods는 ItemQty, ItemDescription을 수락(ResultCode=0)하지만 실제로 반영하지 않는다. propagation delay가 아닌 필드 선택적 무시(field-selective ignore) 현상.**

---

## 2. 필드별 API 매핑 테이블

| Field | API Endpoint | Update 가능 여부 | 비고 |
|---|---|---|---|
| ItemTitle | `ItemsBasic.UpdateGoods` | ✅ **YES** | 즉시 반영 확인 (2026-03-04 overwrite-proof 3회) |
| ItemPrice | `ItemsBasic.UpdateGoods` | 🔲 미검증 | 페이로드에 포함되나 검증 실험 없음 |
| ItemQty | `ItemsBasic.UpdateGoods` | ❌ **NO (실질적)** | ResultCode=0이나 반영 안 됨. 별도 API 없음 |
| ItemDescription | `ItemsBasic.UpdateGoods` | ❌ **NO (실질적)** | ResultCode=0이나 반영 안 됨. 별도 API 없음 |
| SecondSubCat | `ItemsBasic.UpdateGoods` | 🔲 미검증 | 필수 파라미터로 포함 |
| ShippingNo | `ItemsBasic.UpdateGoods` | 🔲 미검증 | |
| StandardImage | `ItemsBasic.UpdateGoods` | 🔲 미검증 | |
| ExpireDate | `ItemsBasic.UpdateGoods` | 🔲 미검증 | |
| AdultYN | `ItemsBasic.UpdateGoods` | 🔲 미검증 | |
| RetailPrice | `ItemsBasic.UpdateGoods` | 🔲 미검증 | |
| Options (variant) | `ItemsOptions.*` | ❌ **서비스 없음** | "Can't find service Name ItemsOptions" |
| Option Qty | `ItemsOptions.*` | ❌ **서비스 없음** | ItemsOptions 전체 그룹 미존재 |

---

## 3. 존재 확인된 QAPI 서비스 그룹

| Service Group | 존재 여부 | 확인 방법 |
|---|---|---|
| `ItemsBasic` | ✅ | SetNewGoods, UpdateGoods 응답 확인 |
| `ItemsLookup` | ✅ | GetItemDetailInfo, GetAllGoodsInfo, GetGoodsOptionInfo 응답 확인 |
| `ItemsOrder` | ✅ (메서드 미확인) | "Can't find method" 반환 = 서비스는 존재 |
| `ItemsOptions` | ✅ (메서드 미확인) | "Can't find method" 반환 = 서비스는 존재 |
| `ShippingBasic` | ✅ | GetShippingInfo 응답 확인 |
| `ItemsInventory` | ❌ | "Can't find service Name ItemsInventory" |
| `ItemsStock` | ❌ | "Can't find service Name ItemsStock" |
| `ItemsGift` | ❌ | "Can't find service Name ItemsGift" |
| `ItemsPromotion` | ❌ | "Can't find service Name ItemsPromotion" |
| `GoodsOption` | ❌ | "Can't find service Name GoodsOption" |

---

## 4. ItemsBasic 서비스 내 확인된 메서드

| Method | 존재 여부 | 비고 |
|---|---|---|
| `SetNewGoods` | ✅ | 신규 등록 (금지 대상) |
| `UpdateGoods` | ✅ | 기존 수정 (현재 사용 중) |
| `GetGoodsInfo` | ❌ | 미존재 |
| `SetGoodsSaleYN` | ❌ | 미존재 |
| `SetItemQty` | ❌ | 미존재 |
| `SetStandNormalItemQty` | ❌ | 미존재 |
| `UpdateGoodsQty` | ❌ | 미존재 |
| `SetDescription` | ❌ | 미존재 |
| `UpdateDescription` | ❌ | 미존재 |

---

## 5. ItemsLookup 서비스 내 확인된 메서드

| Method | 존재 여부 | 비고 |
|---|---|---|
| `GetItemDetailInfo` | ✅ | 상품 상세 조회 (현재 사용) |
| `GetAllGoodsInfo` | ✅ | 상태별 전체 상품 수 조회 |
| `GetGoodsOptionInfo` | ✅ | 옵션 조회 (현재 테스트 아이템 옵션 없음 → ResultObject: []) |
| `GetGoodsList` | ❌ | 미존재 |
| `GetStockInfo` | ❌ | 미존재 |
| `GetInventoryList` | ❌ | 미존재 |
| `GetGoodsDescription` | ❌ | 미존재 |

---

## 6. GetItemDetailInfo 응답 필드 목록

```
ItemNo, ItemStatus, ItemTitle, MainCatCd, MainCatNm,
FirstSubCatCd, FirstSubCatNm, SecondSubCatCd, SecondSubCatNm,
SellerCode, IndustrialCode, RetailPrice, SellPrice, SettlePrice,
ItemQty, ExpireDate, ManufacturerCd, ManufacturerNm,
BrandCd, BrandNm, AdultYN, ShippingNo, ContactTel,
ItemDetail, ImageUrl, ListedDate, ChangedDate
```

---

## 7. 실험 데이터 (근거)

### 7-1. ItemTitle 즉시 반영 확인
- 출처: `backend/logs/qoo10-update-overwrite-proof-97437740.json`
- 날짜: 2026-03-04
- UpdateGoods → GetItemDetailInfo 1회 read → 매칭 성공 (readBackAttempts: 1)
- 3회 독립 실험 모두 동일 결과

### 7-2. ItemQty 반영 안 됨 확인
- 출처: `backend/logs/v2a-field-discovery-v2a-1772680046718-e1gq3.jsonl`
- 날짜: 2026-03-05
- UpdateGoods (ItemQty: 99 → 1), ResultCode: 0, ResultMsg: "SUCCESS"
- 즉시 + 2s + 4s + 8s 대기 총 4회 read-back → final_read_value: "99" (원본)
- ChangedDate는 갱신됨 → API 수락은 됨, 반영은 안 됨

### 7-3. ItemDescription 반영 안 됨 확인
- 출처: 동일 실험 로그 (ItemDescription trial)
- UpdateGoods (marker 추가), ResultCode: 0
- 14,000ms / 4 reads → 마커 미발견, final_read_value 원본 그대로

### 7-4. 2026-03-05 현재 실제 상태 (실험 종료 후 1시간 뒤 확인)
```json
{
  "ItemQty": "99",
  "ItemDetail": "<p>Test item for debugging SetNewGoods</p>",
  "ChangedDate": "2026-03-05 12:07:41"
}
```

---

## 8. 가설 및 해석

### 가설 A: 필드 레벨 권한 제한 (가장 유력)
- Qoo10 판매자 계정 등급에 따라 UpdateGoods에서 수정 가능한 필드가 제한될 수 있음
- ItemTitle은 허용, ItemQty/ItemDescription은 별도 관리 채널(웹 UI 전용)일 가능성
- **근거:** ItemStatus "S2" (판매중) 상태에서 수량 변경 제한이 걸릴 수 있음

### 가설 B: S2 상태 필드 잠금
- 판매 중(S2) 상태의 상품은 수량·설명을 API로 직접 수정 불가하고 별도 재고 관리 플로우 필요
- **근거:** ItemStatus S2 + API 수락 but 미반영 패턴

### 가설 C: QAPIVersion 문제
- UpdateGoods에는 1.0 버전 사용 중. 일부 필드는 1.1+에서만 수정 가능할 수 있음
- **근거:** SetNewGoods는 1.1 사용, UpdateGoods는 1.0 사용

### 가설 D: ItemsOptions 서비스를 통한 재고 관리
- 옵션이 없는 단순 상품도 ItemsOptions 서비스가 재고 관리를 담당할 수 있음
- **현 상태:** ItemsOptions 서비스 존재 확인됨, 유효 메서드 미발견

---

## 9. 권장 다음 실험

우선순위 순:

1. **QAPIVersion 1.1로 UpdateGoods 재시도** — ItemQty, ItemDescription 반영되는지 확인
2. **ItemStatus S1(판매 대기) 상태 아이템으로 동일 실험** — S2 잠금 가설 검증
3. **ItemsOptions 메서드 체계적 탐색** — 실제 재고 관리 API 존재 여부
4. **Qoo10 QSM 웹 UI 네트워크 트래픽 캡처** — 실제 수량/설명 수정 시 어떤 API 호출하는지 확인
5. **UpdateGoods QAPIVersion 1.1 + 필드 단독 전송** — 최소 페이로드로 재시도

---

## 10. 미조사 항목 (Seller Web UI 트래픽)

> 이 섹션은 Qoo10 QSM 셀러 웹 UI에서 상품 수정 시 실제 호출되는 API 엔드포인트 분석을 위한 공간.
> 브라우저 DevTools Network 탭 캡처 필요 (현재 미수행).

수행 방법:
1. https://qsm.qoo10.jp 로그인
2. 상품 수정 페이지 열기 (ItemCode: 1194045329)
3. 수량, 설명, 제목 각각 수정 후 저장
4. Network 탭에서 요청 URL + 파라미터 캡처
5. 이 문서 업데이트

---

_Last updated: 2026-03-05_
