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
│   │                             # member.public.service.ts, member.public.route.ts (공개 API)
│   ├── repo/                     # repo.service.ts, repo.route.ts, repo-discovery.service.ts
│   ├── sync/                     # sync.service.ts, sync.admin.service.ts, sync.route.ts, github.service.ts
│   ├── blog/                     # blog.service.ts, blog.admin.service.ts, blog.route.ts
│   ├── cohort-repo/              # cohort-repo.service.ts, cohort-repo.route.ts
│   └── activity-log/             # activity-log.service.ts, activity-log.route.ts
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
    ├── admin.html                # 어드민 UI 마크업
    ├── admin.css                 # 어드민 스타일
    └── admin/                    # 어드민 동작 로직 (ES modules, entry: main.js)
        ├── main.js               # window 노출 + 초기화
        ├── state.js              # 공유 상태
        ├── http.js               # 인증 헤더, 오류 파싱
        ├── utils.js              # escapeHtml, toast 등
        ├── auth.js, bootstrap.js, logs.js, workspace.js
        ├── repos.js, members.js, sync.js, blog.js
        ├── regex.js, cohort-repos.js
```

`admin.html`은 `/admin/ui/admin/main.js`를 `type="module"`로 로드합니다.

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
npx prisma generate
node --import tsx src/db/seed.ts
npm run dev       # tsx watch로 핫리로드
```

### DB / Migration

- baseline migration 1개로 관리합니다.
  - `prisma/migrations/20260328190000_baseline/` — 현재 전체 스키마 기준선
- 로컬 DB를 새로 만들 때는 아래 순서를 권장합니다.

```bash
rm -f prisma/dev.db prisma/prisma/dev.db
npx prisma migrate deploy
node --import tsx src/db/seed.ts
```

- `seed`는 `workspace`만 생성합니다.
- 미션 레포는 어드민의 `후보 불러오기`로 다시 수집합니다.

## 스크립트

| 명령어              | 설명                  |
| ------------------- | --------------------- |
| `npm run dev`       | 개발 서버 (tsx watch) |
| `npm run build`     | TypeScript 빌드       |
| `npm run start`     | 빌드 결과 실행        |
| `npm run lint`      | ESLint 검사           |
| `npm run lint:fix`  | ESLint 자동 수정      |
| `npm run format`    | Prettier 포맷         |
| `npm run test:unit` | 단위 테스트           |
| `npm run seed`      | workspace seed        |

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
- **프로세스 관리**: PM2
- **웹서버**: Nginx (HTTPS, Rate limiting, 보안 헤더)

### 수동 배포

```bash
git push origin develop
ssh oracle "cd ~/app/backend && git pull --ff-only origin develop && npm run build && pm2 restart backend --update-env"
```

### PM2 명령어

```bash
ssh oracle "pm2 status"       # 앱 상태 확인
ssh oracle "pm2 logs backend" # 로그 확인
ssh oracle "pm2 restart backend" # 재시작
```

## 어드민 주요 기능

| 기능                 | 설명                                                                |
| -------------------- | ------------------------------------------------------------------- |
| 레포 후보 수집       | 조직 공개 레포 전체를 읽어 `candidate / excluded`로 저장            |
| 레포 탭 관리         | `기준 / 공통 / 제외 / 프리코스` 탭으로 분류하고 행 단위로 이동 가능 |
| 레포 설정            | 기수(cohorts), 레벨(level), 트랙, syncMode, 정규식, 탭 분류 관리    |
| 정규식 자동감지/검증 | PR 제목 샘플 기반 정규식 제안, active 레포 검증                     |
| 전체 / 단건 Sync     | SSE 진행률 표시, 레포별 수동 sync 지원                              |
| 블로그 동기화        | ON/OFF 토글, RSS 상태 저장, 최근 글 30일 보관 + 최신 7일 스냅샷     |
| 멤버 관리            | 역할 토글, manual nickname, 블로그, RSS 상태, 프로필 이미지 표시    |
| 프로필 갱신          | GitHub 프로필(avatar/blog/login) stale 갱신 + 멤버 단건 새로고침    |

## 공개 API

인증 없이 사용 가능한 엔드포인트입니다.

| 엔드포인트               | 설명                                   |
| ------------------------ | -------------------------------------- |
| `GET /members`           | 멤버 검색 (`?q=&cohort=&track=&role=`) |
| `GET /members/feed`      | 최근 블로그 피드 (`?cohort=&track=`)   |
| `GET /members/:githubId` | 멤버 상세 (archive, blogPosts 포함)    |

`GET /members/:githubId` 응답의 `archive` 필드는 해당 멤버 기수의 `CohortRepo` 순서 기반으로 레벨별 그룹핑된 미션 PR 목록입니다.

## 현재 데이터 모델 포인트

- `MissionRepo.tabCategory` — `base | common | excluded | precourse`
- `MissionRepo.status` — `active | candidate | excluded`
- `Member.githubUserId` — GitHub login 변경에도 유지되는 내부 식별자
- `Member.previousGithubIds` — 과거 GitHub login 이력 JSON
- `Member.avatarUrl` — GitHub profile의 `avatar_url` 저장 (파일 저장 아님)
- `Member.profileFetchedAt` / `Member.profileRefreshError` — 프로필 갱신 시각 / 실패 원인
- `Member.rssStatus` — `unknown | available | unavailable | error`
- `Member.lastPostedAt` — RSS 수집 시 가장 최근 글의 publishedAt 저장 (30일 초과 시에도 유지)

## 프로필 갱신 원칙

- PR sync 시 `githubUserId`가 있으면 해당 값을 기준으로 멤버를 식별합니다.
- GitHub login(`githubId`)이 바뀌어도 같은 `githubUserId`면 기존 멤버를 갱신합니다.
- 예전 login은 `previousGithubIds`에 남겨 검색/상세 조회 fallback에 사용합니다.
- 공개 API에는 `githubUserId`를 노출하지 않습니다.
- 어드민에서는:
  - `Members > 프로필 새로고침` — stale 프로필 일괄 갱신
  - 각 멤버 행의 `프로필` 버튼 — 단건 강제 새로고침

## 버전 로드맵

| 버전 | 주요 기능                                                | 상태    |
| ---- | -------------------------------------------------------- | ------- |
| v1   | 크루 검색, 미션 레포/PR 조회, 어드민 페이지, 블로그 수집 | 완료    |
| v2   | 공개 API (멤버 검색/상세/피드), 프론트엔드 구현          | 진행 중 |
| v3   | GitHub 로그인, 팔로우                                    | 미정    |
| v4   | 오픈미션 워크스페이스 분리                               | 미정    |
