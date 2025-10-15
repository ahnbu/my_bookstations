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


/** 2차 개선 (2025.10.10)
 * [최종 개선안] 도서관 검색용 제목을 생성하는 통합 함수 (2단계 정제 전략)
 * 1단계: 명백한 부제(콜론, 하이픈, 괄호 뒤)를 제거하여 핵심 제목을 추출합니다.
 * 2단계: 1단계 결과물을 3단어로 제한하여 검색 정확도와 재현율의 균형을 맞춥니다.
 * @param title - 원본 제목
 * @returns 최적화된 검색어
 */
export function createOptimalSearchTitle(title: string): string {
  // // 1단계: 명백한 부제 구분자(:, -, ()를 기준으로 핵심 제목을 추출합니다.
  // const subtitleMarkers = /:|-|\(/; // 콜론, 하이픈, 여는 괄호
  // 1단계: 부제 구분자를 확장합니다. (닫는 괄호, 대괄호, 중괄호 추가)
  // 정규식에서 특별한 의미를 갖는 [, ], {, }, (,) 등은 \로 이스케이프 처리해야 합니다.
  
  // [추가] title이 문자열이 아니거나 비어있는 경우를 대비한 방어 코드
  if (typeof title !== 'string' || !title) {
    return ''; // 에러를 발생시키는 대신 안전하게 빈 문자열 반환
  }

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

// 3가지 도서관 제목 처리 함수 : 현재는 모두 동일하나, 추후 별도 적용 염두하고 개별 함수로 정리

// 경기도 교육청 전자도서관
export function processGyeonggiEbookEduTitle(title: string): string {
  return createOptimalSearchTitle(title);
}

// 경기도 전자도서관
export function processGyeonggiEbookTitle(title: string): string {
  return createOptimalSearchTitle(title);
}

// 경기도 광주시 시립 전자도서관
export function processSiripEbookTitle(title: string): string {
  return createOptimalSearchTitle(title);
}


// services/unifiedLibrary.service.ts 파일

// ... (기존 코드들)

// [추가] 도서관별 바로가기 URL을 생성하는 통합 함수
export type LibraryName = '퇴촌' | '기타' | 'e교육' | 'e시립구독' | 'e시립소장' | 'e경기';

export function createLibraryOpenURL(
  libraryName: LibraryName, 
  bookTitle: string, 
  customSearchTitle?: string
): string {
  // 1. 최종 검색어 결정: 커스텀 검색어가 있으면 최우선으로 사용, 없으면 기본 가공 로직 적용
  const keyword = customSearchTitle || createOptimalSearchTitle(bookTitle);
  const encodedKeyword = encodeURIComponent(keyword);

  // 2. 도서관 이름(libraryName)에 따라 적절한 URL 반환
  switch (libraryName) {
    case '퇴촌':
      return `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${encodedKeyword}`;
    
    case '기타':
      return `https://lib.gjcity.go.kr/lay1/program/S1T446C461/jnet/resourcessearch/resultList.do?searchType=SIMPLE&searchKey=ALL&searchLibrary=ALL&searchKeyword=${encodedKeyword}`;
      
    case 'e교육':
      return `https://lib.goe.go.kr/elib/module/elib/search/index.do?menu_idx=94&search_text=${encodedKeyword}&sortField=book_pubdt&sortType=desc&rowCount=20`;
      
    case 'e시립구독':
      return `https://gjcitylib.dkyobobook.co.kr/search/searchList.ink?schTxt=${encodedKeyword}`;
      
    case 'e시립소장':
      return `https://lib.gjcity.go.kr:444/elibrary-front/search/searchList.ink?schTxt=${encodedKeyword}`;
      
    case 'e경기':
      return `https://ebook.library.kr/search?OnlyStartWith=false&searchType=all&listType=list&keyword=${encodedKeyword}`;
      
    default:
      // 혹시 모를 예외 상황에 대비하여 기본값 반환
      return '#';
  }
}

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
 * 경기도 전자도서관 검색 URL 생성 
 * (기존) 제목필드 한정 -> (변경) keyword 검색 (매칭확률up)
 * @param title - 검색할 제목
 * @returns 검색 URL
 */
// export function createGyeonggiEbookSearchURL(title: string): string {
//   // 제목 처리 로직은 그대로 사용합니다.
//   const processedTitle = createOptimalSearchTitle(title);
  
//   // URL 생성 방식을 더 유연한 'keyword' 파라미터 방식으로 변경합니다.
//   const baseUrl = "https://ebook.library.kr/search";
//   const encodedTitle = encodeURIComponent(processedTitle);
  
//   // searchType=all, listType=list 등의 파라미터는 유지하여 일관성을 확보합니다.
//   return `${baseUrl}?OnlyStartWith=false&searchType=all&listType=list&keyword=${encodedTitle}`;
// }

/**
 * 5-Way 통합 도서관 재고 확인 API 호출
 * @param isbn - 종이책 검색용 ISBN
 * @param title - 전자책 검색용 제목
 * @param customTitle - (선택) 사용자 지정 검색어
 * @returns Promise<LibraryApiResponse>
 */
export async function fetchBookAvailability(
  isbn: string, 
  title: string,
  customTitle?: string // [추가] customTitle 파라미터
): Promise<LibraryApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  // [핵심 수정] customTitle 처리 로직 변경
  let processedTitleGyeonggiEdu: string;
  let ProcessedTitleGyeonggi: string;
  let ProcessedTitleSirip: string;

  if (customTitle) {
    // customTitle이 존재하면, 가공 없이 그대로 사용
    processedTitleGyeonggiEdu = customTitle;
    ProcessedTitleGyeonggi = customTitle;
    ProcessedTitleSirip = customTitle;
  } else {
    // customTitle이 없으면, 기존 방식대로 원본 title을 가공
    processedTitleGyeonggiEdu = processGyeonggiEbookEduTitle(title);
    ProcessedTitleGyeonggi = processGyeonggiEbookTitle(title);
    ProcessedTitleSirip = processSiripEbookTitle(title);
  }
  
  // 디버그용 로그 추가
  debugLog('제목 처리:', {
    originalTitle: title,
    customTitle: customTitle,
    processedEduTitle: processedTitleGyeonggiEdu,
    gyeonggiProcessedTitle: ProcessedTitleGyeonggi,
    siripProcessedTitle: ProcessedTitleSirip
  });

  try {
    debugLog(`API 호출 시작 - 엔드포인트: ${API_ENDPOINT}`);
    debugLog('요청 데이터:', {
      isbn: isbn,
      customTitle: customTitle,
      eduTitle: processedTitleGyeonggiEdu,
      gyeonggiTitle: ProcessedTitleGyeonggi,
      siripTitle: ProcessedTitleSirip
    });

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isbn: isbn,
        customTitle: customTitle, // 커스텀 검색어
        eduTitle: processedTitleGyeonggiEdu, // 경기도 교육청 전자도서관용
        gyeonggiTitle: ProcessedTitleGyeonggi, // 경기도 전자도서관용
        siripTitle: ProcessedTitleSirip, // 시립도서관 전자책용
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