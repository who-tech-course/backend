# backend

우아한테크코스 크루 검색 서비스의 백엔드 서버.

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express
- **ORM**: Prisma (예정)
- **DB**: SQLite
- **Infra**: Oracle Cloud AMD, Nginx, PM2

## 프로젝트 구조

```
src/
└── index.ts       # 진입점
```

## 로컬 개발 환경 설정

### 사전 요구사항

- Node.js 20.18.0 (`.node-version` 참고)
- asdf 또는 nvm 사용 시 자동 버전 전환

```bash
npm install
npm run dev       # tsx watch로 핫리로드
```

## 스크립트

| 명령어             | 설명                  |
| ------------------ | --------------------- |
| `npm run dev`      | 개발 서버 (tsx watch) |
| `npm run build`    | TypeScript 빌드       |
| `npm run lint`     | ESLint 검사           |
| `npm run lint:fix` | ESLint 자동 수정      |
| `npm run format`   | Prettier 포맷         |

## 코드 컨벤션

- ESLint flat config (`eslint.config.ts`)
- Prettier: semi true, singleQuote true, printWidth 120
- pre-commit: lint-staged (변경 파일만 검사)
- commit-msg: commitlint (Conventional Commits)

## 브랜치 전략

```
main     ← 배포 브랜치 (PR + 리뷰 1명 필수)
develop  ← 통합 브랜치
feat/#이슈번호-설명
fix/#이슈번호-설명
chore/설명
```

## 서버 배포

- **서버**: Oracle Cloud AMD (iftype.store)
- **프로세스 관리**: PM2 (tsx로 TS 직접 실행)
- **웹서버**: Nginx (HTTPS, Rate limiting, 보안 헤더)

### 수동 배포

```bash
rsync -av --exclude='node_modules' --exclude='dist' --exclude='.git' \
  -e "ssh -i ~/.ssh/ssh-key-oracle.key" \
  ./ ubuntu@168.107.51.150:~/app/backend/

ssh oracle "cd ~/app/backend && npm install --ignore-scripts && pm2 restart backend"
```

> `--ignore-scripts` 필수: 서버에 .git이 없어 husky가 실패함

### PM2 명령어

```bash
ssh oracle "pm2 status"       # 앱 상태 확인
ssh oracle "pm2 logs backend" # 로그 확인
ssh oracle "pm2 restart backend" # 재시작
```

## 버전 로드맵

| 버전 | 주요 기능                                          |
| ---- | -------------------------------------------------- |
| v1   | 크루 검색, 미션 레포/PR 조회, 하루 1회 크론잡 수집 |
| v2   | GitHub 로그인, 팔로우, 관리자 페이지               |
| v3   | 블로그 새 글 감지                                  |
| v4   | 오픈미션 워크스페이스 분리                         |
| v5   | 워크스페이스 단위 조직 관리 (미정)                 |
