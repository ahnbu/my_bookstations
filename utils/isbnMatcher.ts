/**
 * ISBN 매칭 유틸리티
 * 경기도 전자도서관 크롤링 결과와 도서 ISBN을 비교하여 정확한 매칭을 수행
 */

import { BookData } from '../types/aladin'
import { GyeonggiEbookLibraryResult } from '../services/unifiedLibrary.service'

/**
 * ISBN을 정규화하는 함수 (하이픈 제거, 공백 제거)
 */
function normalizeIsbn(isbn: string): string {
  return isbn?.replace(/[-\s]/g, '') || ''
}

/**
 * 두 ISBN이 일치하는지 확인
 */
function isIsbnMatch(isbn1: string, isbn2: string): boolean {
  if (!isbn1 || !isbn2) return false
  
  const normalized1 = normalizeIsbn(isbn1)
  const normalized2 = normalizeIsbn(isbn2)
  
  return normalized1 === normalized2 && normalized1.length > 0
}

/**
 * 도서와 경기도 전자도서관 책이 ISBN으로 매칭되는지 확인
 * @param book 원본 도서 데이터
 * @param ebookResult 경기도 전자도서관 검색 결과의 책
 * @returns ISBN 매칭 여부
 */
export function isBookMatched(book: BookData, ebookResult: any): boolean {
  const paperIsbn = book.isbn13 // 종이책 ISBN
  const ebookIsbn = book.subInfo?.ebookList?.[0]?.isbn13 // 전자책 ISBN
  const resultIsbn = ebookResult.isbn // 검색 결과 ISBN
  
  // 종이책 ISBN과 매칭
  if (paperIsbn && isIsbnMatch(paperIsbn, resultIsbn)) {
    return true
  }
  
  // 전자책 ISBN과 매칭  
  if (ebookIsbn && isIsbnMatch(ebookIsbn, resultIsbn)) {
    return true
  }
  
  return false
}

/**
 * 경기도 전자도서관 검색 결과를 ISBN 기준으로 필터링
 * @param book 원본 도서 데이터
 * @param gyeonggiResult 경기도 전자도서관 검색 결과
 * @returns 필터링된 결과 (ISBN 매칭되는 책만)
 */
export function filterGyeonggiEbookByIsbn(
  book: BookData, 
  gyeonggiResult: GyeonggiEbookLibraryResult
): GyeonggiEbookLibraryResult {
  // 에러 응답인 경우 그대로 반환
  if ('error' in gyeonggiResult) {
    return gyeonggiResult
  }
  
  // ISBN 매칭되는 책만 필터링
  const matchedBooks = gyeonggiResult.books?.filter(ebookResult => 
    isBookMatched(book, ebookResult)
  ) || []
  
  // 필터링된 책들로 카운트 재계산
  const totalCount = matchedBooks.length
  const availableCount = matchedBooks.filter(book => 
    book.isLoanable || book.available
  ).length
  const unavailableCount = totalCount - availableCount
  
  // 소장형과 구독형 개수 계산
  const ownedCount = matchedBooks.filter(book => book.type === '소장형').length
  const subscriptionCount = matchedBooks.filter(book => book.type === '구독형').length
  
  return {
    library_name: gyeonggiResult.library_name,
    total_count: totalCount,
    available_count: availableCount,
    unavailable_count: unavailableCount,
    owned_count: ownedCount,
    subscription_count: subscriptionCount,
    books: matchedBooks
  }
}

/**
 * 디버깅을 위한 ISBN 매칭 정보 출력
 */
export function debugIsbnMatching(book: BookData, gyeonggiResult: GyeonggiEbookLibraryResult) {
  if ('error' in gyeonggiResult) return
  
  const paperIsbn = book.isbn13
  const ebookIsbn = book.subInfo?.ebookList?.[0]?.isbn13
  
  console.group(`📚 ISBN 매칭 디버그: ${book.title}`)
  console.log(`📖 종이책 ISBN: ${paperIsbn}`)
  console.log(`💻 전자책 ISBN: ${ebookIsbn}`)
  console.log(`🔍 검색된 책 개수: ${gyeonggiResult.books?.length || 0}`)
  
  gyeonggiResult.books?.forEach((ebookResult, index) => {
    const isMatched = isBookMatched(book, ebookResult)
    console.log(`  ${index + 1}. ${ebookResult.title} (${ebookResult.isbn}) - ${isMatched ? '✅ 매칭' : '❌ 불일치'}`)
  })
  
  console.groupEnd()
}