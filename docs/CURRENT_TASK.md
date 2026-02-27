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

## 진행 업데이트 (2026-02-23 17:07 KST)
- 다음 마이그레이션 범위 확정: **스크립트 기본 경로 전환** 우선 적용
  - 이유: import 경로 정리보다 런타임 리스크가 낮고 롤백이 즉시 가능
- 반영 기준:
  - `backend/package.json`의 `start`를 `src` 진입점으로 전환
  - fallback용 `start:legacy` 유지

## 진행 업데이트 (2026-02-23 21:48 KST)
- RoughDiamond Dashboard 신규 구축/배포 완료
  - URL: `https://roughdiamond-dashboard.vercel.app`
  - Basic Auth: 활성 (`roughdiamond-8921`)
  - OpenClaw 세션 연동 대상: `agent:main:main`
- HOTFIX TASK 10 반영 완료
  - `/api/openclaw/send|history|health` 프록시 라우트 추가
  - Chat Send 배선 보강(클릭 핸들러/전송 상태/오류·타임아웃 표시/구조화 로그)
  - Qoo10 실행 버튼 RUNNING 잠금/상태 배지 반영
  - Overview 카드화 + 모바일 안전영역/하단 네비 안정화
- 작업 브랜치
  - `oc/roughdiamond-dashboard` (origin push 완료)

## 진행 업데이트 (2026-02-26 19:28 KST)
- Dashboard 트랙 상태 동기화 완료(세션 초기화 대비)
- OpenClaw Chat send 성공 판정 로직 보강 완료
  - `/api/openclaw/send`에서 upstream payload 보수 판정 + 타입 안정화 반영
- Overview 개선 완료
  - 프로젝트 2개(CORE/DASHBOARD) 구분 표시
  - context 경로 Copy/Open 버튼 추가
  - 프로젝트별 task 리스트(접기/펴기) + 상태 태그 반영
- Task 제어 버튼 반영
  - `실행/중지/롤백` 버튼 추가
  - DONE task는 실행 버튼 숨김
  - 중지 시 롤백 필요 안내 후 rollback 준비 상태로 전환
  - TODO + rollbackReady 조건에서만 롤백 버튼 노출
- 최신 배포 반영 완료
  - `https://roughdiamond-dashboard.vercel.app` alias 갱신

## 진행 업데이트 (2026-02-27 12:30 KST)
- Dashboard 1차 목표를 `관측 중심`으로 재정의
  - 제어 기능은 2차 고도화로 이관 결정
- Task/Issue 구조 업데이트
  - 신규 task: `DASH-T06`~`DASH-T12` 등록
  - 신규 issue: `DASH-I04`, `DASH-I05` 등록
  - `DASH-T10` 완료 처리(1차 목표에서 제어 기능 제외 기준 확정)
- `DASH-T11` 착수
  - task 영역 실행/중지/롤백 버튼 제거 반영(1차)
- 연결 안정화 이슈
  - quick tunnel 단절 시 OPENCLAW_BASE_URL 무효화로 send 실패 재발
  - 근본 조치 task: `DASH-T09`(named tunnel 고정) 진행 중

## 진행 업데이트 (2026-02-27 12:45 KST)
- `DASH-T11` 완료 처리
  - task/issue 제어 버튼 제거 상태 유지 확인
  - overview 코드 내 제어 상태 필드(`isRunning`, `rollbackReady`, `isActing`) 정리
  - 롤백 포인트: dashboard 변경 커밋 `chore(dashboard): finish DASH-T11 remove control-state remnants`

## 진행 업데이트 (2026-02-27 12:55 KST)
- `DASH-T12` 완료 처리
  - stash 태그 유지 대상 확정: `DASH-T06`, `DASH-T09`, `DASH-T10`, `DASH-I02`, `DASH-I05`
  - 위 대상만 `제어 기능은 2차 고도화(stash)` 태그 유지
  - 나머지 task/issue의 stash 태그 제거
  - Overview에 `Stash (2차 고도화 이관)` 섹션 추가 후 대상 항목 이동

## 다음 액션
1. Dashboard: `DASH-T09` named tunnel 고정(Cloudflare 로그인 완료 후 터널 영구화)
2. CORE: backend→src 마이그레이션 트랙 재개(import 경로 정리 범위 확정)
