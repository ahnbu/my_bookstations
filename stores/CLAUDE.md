<!-- 생성물: AGENTS.md의 사본. 정본은 같은 폴더의 AGENTS.md이며 수정은 그쪽에서 한다.
     갱신: node ~/.claude/scripts/sync-project-rules.mjs --write
     @AGENTS.md 참조를 쓰지 않는 이유: 하위 폴더에서 작업하면 상위 CLAUDE.md의 import가
     전개되지 않아 규칙이 통째로 유실된다(2026-08-29 실측). -->

# Stores Rules

## 범위
- 이 폴더는 Supabase 사용자 상태, 내 서재 데이터, 설정, UI 상태의 클라이언트 정본이다.
- 컴포넌트에서 계산을 중복하기보다 store action과 selector 의미를 먼저 확인한다.

## 작업별 위치
- 인증 세션: `useAuthStore.ts`
- 내 서재 CRUD, 재고 갱신, bulk refresh: `useBookStore.ts`
- 테마, 태그, 자동 태그 설정: `useSettingsStore.ts`
- 모달과 알림 상태: `useUIStore.ts`

## 저장 계약
- `book_data` JSON과 `stock_*` 최상위 컬럼을 혼동하지 않는다.
- `stock_*` 필드를 추가·삭제·의미 변경하면 DB SQL, `types.ts`, UI 표시, README/DEVELOPMENT 문서를 같이 확인한다.
- `null` 또는 `undefined` 재고값은 단순 0권과 다르다. error-only 갱신 판단에 영향을 준다.
- 자동 태그는 사용자 수동 태그와 병합되어 표시된다. `customTags`, `autoTags`, `autoTagRules`의 역할을 분리한다.

## 검증
- store 변경은 성공 toast보다 Supabase payload, 로컬 상태, 화면 반영을 기준으로 확인한다.
- refresh 변경은 단건 갱신과 bulk refresh를 구분해 확인한다.
- 설정 변경은 저장 직후와 앱 재진입 후 값을 모두 확인한다.
