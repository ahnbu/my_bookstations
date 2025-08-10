/**
 * ISBN 매칭 유틸리티 테스트
 */

import { filterGyeonggiEbookByIsbn, isBookMatched } from '../isbnMatcher'
import { BookData } from '../../types/aladin'
import { GyeonggiEbookLibraryResult } from '../../services/unifiedLibrary.service'

describe('isbnMatcher', () => {
  // 테스트용 도서 데이터 - 사용자 제공 예시를 기반으로 함
  const mockBook: BookData = {
    id: 1,
    title: '내 손으로, 시베리아 횡단열차',
    author: '이다',
    publisher: '미술문화',
    isbn13: '9791192768236', // 종이책 ISBN
    subInfo: {
      ebookList: [
        {
          isbn13: '9791192768999' // 전자책 ISBN (가상의 예시)
        }
      ]
    }
  } as BookData

  const mockGyeonggiResult: GyeonggiEbookLibraryResult = {
    library_name: '경기도 전자도서관',
    total_count: 4,
    available_count: 3,
    unavailable_count: 1,
    owned_count: 1,
    subscription_count: 3,
    books: [
      {
        title: '내 손으로, 시베리아 횡단열차',
        author: '이다',
        publisher: '미술문화',
        isbn: '9791192768236', // 종이책 ISBN과 일치
        totalCopies: 5,
        availableCopies: 0,
        isLoanable: false,
        type: '소장형',
        library: '경기도전자도서관',
        detailUrl: 'https://ebook.library.kr/detail?contentType=EB&id='
      },
      {
        type: '구독형',
        title: '스마트스토어로 시작하는 내손으로 10만원 벌기',
        author: '유미영',
        publisher: '작가와',
        isbn: '9791142109089', // 다른 ISBN
        available: true,
        library_name: '경기도 전자도서관'
      },
      {
        type: '구독형',
        title: '내 손으로 만드는 경제적 자유',
        author: '달빛서랍',
        publisher: '작가와',
        isbn: '9791193102077', // 다른 ISBN
        available: true,
        library_name: '경기도 전자도서관'
      },
      {
        type: '구독형',
        title: '내 손으로 만드는 내 삶을 위한 정치',
        author: '박선민',
        publisher: '휴머니스트',
        isbn: '9791160808254', // 다른 ISBN
        available: true,
        library_name: '경기도 전자도서관'
      }
    ]
  }

  describe('isBookMatched', () => {
    it('종이책 ISBN이 일치할 때 매칭되어야 함', () => {
      const book = mockBook
      const ebookResult = mockGyeonggiResult.books![0] // 첫 번째 책 (ISBN 일치)
      
      expect(isBookMatched(book, ebookResult)).toBe(true)
    })

    it('전자책 ISBN이 일치할 때 매칭되어야 함', () => {
      const book = mockBook
      const ebookResultWithEbookIsbn = {
        ...mockGyeonggiResult.books![1],
        isbn: '9791192768999' // 전자책 ISBN과 일치하도록 수정
      }
      
      expect(isBookMatched(book, ebookResultWithEbookIsbn)).toBe(true)
    })

    it('ISBN이 일치하지 않을 때 매칭되지 않아야 함', () => {
      const book = mockBook
      const ebookResult = mockGyeonggiResult.books![1] // 다른 ISBN
      
      expect(isBookMatched(book, ebookResult)).toBe(false)
    })

    it('ISBN에 하이픈이 있어도 정상 매칭되어야 함', () => {
      const bookWithHyphenIsbn = {
        ...mockBook,
        isbn13: '979-11-92768-23-6' // 하이픈 포함
      }
      const ebookResult = mockGyeonggiResult.books![0] // '9791192768236'
      
      expect(isBookMatched(bookWithHyphenIsbn, ebookResult)).toBe(true)
    })
  })

  describe('filterGyeonggiEbookByIsbn', () => {
    it('ISBN 매칭되는 책만 필터링해야 함', () => {
      const result = filterGyeonggiEbookByIsbn(mockBook, mockGyeonggiResult)
      
      // 원래 4권 -> 1권으로 필터링 (첫 번째 책만 ISBN 일치)
      expect(result.total_count).toBe(1)
      expect(result.available_count).toBe(0) // 첫 번째 책은 대출불가
      expect(result.owned_count).toBe(1)
      expect(result.subscription_count).toBe(0)
      expect(result.books).toHaveLength(1)
      expect(result.books![0].isbn).toBe('9791192768236')
    })

    it('매칭되는 책이 없을 때 모든 카운트가 0이어야 함', () => {
      const bookWithNoMatchingIsbn = {
        ...mockBook,
        isbn13: '9999999999999', // 매칭되지 않는 ISBN
        subInfo: {
          ebookList: [{ isbn13: '8888888888888' }] // 이것도 매칭되지 않음
        }
      } as BookData
      
      const result = filterGyeonggiEbookByIsbn(bookWithNoMatchingIsbn, mockGyeonggiResult)
      
      expect(result.total_count).toBe(0)
      expect(result.available_count).toBe(0)
      expect(result.owned_count).toBe(0)
      expect(result.subscription_count).toBe(0)
      expect(result.books).toHaveLength(0)
    })

    it('에러 응답인 경우 그대로 반환해야 함', () => {
      const errorResult = { error: '검색 실패' }
      const result = filterGyeonggiEbookByIsbn(mockBook, errorResult as any)
      
      expect(result).toEqual(errorResult)
    })

    it('전자책과 종이책 ISBN이 모두 있는 경우 둘 다 매칭해야 함', () => {
      const mockResultWithBothIsbns: GyeonggiEbookLibraryResult = {
        ...mockGyeonggiResult,
        books: [
          {
            ...mockGyeonggiResult.books![0],
            isbn: '9791192768236' // 종이책 ISBN
          },
          {
            ...mockGyeonggiResult.books![1],
            isbn: '9791192768999' // 전자책 ISBN
          }
        ]
      }
      
      const result = filterGyeonggiEbookByIsbn(mockBook, mockResultWithBothIsbns)
      
      expect(result.total_count).toBe(2) // 두 책 모두 매칭
      expect(result.books).toHaveLength(2)
    })
  })
})