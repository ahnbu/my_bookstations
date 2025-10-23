
import { z } from 'zod';



export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Zod Schemas for runtime validation
export const AladdinBookItemSchema = z.object({
  title: z.string(),
  author: z.string(),
  pubDate: z.string(),
  description: z.string(),
  isbn13: z.string(),
  cover: z.string(),
  priceStandard: z.number(),
  priceSales: z.number(),
  publisher: z.string(),
  link: z.string(),

  // [수정] ✅ subInfo 스키마에 paperBookList를 추가합니다.
  subInfo: z.object({
    ebookList: z.array(z.object({
      itemId: z.number(),
      isbn: z.string(),
      isbn13: z.string(),
      priceSales: z.number(),
      link: z.string(),
    })).optional(),
    // 이 부분을 추가하세요.
    paperBookList: z.array(z.object({
      itemId: z.number(),
      isbn: z.string(),
      isbn13: z.string(),
      priceSales: z.number(),
      link: z.string(),
    })).optional(),
  }).optional(),
  mallType: z.enum(['BOOK', 'EBOOK', 'MUSIC', 'DVD', 'FOREIGN', 'USED']),
  // subInfo: z.object({
  //   ebookList: z.array(z.object({
  //     itemId: z.number(),
  //     isbn: z.string(),
  //     isbn13: z.string(),
  //     priceSales: z.number(),
  //     link: z.string(),
  //   })).optional(),
  // }).optional(),
});

export const AladdinAPIResponseSchema = z.object({
  item: z.array(AladdinBookItemSchema).optional(),
  errorCode: z.number().optional(),
  errorMessage: z.string().optional(),
});

export const LibraryAvailabilitySchema = z.object({
  "소장도서관": z.string(),
  "청구기호": z.string(),
  "기본청구기호": z.string(),
  "대출상태": z.string(),
  "반납예정일": z.string(),
});

export const LibraryStockResponseSchema = z.object({
  book_title: z.string().optional(),
  availability: z.array(LibraryAvailabilitySchema).optional(),
  error: z.string().optional(),
  isbn: z.string().optional(),
});


// ✅ 런타임 검증이 가능한 Zod 스키마 정의 (신규 추가)
// ▼▼▼▼▼▼▼▼▼▼ 여기에 아래 내용을 새로 추가합니다 ▼▼▼▼▼▼▼▼▼▼

// --- Zod 스키마 및 타입 추론 (신규 및 대체) ---

// 1. 순수 API 정보 스키마 (기존 BookData의 API 관련 부분)
export const ApiCombinedBookDataSchema = AladdinBookItemSchema.extend({
  // 도서관 API 원본 정보. 타입이 복잡하므로 z.any()로 처리하고, 런타임 검증이 꼭 필요하다면 별도 스키마 정의.
  gwangjuPaperInfo: z.any().optional(),
  ebookInfo: z.any().nullable().optional(), // 기존 EBookInfo 타입과 유사
  gyeonggiEbookInfo: z.any().nullable().optional(),
  siripEbookInfo: z.any().nullable().optional(),

  // 화면 표시를 위한 파생/요약 정보
  toechonStock: z.object({ total_count: z.number(), available_count: z.number() }).optional(),
  otherStock: z.object({ total_count: z.number(), available_count: z.number() }).optional(),
  filteredGyeonggiEbookInfo: z.any().optional(),
});

// 2. 사용자 활동 정보 스키마 (기존 BookData의 사용자 관련 부분)
export const UserActivityDataSchema = z.object({
  addedDate: z.number(),
  readStatus: z.enum(['읽지 않음', '읽는 중', '완독']),
  rating: z.number().min(0).max(5),
  customTags: z.array(z.string()).optional(),
  isFavorite: z.boolean(),
  customSearchTitle: z.string().optional(),
});

// 3. 위 두 스키마를 합쳐서 새로운 BookDataSchema 정의
export const BookDataSchema = ApiCombinedBookDataSchema.merge(UserActivityDataSchema);

// 4. DB의 id와 note를 포함한 최종 형태의 스키마 정의
export const SelectedBookSchema = BookDataSchema.extend({
  id: z.number(),
  note: z.string().nullable().optional(), // note는 별도 컬럼이므로 optional
});

// ▼▼▼▼▼▼▼▼▼▼ 모든 타입 추론을 여기에 모읍니다 ▼▼▼▼▼▼▼▼▼▼
// --- TypeScript 타입 추론 (from Zod Schemas) ---

// 외부 API 관련 타입
export type AladdinBookItem = z.infer<typeof AladdinBookItemSchema>;
export type AladdinAPIResponse = z.infer<typeof AladdinAPIResponseSchema>;
export type LibraryAvailability = z.infer<typeof LibraryAvailabilitySchema>;
export type LibraryStockResponse = z.infer<typeof LibraryStockResponseSchema>;

// 내부 핵심 데이터 타입 (새로 추가 및 대체)
export type ApiCombinedBookData = z.infer<typeof ApiCombinedBookDataSchema>;
export type UserActivityData = z.infer<typeof UserActivityDataSchema>;
export type BookData = z.infer<typeof BookDataSchema>;
export type SelectedBook = z.infer<typeof SelectedBookSchema>;

// ▲▲▲▲▲▲▲▲▲▲ 여기까지 새로 추가 ▲▲▲▲▲▲▲▲▲▲


// ======== 이동 =======

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

export interface GyeonggiEduEbookList {
  소장도서관: string;
  도서명: string;
  저자: string;
  출판사: string;
  발행일: string;
  대출상태: '대출가능' | '대출불가';
}

export interface GyeonggiEduEbookError {
  error: string;
}

export interface GwangjuPaperError {
  error: string;
}

// 경기도 전자도서관 관련 타입 정의
export interface GyeonggiEbookList {
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

export interface GyeonggiEbookResult {
  library_name: string;
  total_count: number;
  available_count: number;
  unavailable_count: number;
  owned_count: number;
  subscription_count: number;
  book_list: GyeonggiEbookList[];
}

export interface GyeonggiEbookError {
  error: string;
}

// 시립도서관 전자책 관련 타입 정의
export interface SiripEbook {
  type: '전자책';
  title: string;
  author: string;
  publisher: string;
  publish_date: string;
  loan_status: string;
  status: '대출가능' | '대출불가';
  total_count: number;
  available_count: number;
  available: boolean;
  library_name: string;
}

export interface SiripEbookResult {
  library_name: string;
  total_count: number;
  available_count: number;
  unavailable_count: number;
  book_list: SiripEbook[];
  // 새로운 통합 구조 지원
  details?: {
    owned: {
      library_name: string;
      total_count: number;
      available_count: number;
      unavailable_count: number;
      book_list: SiripEbook[];
      error?: string;
    };
    subscription: {
      library_name: string;
      total_count: number;
      available_count: number;
      unavailable_count: number;
      book_list: SiripEbook[];
      error?: string;
    };
  };
  // 통합 결과 정보
  sirip_ebook_summary?: {
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

// 광주시립도서관 종이책 추가
export interface GwangjuPaperResult {
  library_name: string,
  summary_total_count: number;
  summary_available_count: number;
  toechon_total_count: number;
  toechon_available_count: number;
  other_total_count: number;
  other_available_count: number;
  book_title: string;
  book_list: PaperBookAvailability[];
}

export interface LibraryApiResponse {
  gwangju_paper: GwangjuPaperResult | GwangjuPaperError;
  // gyeonggi_ebook_edu: (GyeonggiEduEbookList | GyeonggiEduEbookError)[]; // 배열타입
  gyeonggi_ebook_edu: GyeonggiEduEbookResult | GyeonggiEduEbookError; // 객체 타입으로 변경
  gyeonggi_ebook_library?: GyeonggiEbookResult | GyeonggiEbookError;
  sirip_ebook?: SiripEbookResult | SiripEbookError;
}

// [추가] gyeonggi_ebook_edu의 새로운 객체 타입을 정의합니다.
export interface GyeonggiEduEbookResult {
  library_name: string;
  total_count: number;
  available_count: number;
  unavailable_count: number;
  seongnam_count: number;
  tonghap_count: number;
  error_count: number;
  error_lib_detail?: string; // [수정] 선택적 필드로 error_lib_detail 추가
  book_list: (GyeonggiEduEbookList | GyeonggiEduEbookError)[];
}

export interface GyeonggiEduEbookSummary {
  total_count: number;
  available_count: number;
  unavailable_count: number;
  seongnam_count: number;
  tonghap_count: number;
  error_count: number;
  error_lib_detail?: string; // [수정] 선택적 필드 추가
}

// [추가] 도서관별 바로가기 URL을 생성하는 통합 함수
export type LibraryName = '퇴촌' | '기타' | 'e교육' | 'e시립구독' | 'e시립소장' | 'e경기';

// ======== 이동 =======

// Internal types that don't need runtime validation from an external source
// Making StockInfo compatible with Json type by using record syntax
export type StockInfo = {
  total_count: number;
  available_count: number;
};

export type ReadStatus = '읽지 않음' | '읽는 중' | '완독';

// Extended EBook information for storage
export type EBookInfo = {
  summary: GyeonggiEduEbookSummary;
  details: (GyeonggiEduEbookList | GyeonggiEduEbookError)[];
  lastUpdated: number;
};



export type SortKey = 'title' | 'author' | 'addedDate' | 'rating' | 'readStatus' | 'pubDate';

// Bulk Search Types
export type BulkSearchStatus = 'pending' | 'searching' | 'found' | 'multiple' | 'none' | 'error';

export type BulkSearchResult = {
  id: string;
  inputTitle: string;
  searchQuery: string; // 실제 검색에 사용된 쿼리 (앞 2개 단어)
  searchResults: AladdinBookItem[];
  selectedBook: AladdinBookItem | null;
  status: BulkSearchStatus;
  errorMessage?: string;
  isEditing?: boolean; // 현재 편집 중인지 여부
  originalInputTitle?: string; // 편집 전 원본 제목 보관
};

// ✅ [추가] 새로운 일괄 갱신 타입을 위한 타입 정의
export type RefreshType = 'recent' | 'old' | 'all' | 'range';
export type RefreshLimit = number | 'all';

// Custom Tag Types
// export type TagColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink' | 'gray';
// export type TagColor = 'primary' | 'secondary';
export type TagColor = 'primary' | 'secondary' | 'tertiary'; // ✅ 태그 컬러 'tertiary' 추가

export type CustomTag = {
  id: string;
  name: string;
  color: TagColor;
  createdAt: number;
  updatedAt: number;
};

export type UserTagSettings = {
  tags: CustomTag[];
  maxTags: number;
};

// Theme Types
export type Theme = 'light' | 'dark' | 'system';

// User Settings Types
export type UserSettings = {
  showReadStatus: boolean;
  showRating: boolean;
  showTags: boolean;
  showLibraryStock: boolean;
  showFavorites: boolean;
  showBookNotes: boolean; // 메모 표시 설정
  defaultPageSize: number;
  tagSettings: UserTagSettings;
  theme: Theme;
};


// Supabase Types
export interface Database {
  public: {
    Tables: {
      user_library: {
        Row: {
          id: number;
          created_at: string;
          user_id: string;
          book_data: BookData | null;
          note: string | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          user_id: string;
          book_data: Json;
          note?: string;
        };
        Update: {
          id?: number;
          created_at?: string;
          user_id?: string;
          book_data?: Json;
          note?: string;
        };
      };
      user_settings: {
        Row: {
          id: number;
          created_at: string;
          updated_at: string;
          user_id: string;
          settings: UserSettings;
        };
        Insert: {
          id?: number;
          created_at?: string;
          updated_at?: string;
          user_id: string;
          settings: UserSettings;
        };
        Update: {
          id?: number;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          settings?: UserSettings;
        };
      };
      dev_notes: {
        Row: {
          id: number;
          created_at: string;
          updated_at: string;
          user_id: string;
          content: string;
          title: string;
        };
        Insert: {
          id?: number;
          created_at?: string;
          updated_at?: string;
          user_id: string;
          content: string;
          title?: string;
        };
        Update: {
          id?: number;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          content?: string;
          title?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
