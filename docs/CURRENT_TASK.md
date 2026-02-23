# CURRENT_TASK

## Task
- backend → src 구조 마이그레이션 사전 검토/기준선 캡처 (소스코드 동작 영향 0 목표)

## 상태
- 승인됨 (2026-02-22 13:05 KST)
- 기준선 캡처 완료 (초기 예외 2건 기록)
- 워크스페이스 더티 상태 분리/보존 완료, `emergent` 정리 및 원격 동기화 완료 (2026-02-22 16:45 KST)
- 테스트 전체 통과 확인

## 예외
1. `QOO10_SAK` 미설정 이슈는 시크릿 반영 후 재검증에서 해소(통과)
2. macOS 기본 `timeout` 명령 미존재 이슈는 대체 방식으로 처리 완료

## 진행 업데이트 (2026-02-22 14:30 KST)
- Step 1(복제) 완료: `src/`에 진입점/모듈 복제
- Step 2(호환 진입점) 완료: `src/*`는 래퍼로 추가, `backend/*` 기존 실행 경로 유지
- Step 3(스크립트 전환 준비) 반영:
  - `backend/package.json`에 `start`(기존), `start:src`(신규 경로 검증) 추가
  - `docs/RUNBOOK.md` 실행 명령을 스크립트 기준으로 정리
- 부팅 스모크체크: `node backend/index.js`, `node src/index.js` 모두 기동 확인

## 진행 업데이트 (2026-02-22 16:45 KST)
- 분리 브랜치 생성: `oc/wip-dirty-separate-20260222`
- 더티 상태 전체 스냅샷 커밋:
  - `0d1626c chore(wip): snapshot local dirty workspace after emergent push`
- `emergent` 복귀 후 정리 수행:
  - `git reset --hard origin/emergent`
  - `git clean -fd`
- 결과: 로컬 `emergent`가 깨끗한 상태로 `origin/emergent`와 동기화됨
- 테스트 결과: 전체 통과

## 다음 액션
1. 구조 변경 PR 생성/정리(무기능변경, before/after 기록 포함) — 초안: `docs/PR_IMPLEMENTATION_backend_to_src_step1_3.md`
2. 다음 마이그레이션 단계(스크립트 기본 경로 전환 또는 import 경로 정리) 착수 범위 확정
