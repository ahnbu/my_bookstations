# 규칙 동기화
- 이 프로젝트 규칙은 `AGENTS.md`와 `CLAUDE.md`를 동기화하여 운영한다. 한쪽을 변경할 때는 다른 한쪽도 같은 의미로 함께 변경한다.

# My Bookstation 프로젝트 - Codex 설정

## 기본 언어 설정
- **기본 응답 언어**: 한국어
- 별도 요청이 없는 한 모든 응답은 한국어로 제공
- 코드 주석과 변수명은 영어 유지 (개발 관례)
- 사용자 인터페이스 텍스트는 한국어로 작성
- 커밋 메시지는 한국어로 작성

## 프로젝트 정보
- **프로젝트명**: My Bookstation (마이 북스테이션)
- **설명**: 경기도 광주시 지역 도서관 재고 검색 서비스
- **기술 스택**: Vite, React, TypeScript, Tailwind CSS, Supabase

## 작업별 정본 위치
- 앱 진입점과 전역 모달 배치: `App.tsx`, `components/`
- 내 서재 상태와 Supabase 저장: `stores/useBookStore.ts`
- 사용자 설정, 커스텀 태그, 자동 태그 규칙: `stores/useSettingsStore.ts`, `utils/autoTagRules.ts`
- 도서관 URL 생성과 재고 통합: `services/unifiedLibrary.service.ts`
- Cloudflare Worker 기반 도서관 조회: `library-checker/src/index.ts`, `library-checker/src/types.ts`
- 광주시 조회 예산·순차화 규칙: `library-checker/src/gwangjuBudget.ts`
- Supabase RPC·스키마 변경: `supabase/`, `docs/DEVELOPMENT.md`
- 회귀 테스트: `tests/*.test.mjs`
- 계획서·실행결과·검수보고서 등 문서 산출물: `docs/` (계획 검수는 `docs/plan-check/`, 완료 검수는 `docs/done-check/`). 전역 규칙의 `_docs/` 기본값 대신 이 위치를 우선한다.

## 저장 데이터 규칙
- `book_data`는 풍부한 도서 원본 JSON이고, `stock_*` 컬럼은 조회·갱신 가능한 최상위 저장값이다.
- `stock_*` 의미를 바꾸면 `types.ts`, `stores/useBookStore.ts`, Supabase SQL, `README.md`, `docs/DEVELOPMENT.md`를 함께 확인한다.
- 자동 태그는 설정 저장과 표시 병합이 분리되어 있으므로 `utils/autoTagRules.ts`, `stores/useSettingsStore.ts`, `stores/useBookStore.ts`를 함께 본다.
- 루트 `.env.local`과 `library-checker/.dev.vars`는 런타임 시크릿 표면이다. 값은 문서·로그·커밋에 포함하지 않는다.

## 검증 기준
- UI·컴포넌트 변경은 타입 확인만으로 완료하지 않고 실제 화면 또는 Playwright로 동작을 확인한다.
- 저장 로직 변경은 Supabase payload 형태와 로컬 store 상태 전이를 함께 확인한다.
- Worker 변경은 `git push`와 운영 배포를 구분한다. 필요 시 `wrangler deploy` 여부와 배포 URL/Version ID를 별도로 보고한다.
- 도서관 크롤링 변경은 대상 도서관 응답 구조와 사용자에게 보이는 재고 결과가 함께 맞는지 확인한다.

## 탐색 제외 경로
- `uploads_for_ai_studio/`는 AI Studio 업로드용 복제본이며 정본 코드로 보지 않는다.
- `temp/`, `docs/temp/`, `library-checker/temp/`, `library-checker/.wrangler/`, `dist/`, `node_modules/`는 구조 판단과 규칙 생성 대상에서 제외한다.

## 개발 규칙
- 컴포넌트명과 파일명은 PascalCase 사용
- 한국어 UI 텍스트는 명확하고 친숙한 표현 사용
- 반응형 디자인 우선 (모바일 퍼스트)
- 접근성 고려한 UI/UX 구현
- SQL 명령어 제공시 코드 블록으로 감싸지 않고 바로 복사하여 사용할 수 있도록 제공
- 주요 기능, DB 구조, Supabase RPC, 저장 데이터 의미가 변경되면 관련 문서를 함께 업데이트
- 데이터 저장 위치나 탐색 기준이 바뀌면 `README.md`의 빠른 참조와 `docs/DEVELOPMENT.md`의 상세 설명을 함께 최신화
- 완료 보고 시 `커밋`, `푸쉬`, `Worker 운영배포`는 각각 별도 상태로 분리해 보고한다. 특히 `git push`는 Cloudflare Worker 운영배포가 아니므로, Worker 변경이 있으면 `wrangler deploy` 실행 여부와 배포 URL/Version ID를 명시한다.
