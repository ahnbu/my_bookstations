---
model: "Gemini 3.1 Pro (High)"
performed_at: "2026-07-07 17:06:50"
---

# Done Check Lite Reviewer Report

## Verdict
승인 필요

## Requirement Audit
- **도서상세 페이지가 팝업으로 떠 있는 상태에서 Esc 키를 누르면 팝업이 닫힘**: 충족. `document`에 `keydown` 이벤트 리스너를 등록하여 `Escape` 키 입력 시 `onClose()`를 호출하도록 구현되었습니다.
- **JSON 뷰어 모달이 열려있을 때 예외 처리**: 충족. `!useUIStore.getState().isJsonViewerModalOpen` 조건을 확인하여 뷰어가 열려있을 때는 닫히지 않게 올바르게 예외 처리되었습니다.

## Blocking Gaps
1. **의도치 않은 동작 발생 (입력창 Esc 취소 시 모달 전체 닫힘)**:
   - `MyLibraryBookDetailModal` 내부에는 '커스텀 검색어(`input`)' 및 '메모(`textarea`)' 입력 필드가 존재하며, 각각 Esc 키를 누르면 입력을 취소하는 기능(`handleCancel`, `handleNoteCancel`)이 있습니다.
   - 현재 구현에서는 이 내부 `onKeyDown` 핸들러에서 `e.stopPropagation()`을 호출하지 않기 때문에, Esc 키 이벤트가 `document`까지 버블링(Bubbling)됩니다.
   - 결과적으로 **사용자가 입력 중에 입력을 취소하려고 Esc 키를 누르면, 의도치 않게 도서 상세 모달 전체가 닫혀버리는 심각한 사용성(UX) 문제**가 발생합니다.
   - **권장 조치사항**:
     - `document` 레벨의 `keydown` 리스너에서 입력 필드 활성화 여부를 체크하여 무시하거나 (`if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) return;`)
     - 내부의 커스텀 검색어 및 메모 컴포넌트의 Esc 키 핸들러에 `e.stopPropagation()`을 명시적으로 추가해야 합니다.

## Evidence
- **코드 확인 (`components/MyLibraryBookDetailModal.tsx`)**:
  - `document.addEventListener('keydown', ...)`로 전역 리스너가 추가된 것을 확인.
  - 커스텀 검색어용 `handleKeyDown` 및 메모용 `handleNoteKeyDown` 함수 내부를 확인한 결과, Esc 키 입력 처리 시 `e.preventDefault()`는 있지만 `e.stopPropagation()`은 호출되지 않고 있음.
- **테스트 코드 (`tests/book-detail-modal-escape-ui.test.mjs`)**:
  - 기본 상태에서 Esc 키를 눌러 모달이 닫히는 정상 경로는 잘 검증하고 있으나, 입력 필드 포커스 상태에서의 버블링 예외 케이스는 테스트에 포함되지 않아 해당 결함을 테스트가 잡아내지 못함.
- **기존 테스트 병렬 실행 실패 건**:
  - `node --test tests/*.test.mjs` 병렬 실행 시 `book-search-quick-add-ui.test.mjs`가 실패한 것은 Playwright/Vite 병렬 간섭에 의한 것으로 확인되며, 단독/순차 실행 시 PASS하므로 본 변경 사항과 무관한 환경적 문제로 판단됨.
