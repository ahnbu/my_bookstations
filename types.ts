
import { z } from 'zod';
import { 
  EBookAvailability, 
  EBookError, 
  EBookSummary,
  LibraryApiResponse,
  SiripEbookResult,
  SiripEbookError,
  GyeonggiEbookLibraryResult,
  GyeonggiEbookLibraryError
} from './services/unifiedLibrary.service';

// The 'Json' type is no longer exported from 'supabase-js'.
// We define it here to match the expected structure for JSONB columns.
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
  subInfo: z.object({
    ebookList: z.array(z.object({
      itemId: z.number(),
      isbn: z.string(),
      isbn13: z.string(),
      priceSales: z.number(),
      link: z.string(),
    })).optional(),
  }).optional(),
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


// Infer TypeScript types from Zod schemas for external API types
// These need to match the Zod validation exactly
export type AladdinBookItem = z.infer<typeof AladdinBookItemSchema>;
export type AladdinAPIResponse = z.infer<typeof AladdinAPIResponseSchema>;
export type LibraryAvailability = z.infer<typeof LibraryAvailabilitySchema>;
export type LibraryStockResponse = z.infer<typeof LibraryStockResponseSchema>;


// Internal types that don't need runtime validation from an external source
// Making StockInfo compatible with Json type by using record syntax
export type StockInfo = {
  total: number;
  available: number;
};

export type ReadStatus = '읽지 않음' | '읽는 중' | '완독';

// Extended EBook information for storage
export type EBookInfo = {
  summary: EBookSummary;
  details: (EBookAvailability | EBookError)[];
  lastUpdated: number;
};

// This is the shape of the data that will be stored in the 'book_data' jsonb column.
export type BookData = AladdinBookItem & {
  toechonStock: StockInfo;
  otherStock: StockInfo;
  ebookInfo?: EBookInfo; // New ebook information
  gyeonggiEbookInfo?: GyeonggiEbookLibraryResult | GyeonggiEbookLibraryError; // 경기도 전자도서관 정보 (원본)
  filteredGyeonggiEbookInfo?: GyeonggiEbookLibraryResult | GyeonggiEbookLibraryError; // ISBN 매칭 필터링된 경기도 전자도서관 정보
  siripEbookInfo?: SiripEbookResult | SiripEbookError; // 시립도서관 전자책 정보
  // 상세 재고 정보 (클릭 가능한 링크를 위한 파라미터 포함)
  detailedStockInfo?: {
    gwangju_paper?: {
      book_title: string;
      availability: {
        소장도서관: string;
        청구기호: string;
        기본청구기호: string;
        대출상태: '대출가능' | '대출불가';
        반납예정일: string;
        recKey?: string;
        bookKey?: string;
        publishFormCode?: string;
      }[];
    };
  };
  addedDate: number;
  readStatus: ReadStatus;
  rating: number;
  customTags?: string[]; // 태그 ID 배열
};

// This represents a book object within the application's state, including its database ID.
export type SelectedBook = BookData & {
  id: number;
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

// Custom Tag Types
// export type TagColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink' | 'gray';
export type TagColor = 'primary' | 'secondary';

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
        };
        Insert: {
          id?: number;
          created_at?: string;
          user_id: string;
          book_data: Json;
        };
        Update: {
          id?: number;
          created_at?: string;
          user_id?: string;
          book_data?: Json;
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
