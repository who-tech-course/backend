# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

우아한테크코스 크루(멤버) 검색 서비스의 백엔드. GitHub 조직(`woowacourse`)의 미션 레포 PR을 수집해 멤버 정보를 저장한다.

- **조직**: https://github.com/who-tech-course
- **서버**: Oracle Cloud AMD, iftype.store, SSH: `ssh oracle`
- **PM2 앱 이름**: `backend`

## 주요 명령어

```bash
# 개발
npm run dev              # tsx watch 핫리로드

# DB
npx prisma migrate dev   # 마이그레이션 생성 + 적용
npx prisma migrate deploy # 프로덕션 마이그레이션 적용
npm run seed             # 초기 데이터 (workspace + 50개 레포)

# 테스트
npm run test:unit        # 유닛 테스트 (CI에서 실행)
npm run test:integration # 통합 테스트 (로컬, DB 필요)
NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/unit/foo.test.ts  # 단일 파일

# 린트/포맷
npm run lint:fix
npm run format
```

## 아키텍처

### 데이터 수집 흐름

```
MissionRepo (DB 등록) → fetchRepoPRs (GitHub API) → parsePRsToSubmissions → upsert Member/Submission
```

- `syncWorkspace`: DB에 등록된 레포만 수집 (동적 org 탐색 없음)
- `syncRepo`: 레포 PR 전체 페이지네이션 → 닉네임 파싱 → DB upsert
- 닉네임 정규식: 레포별 `nicknameRegex` 우선, 없으면 `Workspace.nicknameRegex` fallback
- 기수 판별: PR `created_at` 연도 → `cohortRules` JSON 매핑

### DB 스키마 핵심

- `Workspace`: githubOrg, nicknameRegex(기본값), cohortRules(JSON)
- `MissionRepo`: track(frontend|backend|android|**null=공통**), type(individual|integration), status(active|candidate|excluded), nicknameRegex(선택), cohortRegexRules(JSON)
- `Member`: githubId, nickname, manualNickname, nicknameStats(JSON), cohort, blog
- `Submission`: prNumber, prUrl, memberId, missionRepoId
- `BlogPost`: url, title, publishedAt, memberId (30일 보관)
- `BlogPostLatest`: url, title, publishedAt, memberId (7일 스냅샷, sync마다 전체 갱신)

### API 구조

```
GET  /admin/status                    — 수집 현황 (memberCount, lastSyncAt)
GET  /admin/workspace                 — workspace 설정 조회
PUT  /admin/workspace                 — nicknameRegex, cohortRules 수정
GET  /admin/repos                     — 미션 레포 목록 (?status=active|candidate|excluded)
POST /admin/repos                     — 레포 추가 (name, repoUrl, track, type?, nicknameRegex?, cohortRegexRules?)
POST /admin/repos/discover            — 조직 공개 레포 탐색 → candidate 갱신
PATCH /admin/repos/:id                — track, nicknameRegex, cohortRegexRules 등 수정
DELETE /admin/repos/:id               — 레포 + 관련 submission 트랜잭션 삭제
POST /admin/repos/:id/sync            — 단건 레포 sync
GET  /admin/repos/:id/detect-regex    — PR 샘플 기반 닉네임 정규식 자동 감지
POST /admin/sync                      — 전체 workspace sync 수동 실행
GET  /admin/members                   — 멤버 목록 (?q=&cohort=&hasBlog=)
PATCH /admin/members/:id              — manualNickname, blog 수정
DELETE /admin/members/:id             — 멤버 + submissions + blogPosts 삭제
POST /admin/blog/sync                 — 블로그 RSS 전체 sync
POST /admin/blog/backfill             — GitHub profile blog 백필 (?limit=30)
```

모든 `/admin` 엔드포인트는 `Authorization: Bearer <ADMIN_SECRET>` 필요.
어드민 UI: `GET /admin/ui/admin.html`

## 테스트 구조

- `__tests__/unit/` — mock 기반, DB 불필요. CI(`test.yml`)에서 실행
- `__tests__/integration/` — 실제 SQLite DB. 로컬에서만 실행
- `jest.config.cjs` 사용 (`"type": "module"` 때문에 `.ts` 불가)
- `@octokit`은 ESM이라 `transformIgnorePatterns`에서 별도 처리

## GitHub Actions

- `test.yml` — PR 시 unit 테스트 (develop/main 대상)
- `deploy.yml` — develop 푸시 시 SSH 자동 배포 (prisma migrate → pm2 restart)
- `sync.yml` — `workflow_dispatch` 수동 트리거 전용 (cron 없음)
  - Secrets 필요: `SYNC_URL` (서버 URL), `ADMIN_SECRET`
- `blog-check.yml` — 매시간 cron `POST /admin/blog/sync` 호출 (GitHub API 미사용, RSS only)

## PR/브랜치 규칙

```
feat/#이슈번호-설명 → develop PR → 머지
```

- **PR은 기능 완성 시에만** (중간 커밋 PR 금지)
- 커밋 메시지: Conventional Commits, subject 소문자
- PR 시 Gemini Code Assist 자동 리뷰

## 환경변수 (.env)

```
DATABASE_URL=file:./prisma/dev.db
GITHUB_TOKEN=...
ADMIN_SECRET=...
```

## 예정 작업

- 멤버 검색 API: `GET /members/search?q=`, `GET /members/:githubId`
- 블로그 RSS 체크 → GitHub Actions scheduled workflow
- Member.role 필드: crew | coach | applicant (v2~)
