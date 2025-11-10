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
});

export const AladdinAPIResponseSchema = z.object({
  item: z.array(AladdinBookItemSchema).optional(),
  errorCode: z.number().optional(),
  errorMessage: z.string().optional(),
});

// ✅ 런타임 검증이 가능한 Zod 스키마 정의 (신규 추가)
// ▼▼▼▼▼▼▼▼▼▼ 여기에 아래 내용을 새로 추가합니다 ▼▼▼▼▼▼▼▼▼▼

// --- Zod 스키마 및 타입 추론 (신규 및 대체) ---

// 1. 순수 API 정보 스키마 (기존 BookData의 API 관련 부분)
export const ApiCombinedBookDataSchema = AladdinBookItemSchema.extend({
  lastUpdated: z.number().optional(), // ✅ API 업데이트 시점
  // 도서관 API 원본 정보. 타입이 복잡하므로 z.any()로 처리하고, 런타임 검증이 꼭 필요하다면 별도 스키마 정의.
  gwangjuPaperInfo: z.any().optional(),
  gyeonggiEduEbookInfo: z.any().nullable().optional(), // 기존 EBookInfo 타입과 유사
  gyeonggiEbookInfo: z.any().nullable().optional(),
  siripEbookInfo: z.any().nullable().optional(),

  // 화면 표시를 위한 파생/요약 정보
  toechonStock: z.object({ totalCount: z.number(), availableCount: z.number() }).optional(),
  otherStock: z.object({ totalCount: z.number(), availableCount: z.number() }).optional(),
});

// 2. 사용자 활동 정보 스키마 (기존 BookData의 사용자 관련 부분)
export const UserActivityDataSchema = z.object({
  addedDate: z.number(), // 사용자가 "내 서재에 추가" 시점
  readStatus: z.enum(['읽지 않음', '읽는 중', '완독']),
  rating: z.number().min(0).max(5),
  customTags: z.array(z.string()).optional(),
  isFavorite: z.boolean(),
  customSearchTitle: z.string().optional(),
});

// 3. 위 두 스키마를 합쳐서 새로운 BookDataSchema 정의
// export const BookDataSchema = ApiCombinedBookDataSchema.merge(UserActivityDataSchema);
export const BookDataSchema = ApiCombinedBookDataSchema.merge(UserActivityDataSchema).extend({
  schemaVersion: z.number().optional(), // 👈 [수정] 스키마 버전 속성 추가
});

// 4. DB의 id와 note를 포함한 최종 형태의 스키마 정의
export const SelectedBookSchema = BookDataSchema.extend({
  id: z.number(),
  note: z.string().nullable().optional(), // note는 별도 컬럼이므로 optional
  stock_gwangju_toechon_total: z.number().nullable().optional(),
  stock_gwangju_toechon_available: z.number().nullable().optional(),
  stock_gwangju_other_total: z.number().nullable().optional(),
  stock_gwangju_other_available: z.number().nullable().optional(),
  stock_gyeonggi_edu_total: z.number().nullable().optional(),
  stock_gyeonggi_edu_available: z.number().nullable().optional(),
  stock_sirip_subs_total: z.number().nullable().optional(),
  stock_sirip_subs_available: z.number().nullable().optional(),
  stock_sirip_owned_total: z.number().nullable().optional(),
  stock_sirip_owned_available: z.number().nullable().optional(),
  stock_gyeonggi_total: z.number().nullable().optional(),
  stock_gyeonggi_available: z.number().nullable().optional(),
});

// ▼▼▼▼▼▼▼▼▼▼ 모든 타입 추론을 여기에 모읍니다 ▼▼▼▼▼▼▼▼▼▼
// --- TypeScript 타입 추론 (from Zod Schemas) ---

// 외부 API 관련 타입
export type AladdinBookItem = z.infer<typeof AladdinBookItemSchema>;
export type AladdinAPIResponse = z.infer<typeof AladdinAPIResponseSchema>;

// 내부 핵심 데이터 타입 (새로 추가 및 대체)
export type ApiCombinedBookData = z.infer<typeof ApiCombinedBookDataSchema>;
export type UserActivityData = z.infer<typeof UserActivityDataSchema>;
export type BookData = z.infer<typeof BookDataSchema>;
export type SelectedBook = z.infer<typeof SelectedBookSchema>;

// ▲▲▲▲▲▲▲▲▲▲ 여기까지 새로 추가 ▲▲▲▲▲▲▲▲▲▲


// ======== 이동 =======

export interface PaperBookAvailability {
  libraryName: string;
  callNo: string;
  baseCallNo: string;
  loanStatus: boolean;
  dueDate: string;
}

export interface gyeonggiEduEbookList {
  libraryName: string;
  title: string;
  author: string;
  publisher: string;
  pubDate: string;
  loanStatus: boolean;
}

export interface gyeonggiEduEbookError {
  error: string;
}

export interface GwangjuPaperError {
  error: string;
}

// 경기도 전자도서관 관련 타입 정의
export interface gyeonggiEbookList {
  type: '소장형' | '구독형';
  title: string;
  loanStatus: boolean;
  currentBorrow?: number;
  totalCapacity?: number;
  author?: string;
  publisher?: string;
  isbn?: string;
  owner?: string;
  reservable?: boolean;
  reserveCount?: number;
}

export interface gyeonggiEbookResult {
  libraryName: string;
  totalCountSummary: number;
  availableCountSummary: number;
  unavailableCountSummary: number;
  totalCountOwned: number;
  totalCountSubs: number;
  bookList: gyeonggiEbookList[];
}

export interface gyeonggiEbookError {
  error: string;
}

// 시립도서관 전자책 관련 타입 정의
// export interface SiripEbook {
//   type: '전자책';
//   title: string;
//   author: string;
//   publisher: string;
//   publishDate: string;
//   loanStatus: boolean;
//   totalCount: number;
//   availableCount: number;
//   libraryName: string;
// }

// export interface SiripEbookResult {
//   libraryName: string;
//   totalCountSummary: number;
//   availableCountSummary: number;
//   unavailableCountSummary: number;
//   bookList: SiripEbook[];
//   details?: {
//     owned: {
//       libraryName: string;
//       totalCount: number;
//       availableCount: number;
//       unavailableCount: number;
//       bookList: SiripEbook[];
//       error?: string;
//     };
//     subscription: {
//       libraryName: string;
//       totalCount: number;
//       availableCount: number;
//       unavailableCount: number;
//       bookList: SiripEbook[];
//       error?: string;
//     };
//   };
//   // 통합 결과 정보
//   siripEbookSummary?: {
//     libraryName: string;
//     totalCountSummary: number;
//     availableCountSummary: number;
//     unavailableCountSummary: number;
//     totalCountOwned: number;
//     totalCountSubs: number;
//     searchQuery: string;
//   };
// }

export interface SiripEbookError {
  error: string;
}

// types.ts

// SiripEbookResult 타입을 Zod 스키마로 정의하고 추론하는 방식으로 변경
export const SiripEbookSchema = z.object({
    type: z.enum(['소장형', '구독형']),
    title: z.string(),
    author: z.string(),
    publisher: z.string(),
    publishDate: z.string(),
    loanStatus: z.boolean(),
    // 소장형에만 있는 필드는 optional로 처리
    totalCopies: z.number().optional(),
    availableCopies: z.number().optional(),
});
export type SiripEbookBook = z.infer<typeof SiripEbookSchema>;

export const SiripEbookResultSchema = z.object({
  libraryName: z.string(),
  totalCountSummary: z.number(),
  availableCountSummary: z.number(),
  unavailableCountSummary: z.number(),
  totalCountOwned: z.number(),
  totalCountSubs: z.number(),
  availableCountOwned: z.number(),
  availableCountSubs: z.number(),
  searchQuery: z.string(),
  bookList: z.array(SiripEbookSchema),
  errors: z.object({
    owned: z.string().optional(),
    subscription: z.string().optional(),
  }).optional(),
});
export type SiripEbookResult = z.infer<typeof SiripEbookResultSchema>;

// 기존 interface SiripEbookResult, SiripEbook 등은 삭제하거나 주석 처리합니다.

// 광주시립도서관 종이책 추가
export interface GwangjuPaperResult {
  libraryName: string,
  totalCountSummary: number;
  totalCountToechon: number;
  totalCountOther: number;
  availableCountSummary: number;
  availableCountToechon: number;
  availableCountOther: number;
  title: string;
  bookList: PaperBookAvailability[];
}

export interface LibraryApiResponse {
  title: string; // ✅ 추가
  isbn: string; // ✅ 추가
  author: string; // ✅ 추가
  customTitle?: string; // ✅ 추가
  lastUpdated: number; // ✅ 추가
  gwangjuPaper: GwangjuPaperResult | GwangjuPaperError;
  gyeonggiEbookEdu: gyeonggiEduEbookResult | gyeonggiEduEbookError; // 객체 타입으로 변경
  gyeonggiEbookLib?: gyeonggiEbookResult | gyeonggiEbookError;
  siripEbook?: SiripEbookResult | SiripEbookError;
}

// [추가] gyeonggiEbookEdu의 새로운 객체 타입을 정의합니다.
export interface gyeonggiEduEbookResult {
  libraryName: string;
  totalCountSummary: number;
  availableCountSummary: number;
  unavailableCountSummary: number;
  totalCountSeongnam: number;
  totalCountTonghap: number;
  errorCount: number;
  errorLibDetail?: string; // [수정] 선택적 필드로 errorLibDetail 추가
  bookList: (gyeonggiEduEbookList | gyeonggiEduEbookError)[];
}

export interface gyeonggiEduEbookSummary {
  totalCountSummary: number;
  availableCountSummary: number;
  unavailableCountSummary: number;
  totalCountSeongnam: number;
  totalCountTonghap: number;
  errorCount: number;
  errorLibDetail?: string; // [수정] 선택적 필드 추가
}

// [추가] 도서관별 바로가기 URL을 생성하는 통합 함수
export type LibraryName = '퇴촌' | '기타' | 'e교육' | 'e시립구독' | 'e시립소장' | 'e경기';

// ======== 이동 =======

// Internal types that don't need runtime validation from an external source
// Making StockInfo compatible with Json type by using record syntax
export type StockInfo = {
  totalCount: number;
  availableCount: number;
};

export type ReadStatus = '읽지 않음' | '읽는 중' | '완독';

// Extended EBook information for storage
export type EBookInfo = {
  summary: gyeonggiEduEbookSummary;
  details: (gyeonggiEduEbookList | gyeonggiEduEbookError)[];
  lastUpdated: number;
};

export type SortKey = 'title' | 'author' | 'addedDate' | 'rating' | 'readStatus' | 'pubDate';

export type ViewType = 'card' | 'grid'; // ✅ 이 줄을 추가하세요.

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
  defaultViewType: ViewType; // ✅ 기본 보기 선택
  defaultFilterFavorites: boolean; // ✅ 기본 필터링 선택 : 좋아요 여부
  defaultFilterTagIds: string[];  // ✅ 기본 필터링 선택 : 태그
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
