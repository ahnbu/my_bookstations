# Components Rules

## 범위
- 이 폴더는 React UI, 모달, 내 서재 화면, 검색 화면의 사용자-facing 동작을 담당한다.
- 상태의 정본은 `stores/`에 두고, 컴포넌트는 화면 표시와 사용자 입력 연결에 집중한다.

## 작업별 위치
- 앱 첫 화면과 전역 배치: `App.tsx`, `components/layout/`
- 검색 입력과 결과: `SearchForm.tsx`, `BookDetails.tsx`, `BookSearchListModal.tsx`, `KeywordSearchModal.tsx`
- 내 서재 목록과 상세: `MyLibrary.tsx`, `MyLibraryListItem.tsx`, `MyLibraryBookDetailModal.tsx`, `MyLibraryToolbar.tsx`
- 설정과 태그 UI: `SettingsModal.tsx`, `DefaultSettingsContent.tsx`, `TagFilter.tsx`, `CustomTag.tsx`
- 개발·진단 모달: `DevToolsFloat.tsx`, `APITestModal.tsx`, `APITestContent.tsx`, `JsonViewerModal.tsx`

## 변경 규칙
- 컴포넌트명과 파일명은 PascalCase를 유지한다.
- 한국어 UI 문구는 짧고 사용자가 바로 이해할 수 있게 쓴다.
- 재고 태그의 `0`, `null`, error 표시는 임의로 합치지 않는다. 표시 의미는 store와 DB 컬럼 의미를 먼저 확인한다.
- `createLibraryOpenURL` 호출부를 바꾸면 `services/unifiedLibrary.service.ts`의 URL 생성 규칙과 함께 검증한다.
- 자동 태그 표시는 `utils/autoTagRules.ts`의 병합 규칙을 기준으로 한다.

## 검증
- UI 변경은 실제 화면 또는 Playwright로 확인한다.
- 모달·드롭다운·Esc·외부 클릭 동작은 키보드와 모바일 폭을 함께 확인한다.
- 내 서재 재고 표시는 목록 카드와 상세 모달 양쪽을 함께 확인한다.
