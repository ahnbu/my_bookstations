/**
 * ISBN 필터링 테스트 함수 - 개발 환경에서 실행 가능
 */

import { filterGyeonggiEbookByIsbn } from './isbnMatcher'
import { BookData } from '../types'
import { GyeonggiEbookResult } from '../services/unifiedLibrary.service'

/**
 * 사용자가 제공한 실제 예시를 기반으로 한 테스트
 */
export function testRealWorldExample() {
  console.log('🧪 ISBN 필터링 테스트 시작')
  
  // 실제 도서 예시 (가정)
  const testBook: BookData = {
    id: 1,
    title: '내 손으로, 시베리아 횡단열차',
    author: '이다',
    publisher: '미술문화', 
    isbn13: '9791192768236', // 실제 종이책 ISBN
    subInfo: {
      // 전자책 ISBN이 없는 경우
      ebookList: []
    }
  } as BookData

  // 사용자가 제공한 실제 API 응답 예시
  const mockApiResponse: GyeonggiEbookResult = {
    library_name: '경기도 전자도서관',
    total_count: 4,
    available_count: 3,
    unavailable_count: 1,
    owned_count: 1,
    subscription_count: 3,
    book_list: [
      {
        title: '내 손으로, 시베리아 횡단열차',
        author: '이다',
        publisher: '미술문화',
        isbn: '9791192768236', // 매칭됨!
        status: '대출불가',
        type: '소장형',
        library: '경기도전자도서관',
        detailUrl: 'https://ebook.library.kr/detail?contentType=EB&id='
      },
      {
        type: '구독형',
        title: '스마트스토어로 시작하는 내손으로 10만원 벌기',       
        author: '유미영',
        publisher: '작가와',
        isbn: '9791142109089', // 매칭되지 않음
        status: '대출가능',
        library_name: '경기도 전자도서관'
      },
      {
        type: '구독형',
        title: '내 손으로 만드는 경제적 자유',
        author: '달빛서랍',
        publisher: '작가와',
        isbn: '9791193102077', // 매칭되지 않음
        status: '대출가능',
        library_name: '경기도 전자도서관'
      },
      {
        type: '구독형',
        title: '내 손으로 만드는 내 삶을 위한 정치',
        author: '박선민',
        publisher: '휴머니스트',
        isbn: '9791160808254', // 매칭되지 않음
        status: '대출가능',
        library_name: '경기도 전자도서관'
      }
    ]
  }

  console.log('📖 테스트 대상 도서:', testBook.title)
  console.log('📋 종이책 ISBN:', testBook.isbn13)
  console.log('💻 전자책 ISBN:', testBook.subInfo?.ebookList?.[0]?.isbn13 || '없음')
  console.log('🔍 검색된 책 개수:', mockApiResponse.book_list?.length)

  // 필터링 실행
  const filteredResult = filterGyeonggiEbookByIsbn(testBook, mockApiResponse)

  console.log('\n=== 필터링 결과 ===')
  console.log('원본 total_count:', mockApiResponse.total_count, '→ 필터링 후:', filteredResult.total_count)
  console.log('원본 available_count:', mockApiResponse.available_count, '→ 필터링 후:', filteredResult.available_count)
  console.log('원본 owned_count:', mockApiResponse.owned_count, '→ 필터링 후:', filteredResult.owned_count)  
  console.log('원본 subscription_count:', mockApiResponse.subscription_count, '→ 필터링 후:', filteredResult.subscription_count)

  console.log('\n📚 매칭된 도서 목록:')
  filteredResult.book_list?.forEach((book, index) => {
    console.log(`  ${index + 1}. ${book.title} (${book.isbn}) - ${book.type}`)
  })

  // 예상 결과 검증
  const expectedResult = {
    total_count: 1, // 1권만 매칭
    available_count: 0, // 매칭된 책이 대출불가
    owned_count: 1, // 소장형 1권
    subscription_count: 0 // 구독형 0권
  }

  console.log('\n✅ 검증 결과:')
  console.log('total_count 예상:', expectedResult.total_count, '실제:', filteredResult.total_count, filteredResult.total_count === expectedResult.total_count ? '✅' : '❌')
  console.log('available_count 예상:', expectedResult.available_count, '실제:', filteredResult.available_count, filteredResult.available_count === expectedResult.available_count ? '✅' : '❌')
  console.log('owned_count 예상:', expectedResult.owned_count, '실제:', filteredResult.owned_count, filteredResult.owned_count === expectedResult.owned_count ? '✅' : '❌')
  console.log('subscription_count 예상:', expectedResult.subscription_count, '실제:', filteredResult.subscription_count, filteredResult.subscription_count === expectedResult.subscription_count ? '✅' : '❌')
  
  return filteredResult
}

// 개발 환경에서만 실행
if (typeof window !== 'undefined' && (window as any).__DEV__) {
  (window as any).testIsbnFiltering = testRealWorldExample
}