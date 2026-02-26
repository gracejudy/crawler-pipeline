# MIGRATION_CHECKLIST (backend → src)

## 원칙
- 목표: 동작 영향 0 (API/응답/env/실행방식 동일)
- 기능 추가/변경 금지

## A. 기준선(Baseline)
- [ ] `git checkout main`
- [ ] `git pull --ff-only origin main`
- [ ] `git rev-parse HEAD` 기록
- [ ] `cd backend && node index.js` 기동 확인
- [ ] `npm run test:qoo10:register` 실행 결과 저장 (공식 문서 기반 스모크만)

## B. 마이그레이션 단계
### Step 1: 복제
- [x] `backend` 코드/스크립트를 `src`로 복제
- [x] 기존 `backend` 경로 유지

### Step 2: 호환 진입점
- [x] 기존 진입점/명령 유지
- [x] 새 경로 진입점은 래퍼 방식으로 추가

### Step 3: 스크립트 전환
- [x] npm scripts 기본 경로를 `src`로 전환 (`start` → `node ../src/index.js`)
- [x] fallback 스크립트 유지 (`start:legacy`)
- [ ] 전환 후 API 회귀 확인

### Step 4: 안정화
- [ ] fallback 기간 운영
- [ ] 문제 없을 때만 legacy 정리 PR 생성

## C. 회귀 검증
- [ ] `GET /api/qoo10/categories` 응답 구조 동일
- [ ] `POST /api/qoo10/refresh-key` 동작 동일
- [ ] `GET /api/qoo10/shipping-groups` 동작 동일
- [ ] (제외) 비공식 API `/api/qoo10/register` 는 회귀 검증 범위에서 제외
- [ ] 에러 응답 코드/메시지 포맷 동일
- [ ] 환경변수(`QOO10_SAK`, `PORT`, `QOO10_DEBUG`) 동작 동일

## D. PR 정책
- [ ] 구조 변경 PR과 기능 변경 PR 분리
- [ ] 모든 PR에 `(planning)` / `(implementation)` 명시
- [ ] 테스트 명령 및 결과 첨부
- [ ] 리스크/롤백 방법 명시

## E. 롤백
- [ ] 스크립트를 기존 backend 진입점으로 즉시 복귀
- [ ] 문제 PR revert
- [ ] 기준선 재검증
