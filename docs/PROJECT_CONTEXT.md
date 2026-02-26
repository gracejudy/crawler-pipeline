# PROJECT_CONTEXT (CORE: crawler-pipeline)

## 목적
Qoo10 마켓 상품을 API 기반으로 등록/업데이트하는 코어 파이프라인.

## 스코프
- 상품 등록/수정 API 연동 로직
- 실행/검증 런북 및 운영 안정화
- backend → src 구조 전환(리스크 최소 방식)

## 현재 기준 상태
- 마이그레이션 사전 검토/기준선 캡처 완료
- backend/src 경로 공존 상태에서 전환 단계 진행
- 최신 진행사항은 `docs/CURRENT_TASK.md`를 단일 진실원으로 사용

## 작업 원칙
1. 코어 작업 시 Dashboard 변경 금지(명시적 요청 제외)
2. 런타임 영향이 큰 변경은 단계적 전환 + 즉시 롤백 가능 구조 우선
3. 문서(`CURRENT_TASK.md`, 런북)와 코드 상태를 항상 동기화

## 관련 핵심 파일
- `docs/CURRENT_TASK.md`
- `docs/RUNBOOK.md` (존재 시)
- `backend/**`
- `src/**`

## 최근 진행 상태 스냅샷 (2026-02-26 19:28 KST)
- CORE 자체 로직 변경은 보류 상태 유지
- 우선순위는 backend→src 마이그레이션 트랙 재개 준비
  - 다음 핵심 결정: import 경로 정리 범위 확정
- 대시보드 트랙 분리 운영 원칙 유지(코어 변경과 분리)

## 비고
Dashboard 관련 작업은 별도 프로젝트 컨텍스트(`dashboard/docs/PROJECT_CONTEXT.md`)를 따른다.
