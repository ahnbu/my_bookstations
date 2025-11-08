/**
 * 3-Way 통합 도서관 재고 확인 API 서비스
 * 경기광주 시립도서관(종이책) + 경기도교육청 성남/통합도서관(전자책)
 */

// ✅ [추가] types.ts로부터 이 파일에서 사용하는 모든 타입을 import 합니다.
import {
  LibraryApiResponse,
  PaperBookAvailability,
  GyeonggiEduEbookList,
  GyeonggiEduEbookError,
  GyeonggiEduEbookSummary,
  LibraryName
} from '../types';

// 개발/프로덕션 환경에 따른 API 엔드포인트 설정
const isDevelopment = import.meta.env.MODE === 'development';
const apiEndpoint = isDevelopment 
  ? 'http://127.0.0.1:8787'  // 로컬 Cloudflare Workers 개발 서버
  : 'https://library-checker.byungwook-an.workers.dev'; // 프로덕션 Workers 배포
const requestTimeout = 30000; // 30초

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

export function createLibraryOpenURL(
  libraryName: LibraryName, 
  title: string, 
  customSearchTitle?: string
): string {
  // 1. 최종 검색어 결정: 커스텀 검색어가 있으면 최우선으로 사용, 없으면 기본 가공 로직 적용
  const keyword = customSearchTitle || createOptimalSearchTitle(title);
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
  author: string, // ✅ [추가] author 파라미터
  customTitle?: string // [추가] customTitle 파라미터
): Promise<LibraryApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

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
    debugLog(`API 호출 시작 - 엔드포인트: ${apiEndpoint}`);
    debugLog('요청 데이터:', {
      isbn: isbn,
      customTitle: customTitle,
      eduTitle: processedTitleGyeonggiEdu,
      gyeonggiTitle: ProcessedTitleGyeonggi,
      siripTitle: ProcessedTitleSirip
    });

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isbn: isbn,
        author: author, // ✅ [추가] author 정보 전송
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
 * 경기도 교육청 전자책 검색 결과 요약 정보 생성
 * @param GyeonggiEduEbooks - 전자책 검색 결과 배열
 * @returns EBookSummary
 */
export function GyeonggiEduEbookSummarize(GyeonggiEduEbooks: (GyeonggiEduEbookList | GyeonggiEduEbookError)[]): GyeonggiEduEbookSummary {
  const summary: GyeonggiEduEbookSummary = {
    totalCountSummary: 0,
    availableCountSummary: 0,
    unavailableCountSummary: 0,
    totalCountSeongnam: 0,
    totalCountTonghap: 0,
    errorCount: 0,
  };

  GyeonggiEduEbooks.forEach(item => {
    if ('error' in item) {
      summary.errorCount++;
      return;
    }

    summary.totalCountSummary++;
    
    if (item.loanStatus === '대출가능') {
      summary.availableCountSummary++;
    } else if (item.loanStatus === '대출불가') {
      summary.unavailableCountSummary++;
    }

    if (item.libraryName === '성남도서관') {
      summary.totalCountSeongnam++;
    } else if (item.libraryName === '통합도서관') {
      summary.totalCountTonghap++;
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
export function isEBooksEmpty(ebooks: (GyeonggiEduEbookList | GyeonggiEduEbookError)[]): boolean {
  return ebooks.length === 0 || ebooks.every(item => 'error' in item);
}

/**
 * 전자책 대출 가능 여부 확인
 * @param ebooks - 전자책 검색 결과 배열
 * @returns boolean
 */
export function hasAvailableEBooks(ebooks: (GyeonggiEduEbookList | GyeonggiEduEbookError)[]): boolean {
  return ebooks.some(item => !('error' in item) && item.loanStatus === '대출가능');
}
