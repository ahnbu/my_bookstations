import { z } from 'zod';

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

// This is the shape of the data that will be stored in the 'book_data' jsonb column.
export type BookData = AladdinBookItem & {
  toechonStock: StockInfo;
  otherStock: StockInfo;
  addedDate: number;
  readStatus: ReadStatus;
  rating: number;
};

// This represents a book object within the application's state, including its database ID.
export type SelectedBook = BookData & {
  id: number;
};

export type SortKey = 'title' | 'author' | 'addedDate' | 'rating' | 'readStatus';


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