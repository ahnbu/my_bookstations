// 파일 위치: library-checker/src/types.ts

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string; 
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
  isDbSchemaChanged: boolean; // db 스키마(구조) 변경여부 체크
}

export interface KeywordSearchRequest {
  keyword: string;
}


// ===================================================================
// 2. 도서관별 크롤링/API 결과 타입
// ===================================================================

// --- 광주 시립도서관 (종이책) ---
export interface GwangjuPaperBook {
  libraryName: string;
  callNo: string;
  baseCallNo: string;
  loanStatus: boolean;
  dueDate: string;
}

export interface GwangjuPaperResult {
  libraryName: string;
  totalCountSummary: number;
  totalCountToechon: number;
  totalCountOther: number;
  availableCountSummary: number;
  availableCountToechon: number;
  availableCountOther: number;
  title: string;
  bookList: GwangjuPaperBook[];
}

// --- 경기도 교육청 전자도서관 (전자책) ---
export interface gyeonggiEduEbook {
  libraryName: '성남도서관' | '통합도서관';
  title: string;
  author: string;
  publisher: string;
  pubDate: string;
  loanStatus: boolean;
  isbn: string;
}

export interface gyeonggiEduEbookResult {
  libraryName: string;
  totalCountSummary: number;
  availableCountSummary: number;
  unavailableCountSummary: number;
  totalCountSeongnam: number;
  totalCountTonghap: number;
  errorCount: number;
  errorLibDetail?: string;
  bookList: (gyeonggiEduEbook | { library: string; error: string })[];
}


// --- 경기도 전자도서관 (소장형+구독형) ---
export interface gyeonggiEbook {
  type: '소장형' | '구독형';
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  pubDate: string;
  loanStatus: boolean;
}

export interface gyeonggiEbookResult {
  libraryName: string;
  totalCountSummary: number;
  availableCountSummary: number;
  unavailableCountSummary: number;
  totalCountOwned: number;
  totalCountSubs: number;
  bookList: gyeonggiEbook[];
}


// --- 광주 시립도서관 (전자책) ---

export type SiripEbookBook = SiripEbookOwned | SiripEbookSubscription;

export interface SiripEbookOwned {
  type: '소장형';
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  loanStatus: boolean;
  totalCopies: number;
  availableCopies: number;
}

export interface SiripEbookSubscription {
  type: '구독형';
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  loanStatus: boolean;
}


// ✅ [추가] searchSiripEbookOwned 함수의 반환 타입을 명시하기 위해 추가
export interface SiripEbookOwnedResult {
  libraryName: string;
  totalCount: number;
  availableCount: number;
  unavailableCount: number;
  bookList: SiripEbookOwned[];
  error?: string;
}

// ✅ [추가] searchSiripEbookSubs 함수의 반환 타입을 명시하기 위해 추가
export interface SiripEbookSubsResult {
  libraryName: string;
  totalCount: number;
  availableCount: number;
  unavailableCount: number;
  bookList: SiripEbookSubscription[];
  error?: string;
}

export interface SiripEbookResult {
  libraryName: string;
  totalCountSummary: number;
  availableCountSummary: number;
  unavailableCountSummary: number;
  totalCountOwned: number;
  totalCountSubs: number;
  availableCountOwned: number; 
  availableCountSubs: number;
  searchQuery: string;
  bookList: SiripEbookBook[];
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
  gwangjuPaper: GwangjuPaperResult | { error: string };
  gyeonggiEbookEdu: gyeonggiEduEbookResult | null;
  gyeonggiEbookLib: gyeonggiEbookResult | { error: string } | null;
  siripEbook: SiripEbookResult | { error: string } | null;
}

// --- 키워드 검색 응답 ---
export interface KeywordSearchResultItem {
  type: '종이책' | '전자책';
  libraryName: string;
  title: string;
  author: string;
  publisher: string;
  pubDate: string;
  loanStatus: boolean;
}

// 키워드 검색 API의 최종 반환 타입은 이 아이템들의 배열입니다.
export type KeywordSearchResponse = KeywordSearchResultItem[];