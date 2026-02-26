# WORKFLOW_GUARDRAIL

작업 혼선을 막기 위한 최소 규칙(강제).

## 0) 시작 전 공통 원칙
- 추정으로 시작하지 않는다.
- 컨텍스트 파일 누락 시 작업을 진행하지 않는다.
- 트랙 선언 없는 수정/커밋 금지.

## 1) TRACK 선언 (필수)
작업 시작 메시지 첫 줄에 아래 중 하나를 명시한다.

- `TRACK: CORE(crawler-pipeline)`
- `TRACK: DASHBOARD`

## 2) 컨텍스트 파일 존재/로딩 게이트 (필수)
아래 파일을 먼저 확인하고 읽는다.

- CORE: `/Users/judy/dev/crawler-pipeline/docs/PROJECT_CONTEXT.md`
- DASHBOARD: `/Users/judy/dev/crawler-pipeline/dashboard/docs/PROJECT_CONTEXT.md`
- 공통 실행 상태: `/Users/judy/dev/crawler-pipeline/docs/CURRENT_TASK.md`

규칙:
- 파일이 없거나 읽기 실패 시 즉시 보고하고 **작업 보류**.
- 누락 상태에서 코드 수정/실행/커밋 금지.

## 3) 범위 고정 문장 (필수)
작업 시작 시 아래 포맷으로 범위를 고정한다.

- `SCOPE: <허용 경로들>`
- `NO-TOUCH: <금지 경로들>`

예시:
- `SCOPE: dashboard/**`
- `NO-TOUCH: backend/**, src/**`

## 4) 종료 보고 포맷 (필수)
작업 종료 시 아래 4줄을 항상 포함한다.

1. `의도 트랙: ...`
2. `실제 수정 파일: ...`
3. `커밋: ...`
4. `다음 액션: ...`

의도 트랙과 실제 수정 파일이 불일치하면 `혼선 발생`으로 표시하고 재확인 후 진행한다.

---

## 빠른 시작 템플릿

```txt
TRACK: <CORE(crawler-pipeline) | DASHBOARD>
CONTEXT: <읽은 파일 목록>
SCOPE: <허용 경로>
NO-TOUCH: <금지 경로>
GO/WAIT: <진행 여부>
```
