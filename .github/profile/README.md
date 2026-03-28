# who.tech

> 우아한테크코스 크루 검색 서비스

우아한테크코스 크루의 GitHub 미션 레포와 PR을 한 곳에서 탐색할 수 있는 서비스입니다.
닉네임 또는 아이디로 검색하면 해당 크루의 미션 아카이브와 블로그 피드를 확인할 수 있습니다.

## Repositories

| 레포                                                    | 설명                                      |
| ------------------------------------------------------- | ----------------------------------------- |
| [frontend](https://github.com/iftype/who-tech-frontend) | Next.js 15 (App Router) + Tailwind CSS v4 |
| [backend](https://github.com/iftype/who-tech-backend)   | TypeScript + Express + SQLite + Prisma    |

## Tech Stack

|          | 기술                                                       |
| -------- | ---------------------------------------------------------- |
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4, TanStack Query v5 |
| Backend  | TypeScript, Express, Prisma, SQLite                        |
| Infra    | Oracle Cloud AMD, Nginx, PM2                               |

## Branch Strategy

```
main      ← 배포 브랜치 (PR only)
develop   ← 통합 브랜치
feat/#이슈번호-설명
fix/#이슈번호-설명
chore/설명
```

## Commit Convention

```
feat:     새로운 기능
fix:      버그 수정
chore:    설정, 빌드 변경
docs:     문서 수정
refactor: 리팩토링
```
