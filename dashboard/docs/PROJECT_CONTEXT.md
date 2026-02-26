# PROJECT_CONTEXT (DASHBOARD: roughdiamond-dashboard)

## 목적
진행 중 프로젝트들의 상태를 한 화면에서 확인/제어하기 위한 운영 대시보드.

## 스코프
- Tasks / Logs / Chat / Registration 등 운영 UI
- OpenClaw 연동 프록시 라우트
- 헬스체크/상태표시/모바일 UX 개선

## 현재 역할 정의
- Dashboard는 **운영/관측/제어 인터페이스**다.
- Qoo10 상품 등록/업데이트의 실제 도메인 처리 로직은 CORE(crawler-pipeline)가 담당한다.

## 작업 원칙
1. Dashboard 작업 시 코어 비즈니스 로직 변경 금지(명시적 요청 제외)
2. API 프록시 응답 판정은 보수적으로(성공/실패 명확화)
3. UI 변경 시 로그/오류 노출 경로를 함께 점검

## 관련 핵심 파일
- `src/app/page.tsx`
- `src/app/api/openclaw/send/route.ts`
- `src/app/api/openclaw/history/route.ts`
- `src/app/api/openclaw/health/route.ts`

## 운영 참고
- 배포 URL/인증/연동 세션 등 운영값은 환경변수 및 배포설정 기준으로 관리
- 세부 진행 상태는 상위 `../docs/CURRENT_TASK.md`와 함께 확인
