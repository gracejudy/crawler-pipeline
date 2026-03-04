# SHADOW_DAY_REPORT (Proactive Factory v1)

## Context
- Date: 2026-03-03
- Window simulated: 08:00–11:00 KST
- Scope: crawler-pipeline CORE, backend gate/smoke only
- Concurrency target: 2
- Merge mode: disabled (**Shadow Day: no merge performed**)
- v1_triggered: true
- v1_skip_reason: N/A (this run explicitly executed v1)

## Candidate READY Tasks (analysis-only pick, no implementation)
Now 우선 정책으로 2개 후보 선정:
1. CORE-T04 — 옵션 value 텍스트 수집 구현/검증
2. CORE-T05 — 상세페이지 이미지 URL 전체 수집 로직 반영/검증

> 본 Shadow Day에서는 bootstrap 검증만 수행하며, 위 작업의 구현은 진행하지 않음.

## Gate Execution
- Command: `cd backend && npm run gate`
- Smoke inside gate: `npm run smoke:readonly`
- Smoke method: `ItemsLookup.GetSellerDeliveryGroupInfo` (official read-only)
- Write path (`npm run test:qoo10:write`) excluded from gate and approval-gated

### Parallel run (2 workers)
Exit codes:
- Gate #1: `2`
- Gate #2: `2`

Key output lines:
- Gate #1
```json
{"run_id":"1772535957958-a5zh0w","attempt":1,"tag":"auth","ok":false,"ts":"2026-03-03T11:05:57.958Z","summary":"QOO10_SAK missing; blocked without retry"}
```
- Gate #2
```json
{"run_id":"1772535957958-rn4dmg","attempt":1,"tag":"auth","ok":false,"ts":"2026-03-03T11:05:57.958Z","summary":"QOO10_SAK missing; blocked without retry"}
```

## Failure Classification Behavior
- Detected tag: `auth`
- Trigger condition: `QOO10_SAK` 미설정
- Policy behavior: auth는 attempt 1에서 즉시 BLOCKED, 추가 retry 없음
- Observed behavior: 정책대로 동작 (retry 미실행)

## Parallel Safety Assessment
- 두 프로세스가 같은 시각에 실행되어도 `run_id`가 분리됨:
  - `1772535957958-a5zh0w`
  - `1772535957958-rn4dmg`
- 파일 로그도 run_id별 격리 (`backend/.logs/gate/<run_id>.log`)
- 공유 파일 overwrite/경합 없음
- 결론: gate wrapper 수준 병렬 안전성 양호

## Risks
1. **Auth prerequisite risk (High)**
   - `QOO10_SAK` 없으면 항상 즉시 BLOCKED
2. **Transient API/network false negatives (Medium)**
   - 실운영에서는 `network/api` 재시도 결과의 원인추적 필요
3. **Unknown tag handling (Medium)**
   - 모델 tier escalation은 정책 문서에 있으나 실행 오케스트레이터 연결 필요

## Recommended v1 Adjustments
1. 실행 시작 전 `QOO10_SAK` health precheck를 루프 최상단에 추가
2. `network/api` 실패 시 시도 간 backoff 값을 설정파일화(현재 고정 1s/2s)
3. `unknown` 발생 시 escalated-run 기록 필드(예: `escalated:true`)를 로그에 추가
4. 동일 task의 strike 누적 저장소(예: `backend/.logs/gate/strikes.json`) 도입 검토

## GO / NO-GO (for tomorrow autonomous run)
- **Decision: NO-GO (current state)**
- Reason: auth prerequisite (`QOO10_SAK`) 미충족으로 즉시 BLOCKED 재현
- Go 조건:
  1. runtime env에 `QOO10_SAK` 설정 확인
  2. gate 2회 병렬 샘플에서 pass 재확인
  3. 동일 task strike 누적/해제 기준 운영 문구 확정

## Evidence Files
- `backend/.logs/gate/1772535957958-a5zh0w.log`
- `backend/.logs/gate/1772535957958-rn4dmg.log`
