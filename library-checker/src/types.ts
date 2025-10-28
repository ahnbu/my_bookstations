// 파일 위치: library-checker/src/types.ts

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

// ===================================================================
// 1. API 요청 본문 (Request Body) 타입
// ===================================================================
export interface ApiRequest {
  isbn: string;
  author: string;
  eduTitle: string;
  gyeonggiTitle: string;
  siripTitle: string;
  customTitle?: string;
}

export interface KeywordSearchRequest {
  keyword: string;
}


// ===================================================================
// 2. 도서관별 크롤링/API 결과 타입
// ===================================================================

// --- 광주 시립도서관 (종이책) ---
export interface GwangjuPaperBook {
  '소장도서관': string;
  '청구기호': string;
  '기본청구기호': string;
  '대출상태': '대출가능' | '대출불가' | '알 수 없음';
  '반납예정일': string;
}

export interface GwangjuPaperResult {
  library_name: string;
  summary_total_count: number;
  summary_available_count: number;
  toechon_total_count: number;
  toechon_available_count: number;
  other_total_count: number;
  other_available_count: number;
  book_title: string;
  book_list: GwangjuPaperBook[];
}

// --- 경기도 교육청 전자도서관 (전자책) ---
export interface GyeonggiEduEbook {
  '소장도서관': '성남도서관' | '통합도서관';
  '도서명': string;
  '저자': string;
  '출판사': string;
  '발행일': string;
  '대출상태': '대출가능' | '대출불가' | '알 수 없음';
  'isbn': string;
}

export interface GyeonggiEduEbookResult {
  library_name: string;
  total_count: number;
  available_count: number;
  unavailable_count: number;
  seongnam_count: number;
  tonghap_count: number;
  error_count: number;
  error_lib_detail?: string;
  book_list: (GyeonggiEduEbook | { library: string; error: string })[];
}


// --- 경기도 전자도서관 (소장형+구독형) ---
export interface GyeonggiEbook {
  type: '소장형' | '구독형';
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  pubDate: string;
  available: boolean;
}

export interface GyeonggiEbookResult {
  library_name: string;
  total_count: number;
  available_count: number;
  unavailable_count: number;
  owned_count: number;
  subscription_count: number;
  book_list: GyeonggiEbook[];
}

// --- 광주 시립도서관 (전자책) ---
export interface SiripEbookOwned {
  type: '소장형';
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  isAvailable: boolean;
  totalCopies: number;
  availableCopies: number;
}

export interface SiripEbookSubscription {
  type: '구독형';
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  isAvailable: true;
}

export interface SiripEbookDetails {
  owned: {
    library_name: string;
    total_count: number;
    available_count: number;
    unavailable_count: number;
    book_list: SiripEbookOwned[];
    error?: string;
  };
  subscription: {
    library_name: string;
    total_count: number;
    available_count: number;
    unavailable_count: number;
    book_list: SiripEbookSubscription[];
    error?: string;
  };
}

export interface SiripEbookResult {
  sirip_ebook_summary: {
    library_name: string;
    total_count: number;
    available_count: number;
    unavailable_count: number;
    owned_count: number;
    subscription_count: number;
    search_query: string;
  };
  details: SiripEbookDetails;
  errors?: {
    owned?: string;
    subscription?: string;
  };
}

// ===================================================================
// 3. 통합 API 응답 (Response Body) 타입
// ===================================================================

// --- ISBN 검색 응답 ---
export interface LibraryApiResponse {
  title: string;
  isbn: string;
  author: string;
  customTitle: string;
  lastUpdated: number;
  gwangju_paper: GwangjuPaperResult | { error: string };
  gyeonggi_ebook_edu: GyeonggiEduEbookResult | null;
  gyeonggi_ebook_library: GyeonggiEbookResult | { error: string } | null;
  sirip_ebook: SiripEbookResult | { error: string } | null;
}

// --- 키워드 검색 응답 ---
export interface KeywordSearchResultItem {
  type: '종이책' | '전자책';
  libraryName: string;
  title: string;
  author: string;
  publisher: string;
  pubDate: string;
  isAvailable: boolean;
}

// 키워드 검색 API의 최종 반환 타입은 이 아이템들의 배열입니다.
export type KeywordSearchResponse = KeywordSearchResultItem[];