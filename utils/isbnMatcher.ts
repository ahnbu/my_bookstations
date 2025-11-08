/**
 * ISBN 매칭 유틸리티
 * 경기도 전자도서관 크롤링 결과와 도서 ISBN을 비교하여 정확한 매칭을 수행
 */


import { GyeonggiEbookResult, GyeonggiEbookList, AladdinBookItem } from '../types';

// --- 내부 헬퍼 함수들 (파일 외부로 노출되지 않음) ---

function normalizeIsbn(isbn: string): string {
  return isbn?.replace(/[-\s]/g, '') || '';
}

function normalizeAuthorName(author: string): string {
  if (!author) return '';
  return author
    .replace(/\([^)]*\)/g, '')
    .split(',')[0]
    .replace(/\s/g, '')
    .substring(0, 2);
}

function isIsbnMatch(isbn1: string, isbn2: string): boolean {
  if (!isbn1 || !isbn2) return false;
  const normalized1 = normalizeIsbn(isbn1);
  const normalized2 = normalizeIsbn(isbn2);
  return normalized1 === normalized2 && normalized1.length > 0;
}

// --- 유일하게 외부로 노출되는 함수 ---

/**
 * 경기도 전자도서관 검색 결과를 책의 ISBN(종이책/전자책)과 저자명으로 비교하여 필터링합니다.
 * @param book - 필터링의 기준이 될 책 객체 (Aladdin API 응답)
 * @param gyeonggiResult - 필터링할 경기도 전자도서관 API 응답 결과
 * @returns 필터링된 GyeonggiEbookResult 객체
 */
export function filterGyeonggiEbookByIsbn(
  book: AladdinBookItem,
  gyeonggiResult: GyeonggiEbookResult
): GyeonggiEbookResult {
  // API 응답이 에러거나 bookList가 없으면 그대로 반환
  if ('error' in gyeonggiResult || !gyeonggiResult.bookList) {
    return gyeonggiResult;
  }

  // ✅ isBookMatched 함수의 로직을 여기에 직접 통합하여 사용
  const matchedBooks = gyeonggiResult.bookList.filter(ebookItem => {
    const paperIsbn = book.isbn13;
    const ebookIsbn = book.subInfo?.ebookList?.[0]?.isbn13;
    const resultIsbn = ebookItem.isbn;
    const hasAladinEbook = !!(book.subInfo?.ebookList && book.subInfo.ebookList.length > 0);

    // 1순위: ISBN 매칭 (종이책 또는 전자책)
    if (resultIsbn) {
      if (paperIsbn && isIsbnMatch(paperIsbn, resultIsbn)) return true;
      if (ebookIsbn && isIsbnMatch(ebookIsbn, resultIsbn)) return true;
    }

    // 2순위: 알라딘에 전자책 정보가 없는 경우, 저자명으로 매칭
    if (!hasAladinEbook) {
      const bookAuthor = normalizeAuthorName(book.author);
      const resultAuthor = normalizeAuthorName(ebookItem.author || '');
      if (bookAuthor && resultAuthor && bookAuthor === resultAuthor) return true;
    }

    return false;
  });

  const availableCount = matchedBooks.filter(b => b.loanStatus).length;

  // 필터링된 결과를 바탕으로 새로운 GyeonggiEbookResult 객체를 생성하여 반환
  return {
    ...gyeonggiResult,
    totalCountSummary: matchedBooks.length,
    availableCountSummary: availableCount,
    unavailableCountSummary: matchedBooks.length - availableCount,
    bookList: matchedBooks,
  };
}

// ✅ [삭제] isBookMatched 와 debugIsbnMatching 함수는 제거되었습니다.

