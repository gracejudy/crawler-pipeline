# RUNBOOK

## 기본 실행 (기존 경로 유지)
```bash
cd backend
npm install
npm start
```

## 마이그레이션 검증 실행 (신규 경로)
```bash
cd backend
npm run start:src
```

## 테스트
```bash
cd backend
npm run test:qoo10:register
```

## 작업 시작 루틴
1. `git checkout main`
2. `git pull --ff-only origin main`
3. `git rev-parse HEAD` 기록
4. 작업 브랜치 생성: `oc/<short-task-name>`
