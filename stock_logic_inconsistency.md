# 도서관 재고 표시 로직 불일치 분석

## 1. 개요
`MyLibraryBookDetailModal.tsx` 파일 내 6개 도서관 항목의 재고 상태 표시 로직(`hasError` 판단 기준)이 서로 다르게 구현되어 있습니다. 특히 **데이터가 로딩되지 않은 초기 상태(`undefined` / `null`)**를 처리하는 방식이 달라, UI 상에서 로딩 중임에도 "에러"로 표시되는 문제가 있습니다.

## 2. 상세 로직 비교

| 구분 | 항목 | `hasError` 판단 코드 (현재) | 데이터가 없을 때 (`null`/`undefined`) 처리 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **1, 2** | **광주 (퇴촌/기타)** | `book.gwangjuPaperInfo ? 'error' in book.gwangjuPaperInfo : false` | **정상(로딩중)**으로 판단<br>(`false` 반환) | ✅ 적절함 |
| **3, 4** | **시립 (구독/소장)** | `!book.siripEbookInfo || !!book.siripEbookInfo.errors?.subscription` | **에러**로 판단<br>(`!book.siripEbookInfo`가 `true`) | ⚠️ **문제**: 데이터 로딩 전을 에러로 표시 |
| **5** | **경기 (전자책)** | `book.gyeonggiEbookInfo ? 'error' in book.gyeonggiEbookInfo : false` | **정상(로딩중)**으로 판단<br>(`false` 반환) | ✅ 적절함 |
| **6** | **경기 (교육청)** | `(book.gyeonggiEduEbookInfo?.errorCount ?? 0) > 0` | **정상(로딩중)**으로 판단<br>(`0 > 0`은 `false`) | ✅ 적절함 |

## 3. 문제점
- **시립 전자책(구독/소장)** 항목은 데이터가 아직 로딩되지 않았을 때(`book.siripEbookInfo`가 `null`일 때) `!book.siripEbookInfo` 조건에 의해 `hasError`가 `true`가 됩니다.
- 이로 인해 `StockDisplay` 컴포넌트에서 "조회중..." 대신 **빨간색 에러 메시지(또는 에러 상태)**가 먼저 노출될 수 있습니다.
- 다른 도서관들은 데이터가 없을 때 에러가 아닌 것으로 처리되어 "조회중..." 상태가 정상적으로 표시됩니다.

## 4. 개선 제안 (통일안)
시립 전자책의 로직도 다른 항목들과 동일하게 **"데이터가 존재할 때만 에러 여부를 검사하고, 데이터가 없으면 에러가 아님(로딩 중)"**으로 통일하는 것을 제안합니다.

### 수정 코드 예시

**변경 전 (현재):**
```typescript
// 데이터가 없으면(!book.siripEbookInfo) 에러로 간주
hasError={!book.siripEbookInfo || !!book.siripEbookInfo.errors?.subscription}
```

**변경 후 (제안):**
```typescript
// 데이터가 있을 때만 에러 체크, 없으면 false (로딩중)
hasError={book.siripEbookInfo ? !!book.siripEbookInfo.errors?.subscription : false}
```
