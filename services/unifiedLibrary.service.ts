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
  // 퇴촌도서관 상세 페이지 링크용 파라미터 (대출가능 상태일 때만)
  recKey?: string;
  bookKey?: string;
  publishFormCode?: string;
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

// 경기도 전자도서관 관련 타입 정의
export interface GyeonggiEbookLibraryBook {
  type: '소장형' | '구독형';
  title: string;
  // status: '대출가능' | '대출불가';
  available: boolean;
  current_borrow?: number;
  total_capacity?: number;
  author?: string;
  publisher?: string;
  isbn?: string;
  owner?: string;
  reservable?: boolean;
  reserve_count?: number;
}

export interface GyeonggiEbookLibraryResult {
  library_name: string;
  total_count: number;
  available_count: number;
  unavailable_count: number;
  owned_count: number;
  subscription_count: number;
  books: GyeonggiEbookLibraryBook[];
}

export interface GyeonggiEbookLibraryError {
  error: string;
}

// 시립도서관 전자책 관련 타입 정의
export interface SiripEbookBook {
  type: '전자책';
  title: string;
  author: string;
  publisher: string;
  publish_date: string;
  loan_status: string;
  status: '대출가능' | '대출불가';
  total_copies: number;
  available_copies: number;
  available: boolean;
  library_name: string;
}

export interface SiripEbookResult {
  library_name: string;
  total_count: number;
  available_count: number;
  unavailable_count: number;
  books: SiripEbookBook[];
  // 새로운 통합 구조 지원
  details?: {
    owned: {
      library_name: string;
      total_count: number;
      available_count: number;
      unavailable_count: number;
      books: SiripEbookBook[];
      error?: string;
    };
    subscription: {
      library_name: string;
      total_count: number;
      available_count: number;
      unavailable_count: number;
      books: SiripEbookBook[];
      error?: string;
    };
  };
  // 통합 결과 정보
  시립도서관_통합_결과?: {
    library_name: string;
    total_count: number;
    available_count: number;
    unavailable_count: number;
    owned_count: number;
    subscription_count: number;
    search_query: string;
  };
}

export interface SiripEbookError {
  error: string;
}

export interface LibraryApiResponse {
  gwangju_paper: GwangjuPaperResult | GwangjuPaperError;
  gyeonggi_ebook_education: (EBookAvailability | EBookError)[];
  gyeonggi_ebook_library?: GyeonggiEbookLibraryResult | GyeonggiEbookLibraryError;
  sirip_ebook?: SiripEbookResult | SiripEbookError;
}

export interface EBookSummary {
  총개수: number;
  대출가능: number;
  대출불가: number;
  성남도서관: number;
  통합도서관: number;
  오류개수: number;
}

// 개발/프로덕션 환경에 따른 API 엔드포인트 설정
const isDevelopment = import.meta.env.MODE === 'development';
const API_ENDPOINT = isDevelopment 
  ? 'http://127.0.0.1:8787'  // 로컬 Cloudflare Workers 개발 서버
  : 'https://library-checker.byungwook-an.workers.dev'; // 프로덕션 Workers 배포
const REQUEST_TIMEOUT = 30000; // 30초

// 디버그 정보 로깅 함수
function debugLog(message: string, data?: any) {
  if (isDevelopment) {
    // console.log(`[UnifiedLibrary] ${message}`, data || ''); // 성능 개선을 위해 주석 처리
  }
}

// /**
//  * 전자책 검색용 책 제목 처리 함수
//  * 특수문자를 공백으로 변경 후 3개 chunk로 제한
//  * @param title - 원본 제목
//  * @returns 처리된 제목 (최대 3개 chunk)
//  */
// export function processBookTitle(title: string): string {
//   // 특수문자를 공백으로 변경
//   const processedTitle = title.replace(/[^\w\s가-힣]/g, ' ');
  
//   // 공백으로 분리하고 빈 문자열 제거
//   const chunks = processedTitle.split(' ').filter(chunk => chunk.trim() !== '');
  
//   // 3개 이하면 그대로 반환, 3개 초과면 첫 3개만 반환
//   if (chunks.length <= 3) {
//     return chunks.join(' ');
//   }
  
//   return chunks.slice(0, 3).join(' ');
// }

// /**
//  * 경기도 전자도서관 검색용 책 제목 처리 함수
//  * 특수문자 발견 시 그 이후 내용 제거, 최대 3단어 제한
//  * @param title - 원본 제목
//  * @returns 처리된 제목
//  */
// export function processGyeonggiEbookTitle(title: string): string {
//   // 특수문자 목록 (쉼표, 하이픈, 콜론, 세미콜론, 괄호 등)
//   const specialChars = /[,\-:;()[\]{}]/;
  
//   // 특수문자가 있으면 그 위치까지만 추출
//   let processedTitle = title;
//   const match = title.search(specialChars);
//   if (match !== -1) {
//     processedTitle = title.substring(0, match).trim();
//   }
  
//   // 공백으로 분리하고 빈 문자열 제거
//   const words = processedTitle.split(' ').filter(word => word.trim() !== '');
  
//   // 최대 3단어까지만 사용
//   return words.slice(0, 3).join(' ');
// }

// /** 1차 개선 (2025.10.10) (경기교육 검색로직 변경)
// /** 특수문자 제거 후 3단어 (50% 성공) -> 특수문자 포함 3단어or2단어(90%)
//  * 전자책 검색용 책 제목 처리 함수 (성공률 100% 로직으로 개선)
//  * 원본 제목에서 띄어쓰기 기준으로 앞 3단어만 사용
//  * @param title - 원본 제목
//  * @returns 처리된 제목 (최대 3개 단어)
//  */
// export function processBookTitle(title: string): string {
//   // 1. 원본 제목을 바로 공백으로 분리하고, 혹시 모를 연속 공백 등을 처리
//   const chunks = title.split(' ').filter(chunk => chunk.trim() !== '');
  
//   // 2. 앞에서 3단어만 선택하여 다시 공백으로 합침 -> 2단어로 변경
//   // return chunks.slice(0, 3).join(' ');
//   return chunks.slice(0, 2).join(' ');
// }


/** 2차 개선 (2025.10.10)
 * [최종 개선안] 도서관 검색용 제목을 생성하는 통합 함수 (2단계 정제 전략)
 * 1단계: 명백한 부제(콜론, 하이픈, 괄호 뒤)를 제거하여 핵심 제목을 추출합니다.
 * 2단계: 1단계 결과물을 3단어로 제한하여 검색 정확도와 재현율의 균형을 맞춥니다.
 * @param title - 원본 제목
 * @returns 최적화된 검색어
 */
function createOptimalSearchTitle(title: string): string {
  // // 1단계: 명백한 부제 구분자(:, -, ()를 기준으로 핵심 제목을 추출합니다.
  // const subtitleMarkers = /:|-|\(/; // 콜론, 하이픈, 여는 괄호
  // 1단계: 부제 구분자를 확장합니다. (닫는 괄호, 대괄호, 중괄호 추가)
  // 정규식에서 특별한 의미를 갖는 [, ], {, }, (,) 등은 \로 이스케이프 처리해야 합니다.
  const subtitleMarkers = /:|-|\(|\)|\[|\]|\{|\}/; // 콜론, 하이픈, 모든 종류의 괄호
  let coreTitle = title;
  const markerIndex = title.search(subtitleMarkers);

  if (markerIndex !== -1) {
    coreTitle = title.substring(0, markerIndex).trim();
  }

  // 2단계: 추출된 핵심 제목을 기준으로 3단어 제한을 적용합니다.
  const words = coreTitle.split(' ').filter(word => word.trim() !== '');
  return words.slice(0, 3).join(' ');
}

// 기존 두 함수를 새로운 통합 함수를 호출하도록 변경합니다.
export function processBookTitle(title: string): string {
  return createOptimalSearchTitle(title);
}

export function processGyeonggiEbookTitle(title: string): string {
  return createOptimalSearchTitle(title);
}

// /**
//  * 경기도 전자도서관 검색 URL 생성 (올바른 인코딩)
//  * @param title - 검색할 제목
//  * @returns 검색 URL
//  */
// export function createGyeonggiEbookSearchURL(title: string): string {
//   const processedTitle = processGyeonggiEbookTitle(title);
//   // URL 수동 구성 (올바른 인코딩을 위해)
//   const baseUrl = "https://ebook.library.kr/search";
//   const encodedTitle = encodeURIComponent(processedTitle).replace(/'/g, '%27');
//   const detailQuery = `TITLE:${encodedTitle}:true`;
  
//   return `${baseUrl}?detailQuery=${detailQuery}&OnlyStartWith=false&searchType=all&listType=list`;
// }


/**
 * 경기도 전자도서관 검색 URL 생성 
 * (기존) 제목필드 한정 -> (변경) keyword 검색 (매칭확률up)
 * @param title - 검색할 제목
 * @returns 검색 URL
 */
export function createGyeonggiEbookSearchURL(title: string): string {
  // 제목 처리 로직은 그대로 사용합니다.
  const processedTitle = createOptimalSearchTitle(title);
  
  // URL 생성 방식을 더 유연한 'keyword' 파라미터 방식으로 변경합니다.
  const baseUrl = "https://ebook.library.kr/search";
  const encodedTitle = encodeURIComponent(processedTitle);
  
  // searchType=all, listType=list 등의 파라미터는 유지하여 일관성을 확보합니다.
  return `${baseUrl}?OnlyStartWith=false&searchType=all&listType=list&keyword=${encodedTitle}`;
}

/**
 * 5-Way 통합 도서관 재고 확인 API 호출
 * @param isbn - 종이책 검색용 ISBN
 * @param title - 전자책 검색용 제목
 * @returns Promise<LibraryApiResponse>
 */
export async function fetchBookAvailability(isbn: string, title: string): Promise<LibraryApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  // 제목을 처리하여 3개 chunk로 제한 (기존 도서관용 - 한글만)
  const processedTitle = processBookTitle(title);
  
  // 경기도 전자도서관용 제목 처리 (숫자/영어 포함, 특수문자에서 자름)
  const gyeonggiProcessedTitle = processGyeonggiEbookTitle(title);
  
  // 시립도서관 전자책용 제목 처리 (동일한 로직 사용)
  const siripProcessedTitle = processGyeonggiEbookTitle(title);
  
  // 디버그용 로그 추가
  debugLog('제목 처리:', {
    originalTitle: title,
    processedTitle: processedTitle,
    gyeonggiProcessedTitle: gyeonggiProcessedTitle,
    siripProcessedTitle: siripProcessedTitle
  });

  try {
    debugLog(`API 호출 시작 - 엔드포인트: ${API_ENDPOINT}`);
    debugLog('요청 데이터:', {
      isbn: isbn,
      title: processedTitle,
      gyeonggiTitle: gyeonggiProcessedTitle,
      siripTitle: siripProcessedTitle
    });

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isbn: isbn,
        title: processedTitle, // 기존 도서관용 (한글만)
        gyeonggiTitle: gyeonggiProcessedTitle, // 경기도 전자도서관용 (숫자/영어 포함)
        siripTitle: siripProcessedTitle, // 시립도서관 전자책용 (숫자/영어 포함)
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      debugLog(`API 요청 실패: HTTP ${response.status}`);
      throw new Error(`API 요청 실패: HTTP ${response.status}`);
    }

    const data: LibraryApiResponse = await response.json();
    debugLog('API 응답 성공:', data);
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

/**
 * 경기광주 시립도서관 상세 페이지 URL 생성
 * @param recKey - 검색 결과 키
 * @param bookKey - 도서 키
 * @param publishFormCode - 출판 형태 코드
 * @returns 상세 페이지 URL
 */
export function generateLibraryDetailURL(recKey: string, bookKey: string, publishFormCode: string): string {
  // 퇴촌도서관의 URL 연결 방식을 기타도서관과 동일하게 변경
  // 안정성을 위해 제목 기반 검색 결과 페이지로 연결
  
  // 기타도서관과 동일한 URL 패턴 사용
  // searchLibraryArr=MN (퇴촌도서관 코드)
  // 제목 기반 검색으로 안정성 확보
  const searchURL = `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${recKey}`;
  
  return searchURL;
}

/**
 * 퇴촌도서관 재고 클릭 가능 여부 확인
 * @param item - 도서 재고 정보
 * @returns boolean - 클릭 가능 여부
 */
export function isLibraryStockClickable(item: PaperBookAvailability): boolean {
  return item.소장도서관 === '퇴촌도서관' && 
         item.대출상태 === '대출가능' &&
         !!item.recKey && 
         !!item.bookKey && 
         !!item.publishFormCode;
}