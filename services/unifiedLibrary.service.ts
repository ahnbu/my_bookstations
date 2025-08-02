/**
 * 3-Way 통합 도서관 재고 확인 API 서비스
 * 경기광주 시립도서관(종이책) + 경기도교육청 성남/통합도서관(전자책)
 */

export interface PaperBookAvailability {
  소장도서관: string;
  청구기호: string;
  기본청구기호: string;
  대출상태: '대출가능' | '대출불가';
  반납예정일: string;
}

export interface EBookAvailability {
  소장도서관: string;
  도서명: string;
  저자: string;
  출판사: string;
  발행일: string;
  대출상태: '대출가능' | '대출불가';
}

export interface EBookError {
  error: string;
}

export interface GwangjuPaperResult {
  book_title: string;
  availability: PaperBookAvailability[];
}

export interface GwangjuPaperError {
  error: string;
}

export interface LibraryApiResponse {
  gwangju_paper: GwangjuPaperResult | GwangjuPaperError;
  gyeonggi_ebooks: (EBookAvailability | EBookError)[];
}

export interface EBookSummary {
  총개수: number;
  대출가능: number;
  대출불가: number;
  성남도서관: number;
  통합도서관: number;
  오류개수: number;
}

const API_ENDPOINT = 'https://library-checker.byungwook-an.workers.dev';
const REQUEST_TIMEOUT = 30000; // 30초

/**
 * 전자책 검색용 책 제목 처리 함수
 * 한글 외 문자를 공백으로 변경 후 3개 chunk로 제한
 * @param title - 원본 제목
 * @returns 처리된 제목 (최대 3개 chunk)
 */
export function processBookTitle(title: string): string {
  // 한글 외의 문자(영어, 숫자, 특수문자 등)를 공백으로 변경
  const processedTitle = title.replace(/[^가-힣\s]/g, ' ');
  
  // 공백으로 분리하고 빈 문자열 제거
  const chunks = processedTitle.split(' ').filter(chunk => chunk.trim() !== '');
  
  // 3개 이하면 그대로 반환, 3개 초과면 첫 3개만 반환
  if (chunks.length <= 3) {
    return chunks.join(' ');
  }
  
  return chunks.slice(0, 3).join(' ');
}

/**
 * 3-Way 통합 도서관 재고 확인 API 호출
 * @param isbn - 종이책 검색용 ISBN
 * @param title - 전자책 검색용 제목
 * @returns Promise<LibraryApiResponse>
 */
export async function fetchBookAvailability(isbn: string, title: string): Promise<LibraryApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  // 제목을 처리하여 3개 chunk로 제한
  const processedTitle = processBookTitle(title);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isbn: isbn,
        title: processedTitle,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API 요청 실패: HTTP ${response.status}`);
    }

    const data: LibraryApiResponse = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('요청 시간 초과 (30초)');
      }
      throw new Error(`API 호출 실패: ${error.message}`);
    }
    throw new Error('알 수 없는 오류가 발생했습니다.');
  }
}

/**
 * 전자책 검색 결과 요약 정보 생성
 * @param ebooks - 전자책 검색 결과 배열
 * @returns EBookSummary
 */
export function summarizeEBooks(ebooks: (EBookAvailability | EBookError)[]): EBookSummary {
  const summary: EBookSummary = {
    총개수: 0,
    대출가능: 0,
    대출불가: 0,
    성남도서관: 0,
    통합도서관: 0,
    오류개수: 0,
  };

  ebooks.forEach(item => {
    if ('error' in item) {
      summary.오류개수++;
      return;
    }

    summary.총개수++;
    
    if (item.대출상태 === '대출가능') {
      summary.대출가능++;
    } else if (item.대출상태 === '대출불가') {
      summary.대출불가++;
    }

    if (item.소장도서관 === '성남도서관') {
      summary.성남도서관++;
    } else if (item.소장도서관 === '통합도서관') {
      summary.통합도서관++;
    }
  });

  return summary;
}

/**
 * 대출 상태에 따른 CSS 클래스 반환
 * @param status - 대출 상태
 * @returns CSS 클래스 문자열
 */
export function getStatusClass(status: string): string {
  switch (status) {
    case '대출가능':
      return 'text-green-400';
    case '대출불가':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * 대출 상태에 따른 이모지 반환
 * @param status - 대출 상태
 * @returns 이모지 문자열
 */
export function getStatusEmoji(status: string): string {
  switch (status) {
    case '대출가능':
      return '✅';
    case '대출불가':
      return '❌';
    default:
      return '❓';
  }
}

/**
 * 전자책 검색 결과가 비어있는지 확인
 * @param ebooks - 전자책 검색 결과 배열
 * @returns boolean
 */
export function isEBooksEmpty(ebooks: (EBookAvailability | EBookError)[]): boolean {
  return ebooks.length === 0 || ebooks.every(item => 'error' in item);
}

/**
 * 전자책 대출 가능 여부 확인
 * @param ebooks - 전자책 검색 결과 배열
 * @returns boolean
 */
export function hasAvailableEBooks(ebooks: (EBookAvailability | EBookError)[]): boolean {
  return ebooks.some(item => !('error' in item) && item.대출상태 === '대출가능');
}