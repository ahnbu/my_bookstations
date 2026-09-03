<!-- 생성물: AGENTS.md의 사본. 정본은 같은 폴더의 AGENTS.md이며 수정은 그쪽에서 한다.
     갱신: node ~/.claude/scripts/sync-project-rules.mjs --write
     @AGENTS.md 참조를 쓰지 않는 이유: 하위 폴더에서 작업하면 상위 CLAUDE.md의 import가
     전개되지 않아 규칙이 통째로 유실된다(2026-08-29 실측). -->

# Library Checker Rules

## 범위
- 이 폴더는 Cloudflare Worker 기반 도서관 재고 조회 런타임이다.
- 루트 Vite 앱과 배포·실행 표면이 다르므로 root package 명령과 혼동하지 않는다.

## 작업별 위치
- Worker entrypoint와 라우팅: `src/index.ts`
- API 응답 타입: `src/types.ts`
- 광주시 조회 예산·순차화: `src/gwangjuBudget.ts`
- Worker 설정과 배포: `wrangler.jsonc`, `package.json`
- 로컬 실행 설명: `README.md`

## 변경 규칙
- `.dev.vars`는 로컬 런타임 시크릿 표면이다. 값은 문서·로그·커밋에 포함하지 않는다.
- `temp/`와 `.wrangler/`는 진단·캐시 산출물이다. 정본 구현으로 보지 않는다.
- 도서관별 응답 파싱을 바꾸면 `_docs/도서관별 응답구조/`와 `_docs/DEVELOPMENT.md`의 설명을 함께 확인한다.
- 광주시 종이책·전자책 호출은 병렬화가 항상 이득이 아니다. timeout과 조회 예산 문서를 먼저 본다.

## 검증
- Worker 변경은 `library-checker` 폴더 기준으로 검증한다.
- 로컬 검증은 `wrangler dev --test-scheduled` 계열 실행과 실제 endpoint 응답 확인을 우선한다.
- 운영 반영은 `git push`가 아니라 `wrangler deploy` 성공, 배포 URL, Version ID로 보고한다.
