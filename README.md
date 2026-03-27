# backend

우아한테크코스 크루 검색 서비스의 백엔드 서버.

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express
- **ORM**: Prisma
- **DB**: SQLite
- **Infra**: Oracle Cloud AMD, Nginx, PM2

## 프로젝트 구조

```
src/
├── index.ts                      # 진입점
├── app.ts                        # Composition root — DB/서비스/라우터 조립
├── db/
│   ├── prisma.ts                 # PrismaClient 싱글톤
│   ├── seed.ts                   # 초기 데이터
│   └── repositories/             # DB 접근 계층 (factory 함수)
│       ├── workspace.repository.ts
│       ├── member.repository.ts
│       ├── mission-repo.repository.ts
│       ├── submission.repository.ts
│       └── blog-post.repository.ts
├── features/                     # 기능 단위 모듈
│   ├── workspace/                # workspace.service.ts, workspace.route.ts
│   ├── member/                   # member.service.ts, member.route.ts
│   ├── repo/                     # repo.service.ts, repo.route.ts, repo-discovery.service.ts
│   ├── sync/                     # sync.service.ts, sync.admin.service.ts, sync.route.ts, github.service.ts
│   └── blog/                     # blog.service.ts, blog.admin.service.ts, blog.route.ts
├── shared/                       # 공통 유틸
│   ├── http.ts                   # asyncHandler, HttpError, badRequest
│   ├── validation.ts             # 요청 파싱/검증
│   ├── middleware/               # auth.ts, error.ts
│   ├── blog.ts                   # URL 정규화
│   ├── nickname.ts               # 닉네임 통계/정규화
│   ├── cohort-regex.ts           # 기수별 정규식 파싱
│   ├── constants.ts
│   └── types/
└── public/
    └── admin.html                # 어드민 UI (단일 파일)
```

### 의존성 주입 구조

```
app.ts (composition root)
  ├── new PrismaClient()
  ├── createOctokit()
  ├── create*Repository(db)     ← Prisma 직접 접근은 repository만
  ├── create*Service(repos)     ← repository 주입
  └── create*Router(service)    ← service 주입
```

각 service/router는 factory 함수로 구성되어 테스트 시 mock repository 주입이 가능합니다.

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

## 커밋 단위 가이드

작업 단위를 잘게 나눠서 커밋한다.

```
chore: 프로젝트 초기 설정 (tsconfig, package.json)
chore: eslint + prettier 설정
chore: husky + commitlint 설정
chore: vscode 설정 추가
feat: 로그인 api 추가
fix: 토큰 만료 오류 수정
docs: readme 업데이트
```

- 커밋 메시지는 소문자로 시작
- 한 커밋에 여러 관심사를 섞지 않는다
- subject는 72자 이내

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
