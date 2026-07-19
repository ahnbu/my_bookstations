# CHANGELOG

모든 Git 커밋 이력을 최신순으로 기록합니다. 새 커밋은 표 최상단에 추가합니다.

| 일시 | 유형 | 범위 | 변경내용 (목적 포함) |
|---|---|---|---|
| 2026-07-19 12:47 | docs | rules | CLAUDE.md를 @AGENTS.md 포인터로 통일 + AGENTS.md 수동 동기화 문구 제거 |
| 2026-07-14 16:10 | feat | ui | 즐겨찾기 도서 필터 기능 활성화 |
| 2026-07-14 16:10 | docs | docs | 문서 정본 위치를 docs로 변경 및 문서 이전 |
| 2026-07-12 14:48 | fix | tags | 자동태그 RPC가 수동·자동 태그를 함께 집계·필터하도록 운영 SQL과 검증 절차를 동기화 |
| 2026-07-10 17:13 | docs | review-reports | 경량 검수 보고서를 full 검수 폴더로 통합 |
| 2026-07-09 19:20 | chore | gitignore | OMO 임시 파일 및 증거 문서 제외 패턴 추가 — git status 오염 방지 및 핵심 산출물 위주 추적 유지 |
| 2026-07-09 17:57 | docs | agents | init-deep 계층형 규칙 문서 추가 — 작업 정본 위치와 검증 기준 보존 |
| 2026-07-08 11:03 | chore | gitignore,BACKLOG | CodeGraph 로컬 인덱스 제외와 재고 갱신 결과 분리 백로그 기록 — 로컬 캐시 오염 방지와 후속 개선 항목 보존 |
| 2026-07-08 10:45 | fix | settings-modal | 모바일 설정 탭 1줄 표시 — 글자 크기 유지 상태에서 여백과 줄바꿈을 조정 |
| 2026-07-07 21:18 | docs | done-check-lite | 도서상세 Escape 변경 완료검수 보고서 저장 — 1차 지적과 보완 후 완료 판정 기록 |
| 2026-07-07 21:17 | fix | book-detail | 도서상세 팝업 Escape 닫기 지원 — 입력 편집 중 Escape는 모달 닫기와 분리 |
| 2026-07-07 16:56 | docs | project-rules | AGENTS와 CLAUDE 프로젝트 규칙 동기화 원칙 추가 |
| 2026-07-07 16:24 | fix | library-checker | 광주시 종이책과 시립 소장형 전자책 조회를 순차 예산으로 분리 |
| 2026-07-05 12:09 | docs | book-search | 원형 빠른추가 취소 구현계획 기록 — 실행 결과와 검증 근거를 계획문서에 반영 |
| 2026-07-05 12:08 | feat | book-search | 검색 결과 빠른 추가 취소 지원 — 방금 추가한 도서는 체크 클릭으로 취소하고 기존 추가 도서는 잠금 상태로 표시 |
| 2026-07-05 12:08 | chore | previews | 미리보기 산출물 제외 규칙 추가 — 로컬 HTML 프리뷰가 커밋 대상에 섞이지 않도록 정리 |
| 2026-07-05 11:52 | feat | auto-tags | 계정별 자동태그 규칙과 책별 자동태그 재계산을 추가 |
| 2026-07-05 11:46 | docs | dev-docs | library-checker 실행 명령을 npm 기준으로 정정 |
| 2026-07-05 11:39 | docs | dev-docs | 개발문서 drift 정리와 현재 실행 기준 반영 |
| 2026-07-05 11:31 | docs | dev-docs | 태그 데이터 위치와 개발 문서 업데이트 규칙 정리 |
| 2026-07-05 11:22 | feat | book-search | 검색 결과 표지 위 빠른 추가 버튼과 직접 도서 추가 API 추가 |
| 2026-07-05 11:16 | chore | temp | temp 미리보기 산출물 추적 제거 — gitignore 대상 파일 강제 커밋을 원복하고 로컬 보관 상태로 정리 |
| 2026-05-03 12:52 | docs | BACKLOG | 완료된 시립 구독 전자책 Worker 배포 항목 제거 — 운영 반영 완료 상태로 백로그 정리 |
| 2026-05-03 12:36 | chore | local-preview | 로컬 검증 바로가기 추가 — 더블클릭으로 개발 서버 접속 경로 단순화 |
| 2026-05-03 12:36 | docs | README,BACKLOG | Tailwind 현재 사용 방식과 후속 빌드 통합 검토 항목 정리 — CDN 기반 스타일 공급 구조 명확화 |
| 2026-05-03 12:35 | fix | library-checker | 시립 구독 전자책 검색 요청에서 불필요한 세션 쿠키 주입 제거 — 교보문고 검색 HTTP 500 해소 |
| 2026-05-03 11:59 | fix | components/AuthModal | 로그인·회원가입 입력 자동완성 속성 추가 — 브라우저 접근성 경고 해소 |
| 2026-05-03 11:51 | chore | package-manager | pnpm lockfile 추가 및 npm lockfile 제거 — 프로젝트 기본 패키지 매니저 기준 정리 |
| 2026-05-03 11:51 | docs | AGENTS | 프로젝트별 Codex 작업 규칙 추가 — 응답 언어·프로젝트 정보·개발 규칙 명시 |
| 2026-05-03 11:47 | fix | services/aladin | 알라딘 검색 응답에서 불량 도서 항목만 제외 — 정상 검색 결과 전체 실패 방지 |
| 2026-03-25 | chore | .gitignore | _handoff/ 항목 제거 — handoff git 추적 복원 |
| YYYY-MM-DD HH:mm | feat/fix/refactor/docs/chore/other | area-or-folder | 변경 요약 — 변경 이유·목적 |
