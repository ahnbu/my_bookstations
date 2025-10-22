
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { AladdinBookItem, SortKey, ReadStatus, Json, EBookInfo, StockInfo, GwangjuPaperResult, GyeonggiEduEbookError, GyeonggiEbookResult, 
  ApiCombinedBookData, // ✅ 새로 추가
  BookData,            // ✅ 새로 추가 (기존 타입 대체)
  SelectedBook,        // ✅ 새로 추가 (기존 타입 대체)
} from '../types';
import { searchAladinBooks } from '../services/aladin.service';
// import { filterGyeonggiEbookByIsbn } from '../utils/isbnMatcher';
import { useUIStore } from './useUIStore';
import { useAuthStore } from './useAuthStore';
import { useSettingsStore } from './useSettingsStore';
import { fetchBookAvailability} from '../services/unifiedLibrary.service'; // GyeonggiEbookLibraryResult 임포트 추가
import { createBookDataFromApis } from '../utils/bookDataCombiner';

/**
 * 특정 책의 데이터를 업데이트하고, 로컬 상태와 Supabase DB를 동기화하는 헬퍼 함수
 * @param id 업데이트할 책의 ID
 * @param updates BookData 객체의 일부. 변경할 내용만 담습니다.
 * @param errorMessage DB 업데이트 실패 시 보여줄 알림 메시지
 */

// async function updateBookInStoreAndDB(
//   id: number,
//   updates: Partial<Omit<SelectedBook, 'id'>>, // ✅ SelectedBook 기준으로 변경
//   // updates: Partial<Omit<BookData, 'id'>>,
//   // updates: Partial<Omit<BookData, 'id' | 'note'>>, // ✅ note는 별도 컬럼이므로 Omit에 추가
//   errorMessage: string = '책 정보 업데이트에 실패했습니다.'
// ): Promise<void> {
//   // [핵심 수정] getBookById를 호출하여 모든 데이터 소스에서 책을 찾음
//   const originalBook = await useBookStore.getState().getBookById(id);

//   if (!originalBook) {
//     console.warn(`[updateBook] Book with id ${id} not found in any available source.`);
//     return;
//   }

//   // 1. 낙관적 업데이트 (기존 로직과 동일)
//   const updatedBook: SelectedBook = { ...originalBook, ...updates };
//   useBookStore.setState(state => ({
//     myLibraryBooks: state.myLibraryBooks.map(b => (b.id === id ? updatedBook : b)),
//     librarySearchResults: state.librarySearchResults.map(b => (b.id === id ? updatedBook : b)),
//     libraryTagFilterResults: state.libraryTagFilterResults.map(b => (b.id === id ? updatedBook : b)),
//     selectedBook:
//       state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id
//         ? updatedBook
//         : state.selectedBook,
//   }));

//   // 2. DB 업데이트 (기존 로직과 동일)
//   // const { id: bookId, detailedStockInfo, note, ...bookDataForDb } = updatedBook;
//   const { id: bookId, note, ...bookDataForDb } = updatedBook; // ✅ detailedStockInfo 제거

//   try {
//     const updateData: { book_data: Json; note?: string | null; title?: string; author?: string } = {
//       title: updatedBook.title,
//       author: updatedBook.author,
//       book_data: bookDataForDb as unknown as Json
//     };
//     if ('note' in updates) {
//       updateData.note = note || null;
//     }
//     const { error } = await supabase
//       .from('user_library')
//       .update(updateData)
//       .eq('id', id);
//     if (error) throw error;
//   } catch (error) {
//     // 3. 롤백 (기존 로직과 동일)
//     console.error(`[updateBook] Failed to update book (id: ${id}) in DB:`, error);
//     useUIStore.getState().setNotification({
//       message: `${errorMessage} 변경사항이 저장되지 않았을 수 있습니다.`,
//       type: 'error',
//     });
//     useBookStore.setState(state => ({
//       myLibraryBooks: state.myLibraryBooks.map(b => (b.id === id ? originalBook : b)),
//       librarySearchResults: state.librarySearchResults.map(b => (b.id === id ? originalBook : b)),
//       libraryTagFilterResults: state.libraryTagFilterResults.map(b => (b.id === id ? originalBook : b)),
//       selectedBook:
//         state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id
//           ? originalBook
//           : state.selectedBook,
//     }));
//   }
// }

// ▼▼▼▼▼▼▼▼▼▼ 이 함수를 아래 코드로 완전히 교체하세요 ▼▼▼▼▼▼▼▼▼▼
async function updateBookInStoreAndDB(
  id: number,
  updates: Partial<Omit<SelectedBook, 'id'>>, // ✅ SelectedBook 기준으로 변경 (가장 정확한 타입)
  errorMessage: string = '책 정보 업데이트에 실패했습니다.'
): Promise<void> {
  const originalBook = await useBookStore.getState().getBookById(id);

  if (!originalBook) {
    console.warn(`[updateBook] Book with id ${id} not found.`);
    return;
  }

  // 1. 낙관적 업데이트
  const updatedBook: SelectedBook = { ...originalBook, ...updates };
  useBookStore.setState(state => ({
    myLibraryBooks: state.myLibraryBooks.map(b => (b.id === id ? updatedBook : b)),
    librarySearchResults: state.librarySearchResults.map(b => (b.id === id ? updatedBook : b)),
    libraryTagFilterResults: state.libraryTagFilterResults.map(b => (b.id === id ? updatedBook : b)),
    selectedBook:
      state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id
        ? updatedBook
        : state.selectedBook,
  }));

  // 2. DB 업데이트
  // `book_data`에 저장될 객체에서 최상위 컬럼인 id, note를 제외
  const { id: bookId, note, ...bookDataForDb } = updatedBook; 
  
  try {
    const updateData: {
      book_data: Json;
      title?: string;
      author?: string;
      note?: string | null;
    } = {
      title: updatedBook.title,
      author: updatedBook.author,
      book_data: bookDataForDb as unknown as Json,
    };

    if (Object.prototype.hasOwnProperty.call(updates, 'note')) {
      updateData.note = updates.note ?? null;
    }

    const { error } = await supabase
      .from('user_library')
      .update(updateData)
      .eq('id', id);
      
    if (error) throw error;

  } catch (error) {
    // 3. 롤백
    console.error(`[updateBook] Failed to update book (id: ${id}) in DB:`, error);
    // ... (롤백 로직은 기존과 동일)
    useBookStore.setState(state => ({
        myLibraryBooks: state.myLibraryBooks.map(b => (b.id === id ? originalBook : b)),
        librarySearchResults: state.librarySearchResults.map(b => (b.id === id ? originalBook : b)),
        libraryTagFilterResults: state.libraryTagFilterResults.map(b => (b.id === id ? originalBook : b)),
        selectedBook:
          state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id
            ? originalBook
            : state.selectedBook,
    }));
  }
}
// ▲▲▲▲▲▲▲▲▲▲ 여기까지 교체 ▲▲▲▲▲▲▲▲▲▲


interface BookState {
  getBookById: (id: number) => Promise<SelectedBook | null>; // [추가]
  searchResults: AladdinBookItem[];
  selectedBook: AladdinBookItem | SelectedBook | null;
  myLibraryBooks: SelectedBook[];
  myLibraryIsbnSet: Set<string>; // ✅ [신규] ISBN을 저장할 Set 추가
  sortConfig: { key: SortKey; order: 'asc' | 'desc' };
  refreshingIsbn: string | null;
  refreshingEbookId: number | null;
  librarySearchQuery: string;
  authorFilter: string;
  resetLibraryFilters?: () => void;
  // isAllLoaded: boolean; // ✅ 이 라인을 추가하세요.
  isAllBooksLoaded: boolean;
  totalBooksCount: number;
  tagCounts: Record<string, number>;

  // Server-based library search
  librarySearchResults: SelectedBook[];
  isSearchingLibrary: boolean;

  // Server-based tag filtering
  libraryTagFilterResults: SelectedBook[];
  isFilteringByTag: boolean;

  // Pagination state
  currentPage: number;
  hasMoreResults: boolean;
  isLoadingMore: boolean;
  lastSearchQuery: string;
  lastSearchType: string;

  fetchRawBookData: (id: number) => Promise<BookData | null>; // 책상세>API book_data 조회

  // Bulk refresh state
  bulkRefreshState: {
    isRunning: boolean;
    isPaused: boolean;
    isCancelled: boolean;
    current: number;
    total: number;
    failed: number[];
  };

  // Actions
  searchBooks: (query: string, searchType: string) => Promise<void>;
  loadMoreSearchResults: () => Promise<void>;
  selectBook: (book: AladdinBookItem | SelectedBook, options?: { scroll?: boolean }) => void;
  unselectBook: () => void;
  addToLibrary: () => Promise<void>;
  removeFromLibrary: (id: number) => Promise<void>;
  refreshBookInfo: (id: number, isbn13: string, title: string) => Promise<void>;
  sortLibrary: (key: SortKey) => void;
  fetchUserLibrary: () => Promise<void>;
  fetchRemainingLibrary: () => Promise<void>;
  clearLibrary: () => void;
  updateReadStatus: (id: number, status: ReadStatus) => Promise<void>;
  updateRating: (id: number, rating: number) => Promise<void>;
  // updateMissingEbookIsbn13: () => Promise<void>;
  setLibrarySearchQuery: (query: string) => void;
  addTagToBook: (id: number, tagId: string) => Promise<void>;
  removeTagFromBook: (id: number, tagId: string) => Promise<void>;
  updateBookTags: (id: number, tagIds: string[]) => Promise<void>;
  updateMultipleBookTags: (
    bookUpdates: Array<{id: number, tagIds: string[]}>
  ) => Promise<{ success: number; failed: number; failures: number[]; }>;
  toggleFavorite: (id: number) => Promise<void>;
  updateBookNote: (id: number, note: string) => Promise<void>;
  updateCustomSearchTitle: (id: number, title: string) => Promise<void>; // [추가]
  setResetLibraryFilters: (resetFn?: () => void) => void;
  setAuthorFilter: (author: string) => void;
  clearAuthorFilter: () => void;
  searchUserLibrary: (query: string) => Promise<void>;
  clearLibrarySearch: () => void;
  fetchTagCounts: () => Promise<void>;
  filterLibraryByTags: (tagIds: string[]) => Promise<void>;
  clearLibraryTagFilter: () => void;
  bulkRefreshAllBooks: (
    limit: number | 'all',
    callbacks: {
      onProgress: (current: number, total: number, failed: number) => void;
      onComplete: (success: number, failed: number[]) => void;
      shouldPause: () => boolean;
      shouldCancel: () => boolean;
    }
  ) => Promise<void>;
  pauseBulkRefresh: () => void;
  resumeBulkRefresh: () => void;
  cancelBulkRefresh: () => void;
  isBookInLibrary: (isbn13: string) => boolean; // ✅ [신규] 중복 검사 함수 시그니처 추가
}

// 검색 결과 기본 로딩 개수
const default_search_results = 40;

export const useBookStore = create<BookState>(
    (set, get) => ({
      // State
      searchResults: [],
      selectedBook: null,
      myLibraryBooks: [],
      myLibraryIsbnSet: new Set(), // ✅ Set 초기화
      sortConfig: { key: 'addedDate', order: 'desc' },
      refreshingIsbn: null,
      refreshingEbookId: null,
      librarySearchQuery: '',
      authorFilter: '',
      resetLibraryFilters: undefined,
      isAllBooksLoaded: false,
      totalBooksCount: 0,
      tagCounts: {},
      librarySearchResults: [],
      isSearchingLibrary: false,
      libraryTagFilterResults: [],
      isFilteringByTag: false,

      // Pagination state
      currentPage: 1,
      hasMoreResults: false,
      isLoadingMore: false,
      lastSearchQuery: '',
      lastSearchType: '',

      // Bulk refresh state
      bulkRefreshState: {
        isRunning: false,
        isPaused: false,
        isCancelled: false,
        current: 0,
        total: 0,
        failed: [],
      },

      isBookInLibrary: (isbn13: string) => {
        // ✅ 함수 구현: Set에서 확인
        return get().myLibraryIsbnSet.has(isbn13);
      },

      // [추가] 책상세>API book_data 조회
      fetchRawBookData: async (id: number) => {
        const { session } = useAuthStore.getState();
        if (!session) return null;

        try {
          const { data, error } = await supabase
            .from('user_library')
            .select('book_data')
            .eq('id', id)
            .single();

          if (error) throw error;
          
          return data?.book_data || null;

        } catch (error) {
          console.error(`Error fetching raw book data for id ${id}:`, error);
          useUIStore.getState().setNotification({ message: 'API 원본 데이터를 불러오는 데 실패했습니다.', type: 'error' });
          return null;
        }
      },

      // [추가] ID로 단일 책 조회 함수
      getBookById: async (id: number) => {
          const { session } = useAuthStore.getState();
          if (!session) return null;

          // 1. 먼저 로컬 상태(myLibraryBooks, searchResults 등)에서 찾아보기
          const localBooks = [
              ...get().myLibraryBooks, 
              ...get().librarySearchResults, 
              ...get().libraryTagFilterResults
          ];
          const uniqueLocalBooks = Array.from(new Map(localBooks.map(b => [b.id, b])).values());
          const foundBook = uniqueLocalBooks.find(b => b.id === id);
          if (foundBook) {
              return foundBook;
          }

          // 2. 로컬에 없으면 DB에 직접 요청
          try {
              const { data, error } = await supabase
                  .from('user_library')
                  .select('id, book_data, note')
                  .eq('user_id', session.user.id)
                  .eq('id', id)
                  .single();

              if (error) throw error;
              if (!data || !data.book_data) return null;
              
              const bookDataWithDefaults = {
                  ...{ readStatus: '읽지 않음', rating: 0 },
                  ...data.book_data,
              };
              const fetchedBook: SelectedBook = {
                  ...bookDataWithDefaults,
                  id: data.id,
                  note: data.note,
              };

              // (선택적) 가져온 책을 myLibraryBooks에 추가하여 캐싱 효과
              set(state => ({
                  myLibraryBooks: Array.from(new Map([...state.myLibraryBooks, fetchedBook].map(b => [b.id, b])).values())
              }));

              return fetchedBook;

          } catch (error) {
              console.error(`Error fetching book by ID (${id}):`, error);
              useUIStore.getState().setNotification({ message: '책 정보를 불러오는 데 실패했습니다.', type: 'error' });
              return null;
          }
      },


      // Actions
      // fetchUserLibrary: async () => {
      //   const { session } = useAuthStore.getState();
      //   if (!session) return;

      //   const { setIsLoading, setNotification } = useUIStore.getState();
      //   setIsLoading(true);

      //   try {
      //       // ✅ [핵심] fetchUserLibrary가 성공할 때마다 Set을 새로 만듦
      //       // 이 로직은 페이지네이션과 무관하게, 전체 책의 ISBN을 가져와야 함.
      //       // 이를 위해 별도의 RPC 함수를 호출하거나, 전체 ID를 가져오는 쿼리를 실행해야 함.
            
      //       // --- 가장 간단한 해결책: 전체 ISBN 목록을 가져오는 RPC 함수 사용 ---
      //       // const { data: isbnData, error: isbnError } = await supabase
      //       //   .rpc('get_all_user_library_isbns')
      //       //   .returns< { isbn: string }[] >(); // ✅ rpc 호출 뒤에 .returns<T[]>()를 추가

      //       // if (isbnError) throw isbnError;

      //       // "DB야, 'get_all_user_library_isbns' 함수 실행하고,
      //       // 내용물은 string 배열(string[])로 꺼내서 줘."
      //       const { data: isbnList, error: isbnError } = await supabase
      //         .rpc('get_all_user_library_isbns')
      //         // .returns<string[]>(); // ✅ 약속된 포장(string[])을 뜯는 과정
      //         .returns<string[]>(); // ✅ 반환 타입이 이제 string의 배열(string[])임
      //       if (isbnError) throw isbnError;

      //       // 받은 물건(isbnList)이 없으면(null) 빈 상자로 간주하고, 재고 목록(Set)을 만든다.
      //       const isbnSet = new Set(isbnList || []);

      //       // const isbnSet = new Set(isbnData.map((item: { isbn: string }) => item.isbn));
      //       // 2. 데이터가 null일 경우를 대비하여 빈 배열로 기본값 처리
      //       // 이제 isbnData는 ({ isbn: string } | null)[] 타입이므로, map을 안전하게 사용할 수 있음
      //       const isbnList = (isbnData || []).map(item => item.isbn);
      //       const isbnSet = new Set(isbnList); // ✅ 이제 isbnSet은 정확히 Set<string> 타입이 됨

      //       // 사용자 설정에서 초기 로딩 건수 가져오기
      //       const { settings } = useSettingsStore.getState();
      //       const pageSize = settings.defaultPageSize;

      //       const { data, error, count } = await supabase
      //           .from('user_library')
      //           .select('id, book_data, note', { count: 'exact' })
      //           .order('created_at', { ascending: false })
      //           .limit(pageSize);

      //       if (error) throw error;

      //       const libraryBooks = data
      //         .map(item => {
      //             if (!item.book_data) return null; // Safety check for null jsonb
      //             // Provide default values for older data that might not have these fields
      //             const bookDataWithDefaults = {
      //                 ...{ readStatus: '읽지 않음', rating: 0 },
      //                 ...item.book_data,
      //             };
      //             return {
      //                 ...bookDataWithDefaults,
      //                 id: item.id,
      //                 note: item.note,
      //             };
      //         })
      //         .filter((book): book is SelectedBook => book !== null);

      //       // pageSize보다 적게 로드되면 전체 로드 완료
      //       // const isAllLoaded = libraryBooks.length < pageSize;
      //       // pageSize보다 적게 로드되거나, 로드된 개수가 전체 개수와 같거나 많으면 '모두 로드됨'으로 간주
      //       const isAllLoaded = libraryBooks.length < pageSize || libraryBooks.length >= (count || 0);

      //       set({
      //         myLibraryBooks: libraryBooks,
      //         myLibraryIsbnSet: isbnSet, // ✅ Set 상태 업데이트
      //         totalBooksCount: count || 0,
      //         isAllBooksLoaded: isAllLoaded, // ✅ 수정된 값 적용
      //       });

      //       // 태그 카운트 갱신
      //       get().fetchTagCounts();
      //       // 자동 전자책 정보 업데이트 제거 - 사용자가 명시적으로 요청할 때만 실행
      //       // get().updateMissingEbookIsbn13();
      //   } catch (error) {
      //       console.error('Error fetching user library:', error);
      //       setNotification({ message: '서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
      //   } finally {
      //       setIsLoading(false);
      //   }
      // },

      // // ▼▼▼▼▼▼▼▼▼▼ 이 함수 전체를 아래 코드로 교체하세요 ▼▼▼▼▼▼▼▼▼▼
      // fetchUserLibrary: async () => {
      //     const { session } = useAuthStore.getState();
      //     if (!session) return;

      //     const { setIsLoading, setNotification } = useUIStore.getState();
      //     setIsLoading(true);

      //     try {
      //         // --- 1. 전체 ISBN 목록 가져오기 ---
      //         // Supabase 함수가 이제 string[] 형태의 JSON을 반환하므로, .returns<string[]>()를 사용합니다.
      //         const { data: isbnList, error: isbnError } = await supabase
      //           .rpc('get_all_user_library_isbns')
      //           .returns<string[]>();

      //         if (isbnError) {
      //           // rpc 호출 실패 시, isbn 목록을 빈 배열로 간주하고 계속 진행하되, 콘솔에 에러를 남깁니다.
      //           console.error('Error fetching all ISBNs:', isbnError);
      //         }
              
      //         // isbnList는 string[] | null 타입입니다. null일 경우 빈 배열로 처리하여 isbnSet을 생성합니다.
      //         const isbnSet = new Set(isbnList || []);


      //         // --- 2. 페이지네이션된 책 목록 가져오기 ---
      //         const { settings } = useSettingsStore.getState();
      //         const pageSize = settings.defaultPageSize;

      //         const { data, error, count } = await supabase
      //             .from('user_library')
      //             .select('id, book_data, note', { count: 'exact' })
      //             .order('created_at', { ascending: false })
      //             .limit(pageSize);

      //         if (error) throw error; // 이 부분에서 에러가 나면 서재 로딩 전체를 실패 처리

      //         const libraryBooks = data
      //           .map(item => {
      //               if (!item.book_data) return null;
      //               const bookDataWithDefaults = {
      //                   ...{ readStatus: '읽지 않음', rating: 0 },
      //                   ...item.book_data,
      //               };
      //               return {
      //                   ...bookDataWithDefaults,
      //                   id: item.id,
      //                   note: item.note,
      //               };
      //           })
      //           .filter((book): book is SelectedBook => book !== null);

      //         // --- 3. 최종 상태 업데이트 ---
      //         const totalBooksCount = count || 0;
      //         const isAllLoaded = libraryBooks.length >= totalBooksCount;

      //         set({
      //           myLibraryBooks: libraryBooks,
      //           myLibraryIsbnSet: isbnSet, // ✅ 타입이 일치하는 Set<string> 할당
      //           totalBooksCount: totalBooksCount,
      //           isAllBooksLoaded: isAllLoaded,
      //         });

      //         get().fetchTagCounts();

      //     } catch (error) {
      //         console.error('Error fetching user library:', error);
      //         setNotification({ message: '서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
      //     } finally {
      //         setIsLoading(false);
      //     }
      // },
      // // ▲▲▲▲▲▲▲▲▲▲ 여기까지 교체 ▲▲▲▲▲▲▲▲▲▲


      // useBook-store.ts

      // // ▼▼▼▼▼▼▼▼▼▼ 동작 but 초기 로딩 외 중복체크x ▼▼▼▼▼▼▼▼▼▼
      // fetchUserLibrary: async () => {
      //     const { session } = useAuthStore.getState();
      //     if (!session) return;

      //     const { setIsLoading, setNotification } = useUIStore.getState();
      //     setIsLoading(true);

      //     try {
      //         // --- 1. 전체 ISBN 목록 가져오기 ---
      //         const { data: isbnData, error: isbnError } = await supabase
      //           .rpc('get_all_user_library_isbns')
      //           .returns<string[]>();

      //         if (isbnError) {
      //           console.error('Error fetching all ISBNs:', isbnError);
      //         }
              
      //         // ▼▼▼▼▼▼▼▼▼▼ 이 부분이 핵심 수정 사항입니다 ▼▼▼▼▼▼▼▼▼▼
      //         let isbnSet: Set<string>; // isbnSet 변수를 미리 선언

      //         // [타입 가드] isbnData가 null이 아니고, '배열' 형태인지 명시적으로 확인
      //         if (Array.isArray(isbnData)) {
      //           // 이 블록 안에서 TypeScript는 isbnData를 string[]로 100% 신뢰함
      //           isbnSet = new Set(isbnData);
      //         } else {
      //           // isbnData가 null이거나, 예기치 않은 Error 객체인 경우 빈 Set으로 초기화
      //           isbnSet = new Set();
      //           if (isbnData) { // Error 객체인 경우 콘솔에 로그를 남겨 디버깅 지원
      //             console.warn("Unexpected data format for ISBN list:", isbnData);
      //           }
      //         }
      //         // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

      //         // --- 2. 페이지네이션된 책 목록 가져오기 (이하 동일) ---
      //         const { settings } = useSettingsStore.getState();
      //         const pageSize = settings.defaultPageSize;

      //         const { data, error, count } = await supabase
      //             .from('user_library')
      //             .select('id, book_data, note', { count: 'exact' })
      //             .order('created_at', { ascending: false })
      //             .limit(pageSize);

      //         if (error) throw error; 

      //         // const libraryBooks = data.map(/* ... */).filter(/* ... */);

      //         const libraryBooks = data
      //           .map(item => {
      //               if (!item.book_data) return null;
      //               const bookDataWithDefaults = {
      //                   ...{ readStatus: '읽지 않음', rating: 0 },
      //                   ...item.book_data,
      //               };
      //               return {
      //                   ...bookDataWithDefaults,
      //                   id: item.id,
      //                   note: item.note,
      //               };
      //           })
      //           .filter((book): book is SelectedBook => book !== null);
                
      //         // --- 3. 최종 상태 업데이트 (이하 동일) ---
      //         const totalBooksCount = count || 0;
      //         const isAllLoaded = libraryBooks.length >= totalBooksCount;

      //         set({
      //           myLibraryBooks: libraryBooks,
      //           myLibraryIsbnSet: isbnSet,
      //           totalBooksCount: totalBooksCount,
      //           isAllBooksLoaded: isAllLoaded,
      //         });

      //         get().fetchTagCounts();

      //     } catch (error) {
      //         console.error('Error fetching user library:', error);
      //         setNotification({ message: '서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
      //     } finally {
      //         setIsLoading(false);
      //     }
      // },
      // // ▲▲▲▲▲▲▲▲▲▲ 여기까지 교체 ▲▲▲▲▲▲▲▲▲▲

      // 디버깅 코드

      // fetchUserLibrary: async () => {
      //     const { session } = useAuthStore.getState();
      //     if (!session) return;

      //     const { setIsLoading, setNotification } = useUIStore.getState();
      //     setIsLoading(true);

      //     try {
      //         // --- 1. 전체 ISBN 목록 가져오기 ---
      //         const { data: isbnData, error: isbnError } = await supabase
      //           .rpc('get_all_user_library_isbns')
      //           .returns<string[]>();

      //         if (isbnError) {
      //           console.error('Error fetching all ISBNs:', isbnError);
      //         }
              
      //         // ▼▼▼▼▼▼▼▼▼▼ [디버깅 로그 #1 추가] ▼▼▼▼▼▼▼▼▼▼
      //         console.log('[DEBUG 1] Raw data from RPC (isbnData):', isbnData);
      //         // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

      //         let isbnSet: Set<string>;

      //         if (Array.isArray(isbnData)) {
      //           isbnSet = new Set(isbnData);
      //           // ▼▼▼▼▼▼▼▼▼▼ [디버깅 로그 #2 추가] ▼▼▼▼▼▼▼▼▼▼
      //           console.log(`[DEBUG 2] ISBN Set created successfully. Size: ${isbnSet.size}`);
      //           // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
      //         } else {
      //           isbnSet = new Set();
      //           // ▼▼▼▼▼▼▼▼▼▼ [디버깅 로그 #3 추가] ▼▼▼▼▼▼▼▼▼▼
      //           console.log('[DEBUG 3] isbnData was not an array. Created an empty Set.');
      //           // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
      //           if (isbnData) {
      //             console.warn("Unexpected data format for ISBN list:", isbnData);
      //           }
      //         }

      //         // --- 2. 페이지네이션된 책 목록 가져오기 (이하 동일) ---
      //         const { settings } = useSettingsStore.getState();
      //         const pageSize = settings.defaultPageSize;

      //         const { data, error, count } = await supabase
      //             .from('user_library')
      //             .select('id, book_data, note', { count: 'exact' })
      //             .order('created_at', { ascending: false })
      //             .limit(pageSize);

      //         if (error) throw error; 

      //         const libraryBooks = data
      //           .map(/* ... */)
      //           .filter(/* ... */);
                    
      //         // --- 3. 최종 상태 업데이트 (이하 동일) ---
      //         const totalBooksCount = count || 0;
      //         const isAllLoaded = libraryBooks.length >= totalBooksCount;

      //         set({
      //           myLibraryBooks: libraryBooks,
      //           myLibraryIsbnSet: isbnSet,
      //           totalBooksCount: totalBooksCount,
      //           isAllLoaded: isAllLoaded,
      //         });

      //         get().fetchTagCounts();

      //     } catch (error) {
      //         console.error('Error fetching user library:', error);
      //         setNotification({ message: '서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
      //     } finally {
      //         setIsLoading(false);
      //     }
      // },


      // fetchUserLibrary: async () => {
      //     const { session } = useAuthStore.getState();
      //     if (!session) return;

      //     const { setIsLoading, setNotification } = useUIStore.getState();
      //     setIsLoading(true);

      //     try {
      //         // --- 1. 전체 ISBN 목록 가져오기 (이 부분은 이제 완벽합니다) ---
      //         const { data: isbnList, error: isbnError } = await supabase
      //           .rpc('get_all_user_library_isbns')
      //           .returns<string[]>();

      //         if (isbnError) {
      //           console.error('Error fetching all ISBNs:', isbnError);
      //         }
              
      //         let isbnSet: Set<string>;
      //         if (Array.isArray(isbnList)) {
      //           isbnSet = new Set(isbnList);
      //         } else {
      //           isbnSet = new Set();
      //         }

      //         // --- 2. 페이지네이션된 책 목록 가져오기 ---
      //         const { settings } = useSettingsStore.getState();
      //         const pageSize = settings.defaultPageSize;

      //         const { data, error, count } = await supabase
      //             .from('user_library')
      //             .select('id, book_data, note', { count: 'exact' })
      //             .order('created_at', { ascending: false })
      //             .limit(pageSize);

      //         if (error) throw error;

      //         // ▼▼▼▼▼▼▼▼▼▼ 이 부분이 핵심 수정 사항입니다 ▼▼▼▼▼▼▼▼▼▼
      //         // [타입 가드] supabase에서 반환된 data가 배열인지 확인
      //         const libraryBooks = (Array.isArray(data) ? data : [])
      //           .map(item => {
      //               // item이나 item.book_data가 null일 경우를 대비
      //               if (!item || !item.book_data) return null;
                    
      //               const bookDataWithDefaults = {
      //                   ...{ readStatus: '읽지 않음', rating: 0 },
      //                   ...item.book_data,
      //               };
      //               return {
      //                   ...bookDataWithDefaults,
      //                   id: item.id,
      //                   note: item.note,
      //               };
      //           })
      //           .filter((book): book is SelectedBook => book !== null);
      //         // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

      //         // --- 3. 최종 상태 업데이트 (이하 동일) ---
      //         const totalBooksCount = count || 0;
      //         const isAllLoaded = libraryBooks.length >= totalBooksCount;

      //         set({
      //           myLibraryBooks: libraryBooks,
      //           // myLibraryIs_bnSet: isbnSet,
      //           myLibraryIsbnSet: isbnSet, // ✅ 'IsbnSet'으로 오타 수정
      //           totalBooksCount: totalBooksCount,
      //           isAllBooksLoaded: isAllLoaded,
      //         });

      //         get().fetchTagCounts();

      //     } catch (error) {
      //         console.error('Error fetching user library:', error);
      //         setNotification({ message: '서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
      //     } finally {
      //         setIsLoading(false);
      //     }
      // },

      // ▼▼▼▼▼▼▼▼▼▼ 이 함수를 아래 코드로 수정하세요 ▼▼▼▼▼▼▼▼▼▼
      fetchUserLibrary: async () => {
          const { session } = useAuthStore.getState();
          if (!session) return;

          const { setIsLoading, setNotification } = useUIStore.getState();
          setIsLoading(true);

          try {
              // --- 중복 체크를 위해 전체 ISBN 목록을 먼저 가져옵니다 ---
              const { data: isbnList, error: isbnError } = await supabase
                .rpc('get_all_user_library_isbns')
                .returns<string[]>();

              // ▼▼▼▼▼▼▼▼▼▼ [디버깅 로그 #1] ▼▼▼▼▼▼▼▼▼▼
              // console.log('[STORE-DEBUG-1] Fetched ISBN list from RPC:', { 
              //     data: isbnList, 
              //     error: isbnError 
              // });
              // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

              if (isbnError) {
                // 이 호출이 실패해도 서재 로딩은 계속되도록 콘솔 에러만 남깁니다.
                console.error('중복 체크를 위한 ISBN 목록 로딩 실패:', isbnError);
              }

              // ▼▼▼▼▼▼▼▼▼▼ [디버깅 로그 #2] ▼▼▼▼▼▼▼▼▼▼
              // const isbnSet = new Set(Array.isArray(isbnList) ? isbnList : []);
                
              const normalizedIsbnList = (Array.isArray(isbnList) ? isbnList : [])
                  .map(isbn => (isbn || '').toString().trim()) // 널 체크, 문자열 변환, 공백 제거
                  .filter(isbn => isbn); // 빈 문자열 최종 제외
            
              const isbnSet = new Set(normalizedIsbnList);
              // console.log(`[STORE-DEBUG-2] Created ISBN Set. Total items: ${isbnSet.size}`);
              // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

              // --- 기존 페이지네이션된 책 목록 가져오기 (이하 동일) ---
              const { settings } = useSettingsStore.getState();
              const pageSize = settings.defaultPageSize;

              const { data, error, count } = await supabase
                  .from('user_library')
                  .select('id, book_data, note', { count: 'exact' })
                  .order('created_at', { ascending: false })
                  .limit(pageSize);

              if (error) throw error;

              const libraryBooks = (Array.isArray(data) ? data : []) // <- 이 부분은 이전에 수정한 방어 코드입니다. 그대로 두세요.
                .map(item => {
                    if (!item.book_data) return null;
                    const bookDataWithDefaults = {
                        ...{ readStatus: '읽지 않음', rating: 0 },
                        ...item.book_data,
                    };
                    return {
                        ...bookDataWithDefaults,
                        id: item.id,
                        note: item.note,
                    };
                })
                .filter((book): book is SelectedBook => book !== null);
                          
              // --- 최종 상태 업데이트 ---
              const totalBooksCount = count || 0;
              const isAllBooksLoaded = libraryBooks.length >= totalBooksCount;

              set({
                myLibraryBooks: libraryBooks,
                myLibraryIsbnSet: new Set(Array.isArray(isbnList) ? isbnList : []),
                totalBooksCount: totalBooksCount,
                isAllBooksLoaded: isAllBooksLoaded,
              });

              get().fetchTagCounts();

          } catch (error) {
              console.error('Error fetching user library:', error);
              setNotification({ message: '서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
          } finally {
              setIsLoading(false);
          }
      },
      // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

      // 더보기 할 때만 작동
      fetchRemainingLibrary: async () => {
        const { myLibraryBooks, isAllBooksLoaded } = get();
        const { session } = useAuthStore.getState();

        // 이미 전체 로드했거나 세션이 없으면 종료
        if (isAllBooksLoaded || !session) return;

        const { setIsLoading, setNotification } = useUIStore.getState();
        setIsLoading(true);

        try {
            const currentCount = myLibraryBooks.length;

            const { data, error } = await supabase
                .from('user_library')
                .select('id, book_data, note')
                .order('created_at', { ascending: false })
                .range(currentCount, 9999); // 현재 개수 이후부터 끝까지

            if (error) throw error;

            const remainingBooks = data
              .map(item => {
                  if (!item.book_data) return null;
                  const bookDataWithDefaults = {
                      ...{ readStatus: '읽지 않음', rating: 0 },
                      ...item.book_data,
                  };
                  return {
                      ...bookDataWithDefaults,
                      id: item.id,
                      note: item.note,
                  };
              })
              .filter((book): book is SelectedBook => book !== null);

            // 기존 책 + 새로 로드한 책 병합
            set({
              myLibraryBooks: [...myLibraryBooks, ...remainingBooks],
              isAllBooksLoaded: true
            });
            // 태그 카운트 갱신
            get().fetchTagCounts();
        } catch (error) {
            console.error('Error fetching remaining library:', error);
            setNotification({ message: '나머지 서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
      },

      // updateMissingEbookIsbn13: async () => {
      //   const { myLibraryBooks } = get();
      //   const { setNotification } = useUIStore.getState();
        
      //   for (const book of myLibraryBooks) {
      //     // ebookList가 없거나, 첫 번째 항목이 없거나, isbn13이 없는 경우
      //     if (!book.subInfo?.ebookList?.[0]?.isbn13) {
      //       try {
      //         // 해당 책의 ISBN13으로 알라딘 API를 다시 검색하여 최신 정보 가져오기
      //         const results = await searchAladinBooks(book.isbn13, 'ISBN');
      //         const updatedAladinBook = results.find(item => item.isbn13 === book.isbn13);

      //         if (updatedAladinBook && updatedAladinBook.subInfo?.ebookList?.[0]?.isbn13) {
      //           const newSubInfo = updatedAladinBook.subInfo;
                
      //           const updatedBookData: SelectedBook  = {
      //             ...book,
      //             subInfo: newSubInfo, // 새로운 subInfo로 업데이트
      //           };

      //           // DB 저장 시 detailedStockInfo 필드 제외하여 저장공간 절약
      //           const { id: bookId, detailedStockInfo, ...bookDataForDb } = updatedBookData;

      //           const { error } = await supabase
      //             .from('user_library')
      //             .update({
      //               title: updatedBookData.title,
      //               author: updatedBookData.author,
      //               book_data: bookDataForDb as unknown as Json
      //             })
      //             .eq('id', book.id);

      //           if (error) throw error;

      //           // 상태 업데이트
      //           set(state => ({
      //             myLibraryBooks: state.myLibraryBooks.map(b =>
      //               b.id === book.id ? updatedBookData : b
      //             ),
      //             selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === book.id ? updatedBookData : state.selectedBook
      //           }));
      //           // console.log(`Updated ebook isbn13 for book ID: ${book.id}`); // 성능 개선을 위해 주석 처리
      //         }
      //       } catch (error) {
      //         console.error(`Failed to update ebook isbn13 for book ID: ${book.id}`, error);
      //         setNotification({ message: `일부 책의 전자책 ISBN 정보 갱신에 실패했습니다: ${book.title}`, type: 'warning' });
      //       }
      //     }
      //   }
      // },

      clearLibrary: () => {
        set({ myLibraryBooks: [], selectedBook: null });
      },

      searchBooks: async (query, searchType) => {
        const { setIsLoading, setNotification } = useUIStore.getState();
        setIsLoading(true);
        set({
          selectedBook: null,
          currentPage: 1,
          hasMoreResults: false,
          isLoadingMore: false,
          lastSearchQuery: query,
          lastSearchType: searchType
        });
        try {
          const results = await searchAladinBooks(query, searchType, 1, default_search_results);
          // [세트] 로 시작하는 도서 제외
          const filteredResults = results.filter(book => !book.title.startsWith('[세트]'));

          // 같은 페이지 내에서도 중복 ISBN13 제거 (안전장치)
          const uniqueResults = filteredResults.filter((book, index, self) =>
            index === self.findIndex(b => b.isbn13 === book.isbn13)
          );

          set({
            searchResults: uniqueResults,
            hasMoreResults: filteredResults.length === default_search_results // 원본 결과 기준으로 판단
          });
        } catch (error) {
          console.error(error);
          setNotification({ message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.', type: 'error' });
          set({
            searchResults: [],
            hasMoreResults: false
          });
        } finally {
          setIsLoading(false);
        }
      },
      
      selectBook: (book, options = { scroll: true }) => {
        set({ selectedBook: book });
        useUIStore.getState().closeBookSearchListModal();
        
        // API 테스트 모드에서는 스크롤하지 않음
        const { isAPITestMode } = useUIStore.getState();
        
        // Scroll to the top to see the details view (선택적, API 테스트 모드 제외)
        if (options.scroll && !isAPITestMode) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },

      unselectBook: () => {
        set({ selectedBook: null });
      },

      addToLibrary: async () => {
          const { selectedBook, isBookInLibrary } = get(); // ✅ isBookInLibrary 사용
          // const { selectedBook, myLibraryBooks } = get();
          const { session } = useAuthStore.getState();
          if (!selectedBook || !session || !('isbn13' in selectedBook)) return;

          // // ISBN 기준으로 중복 체크
          // const isDuplicate = myLibraryBooks.some(book => book.isbn13 === selectedBook.isbn13);
          // if (isDuplicate) {
          //   useUIStore.getState().setNotification({ message: '이미 서재에 추가된 책입니다.', type: 'warning' });
          //   return;
          // }
          
          // ✅ isBookInLibrary 함수를 사용하여 중복 체크 (더 정확함)
          if (isBookInLibrary(selectedBook.isbn13)) {
            useUIStore.getState().setNotification({ message: '이미 서재에 추가된 책입니다.', type: 'warning' });
            return;
          }

          // ✅ BookData 타입에 맞게 초기 데이터 구성
          const newBookData: BookData = {
            ...(selectedBook as AladdinBookItem), // selectedBook은 AladdinBookItem 타입
            
            // 도서관/재고 정보 초기화
            toechonStock: { total_count: 0, available_count: 0 },
            otherStock: { total_count: 0, available_count: 0 },
            // gwangjuPaperInfo: { error: '아직 조회되지 않았습니다.' },
            gwangjuPaperInfo: null,
            ebookInfo: null,
            gyeonggiEbookInfo: null,
            siripEbookInfo: null,

            // 사용자 활동 정보 초기화
            addedDate: Date.now(),
            readStatus: '읽지 않음',
            rating: 0,
            isFavorite: false,
            customTags: [],
          };
          
          try {
              const { data, error } = await supabase
                  .from('user_library')
                  .insert([{
                    user_id: session.user.id,
                    title: newBookData.title,
                    author: newBookData.author,
                    book_data: newBookData as unknown as Json
                  }])
                  .select('id, book_data, note')
                  .single();
              
              if (error) throw error;
              if (!data || !data.book_data) throw new Error("Failed to add book: No data returned.");

              const newBookWithId: SelectedBook = { 
                  ...(data.book_data as BookData), 
                  id: data.id,
                  note: data.note, 
              };

              set(state => ({ 
                myLibraryBooks: [newBookWithId, ...state.myLibraryBooks],
                // ✅ 책 추가 시, Set에도 새로운 ISBN 추가
                myLibraryIsbnSet: new Set(state.myLibraryIsbnSet).add(newBookWithId.isbn13),
                totalBooksCount: state.totalBooksCount + 1, // ✅ 전체 책 개수 1 증가
              }));
              set({ selectedBook: null });

              // 내 서재 필터 리셋
              const { resetLibraryFilters } = get();
              if (resetLibraryFilters) {
                resetLibraryFilters();
              }

              // 백그라운드 재고 조회 실행
              const delay = window.location.hostname === 'localhost' ? 100 : 800;
              setTimeout(() => { get().refreshBookInfo(newBookWithId.id, newBookWithId.isbn13, newBookWithId.title); }, delay);

          } catch(error) {
              console.error("Error adding book to library:", error);
              useUIStore.getState().setNotification({ message: '서재에 책을 추가하는 데 실패했습니다.', type: 'error'});
          }
      },

      // 개별 책 삭제

      // removeFromLibrary: async (id: number) => {
      //   try {
      //       const { error } = await supabase.from('user_library').delete().eq('id', id);
      //       if (error) throw error;

      //       set(state => {
      //           const newLibraryBooks = state.myLibraryBooks.filter(b => b.id !== id);
      //           let newSelectedBook = state.selectedBook;

      //           // If the deleted book was the selected book, unselect it to prevent errors.
      //           if (newSelectedBook && 'id' in newSelectedBook && newSelectedBook.id === id) {
      //               newSelectedBook = null;
      //           }
                
      //           return {
      //               myLibraryBooks: newLibraryBooks,
      //               selectedBook: newSelectedBook,
      //           };
      //       });
      //   } catch(error) {
      //       console.error("Error removing book from library:", error);
      //       useUIStore.getState().setNotification({ message: '서재에서 책을 삭제하는 데 실패했습니다.', type: 'error'});
      //   }
      // },


      // useBook-store.ts

      // removeFromLibrary: async (id: number) => {
      //     // 1. (선택적이지만 권장) 낙관적 UI 업데이트: DB 응답을 기다리지 않고 UI부터 즉시 변경
      //     const { myLibraryBooks, librarySearchResults, libraryTagFilterResults } = get();

      //     // 롤백을 위해 원본 상태 저장
      //     const originalState = { myLibraryBooks, librarySearchResults, libraryTagFilterResults };

      //     set(state => ({
      //       // ✅ 모든 관련 배열에서 삭제된 아이템을 필터링하여 새로운 상태를 만듦
      //       myLibraryBooks: state.myLibraryBooks.filter(b => b.id !== id),
      //       librarySearchResults: state.librarySearchResults.filter(b => b.id !== id),
      //       libraryTagFilterResults: state.libraryTagFilterResults.filter(b => b.id !== id),
      //       totalBooksCount: state.totalBooksCount -1, // ✅ 전체 책 개수도 1 감소
      //     }));

      //     // 2. DB에서 데이터 삭제
      //     try {
      //         const { error } = await supabase.from('user_library').delete().eq('id', id);
      //         if (error) throw error; // 에러 발생 시 catch 블록으로 이동

      //         // (성공 시 추가 작업)
      //         // 만약 삭제된 책이 selectedBook이었다면, 선택 해제
      //         const { selectedBook, unselectBook } = get();
      //         if (selectedBook && 'id' in selectedBook && selectedBook.id === id) {
      //           unselectBook();
      //         }

      //     } catch(error) {
      //         console.error("Error removing book from library:", error);
      //         useUIStore.getState().setNotification({ message: '서재에서 책을 삭제하는 데 실패했습니다.', type: 'error'});

      //         // 3. (실패 시) 롤백: UI 상태를 원래대로 되돌림
      //         set(originalState);
      //         set(state => ({ totalBooksCount: state.totalBooksCount + 1 })); // 감소시켰던 책 개수 복원
      //     }
      // },


      removeFromLibrary: async (id: number) => {
          // 1. 롤백을 위해 원본 상태 저장 및 삭제할 책 정보 찾기
          const { myLibraryBooks, librarySearchResults, libraryTagFilterResults, myLibraryIsbnSet } = get();
          const originalState = { myLibraryBooks, librarySearchResults, libraryTagFilterResults, myLibraryIsbnSet };
          
          // 삭제할 책을 모든 배열에서 찾아봄 (어떤 뷰에 있을지 모르므로)
          const bookToRemove = originalState.myLibraryBooks.find(b => b.id === id) ||
                              originalState.librarySearchResults.find(b => b.id === id) ||
                              originalState.libraryTagFilterResults.find(b => b.id === id);

          // 2. 낙관적 UI 업데이트: DB 응답을 기다리지 않고 UI부터 즉시 변경
          set(state => {
            // Set에서 ISBN 제거
            const newIsbnSet = new Set(state.myLibraryIsbnSet);
            if (bookToRemove) {
              newIsbnSet.delete(bookToRemove.isbn13);
            }
            
            return {
              // 모든 관련 배열에서 삭제된 아이템 필터링
              myLibraryBooks: state.myLibraryBooks.filter(b => b.id !== id),
              librarySearchResults: state.librarySearchResults.filter(b => b.id !== id),
              libraryTagFilterResults: state.libraryTagFilterResults.filter(b => b.id !== id),
              myLibraryIsbnSet: newIsbnSet, // ✅ 업데이트된 Set 적용
              totalBooksCount: Math.max(0, state.totalBooksCount - 1), // 전체 책 개수 1 감소
            };
          });

          // 3. DB에서 데이터 삭제
          try {
              const { error } = await supabase.from('user_library').delete().eq('id', id);
              if (error) throw error; // 에러 발생 시 catch 블록으로 이동

              // (성공 시 추가 작업)
              const { selectedBook, unselectBook } = get();
              if (selectedBook && 'id' in selectedBook && selectedBook.id === id) {
                unselectBook();
              }

          } catch(error) {
              console.error("Error removing book from library:", error);
              useUIStore.getState().setNotification({ message: '서재에서 책을 삭제하는 데 실패했습니다.', type: 'error'});

              // 4. (실패 시) 롤백: UI 상태를 원래대로 되돌림
              set(originalState);
              set(state => ({ totalBooksCount: state.totalBooksCount + 1 }));
          }
      },

      // 개별 책에 대한 재고 정보 업데이트

      refreshBookInfo: async (id, isbn13, title) => {
          set({ refreshingIsbn: isbn13, refreshingEbookId: id });

          // getBookById를 사용하여 모든 데이터 소스에서 원본 책 정보를 가져옵니다.
          const originalBook = await get().getBookById(id);

          if (!originalBook) {
            console.warn(`[refreshBookInfo] Book with id ${id} not found.`);
            set({ refreshingIsbn: null, refreshingEbookId: null });
            return;
          }

          try {
            // 1. API 병렬 호출
            const libraryPromise = fetchBookAvailability(
              isbn13,
              title,
              originalBook.customSearchTitle
            );
            const aladinPromise = searchAladinBooks(isbn13, 'ISBN');
            const [libraryResult, aladinResult] = await Promise.allSettled([
              libraryPromise,
              aladinPromise,
            ]);

            // API 호출 결과 확인
            if (libraryResult.status === 'rejected') {
              throw new Error(`도서관 재고 조회 실패: ${libraryResult.reason.message}`);
            }
            const aladinBookData = (aladinResult.status === 'fulfilled' && aladinResult.value.length > 0)
              ? aladinResult.value.find(b => b.isbn13 === isbn13)
              : null;

            if (!aladinBookData) {
              throw new Error("알라딘에서 최신 도서 정보를 가져올 수 없어 업데이트를 중단합니다.");
            }

            // 2. "순수 API 정보 객체" 생성 (새 함수와 타입을 사용)
            const pureApiData: ApiCombinedBookData = createBookDataFromApis(aladinBookData, libraryResult.value);
            
            // 3. "사용자 정보"와 "순수 API 정보"를 합쳐 최종 `BookData` 생성
            const finalBookData: BookData = {
              ...pureApiData, // API에서 온 모든 정보

              // 사용자 정보는 originalBook에서 가져와 유지
              addedDate: originalBook.addedDate,
              readStatus: originalBook.readStatus,
              rating: originalBook.rating,
              isFavorite: originalBook.isFavorite,
              customTags: originalBook.customTags,
              customSearchTitle: originalBook.customSearchTitle,

              // ✅ [핵심] API 호출 실패로 인해 'undefined'가 된 속성들은
              // originalBook의 기존 값으로 복원(유지)한다.
              toechonStock: pureApiData.toechonStock ?? originalBook.toechonStock,
              otherStock: pureApiData.otherStock ?? originalBook.otherStock,
              ebookInfo: pureApiData.ebookInfo ?? originalBook.ebookInfo,
              gyeonggiEbookInfo: pureApiData.gyeonggiEbookInfo ?? originalBook.gyeonggiEbookInfo,
              siripEbookInfo: pureApiData.siripEbookInfo ?? originalBook.siripEbookInfo,
              filteredGyeonggiEbookInfo: pureApiData.filteredGyeonggiEbookInfo ?? originalBook.filteredGyeonggiEbookInfo,
            };

            // subInfo 업데이트 로직 (새 전자책 정보가 있는데 기존엔 없었을 경우)
            const hasNewEbookInfo = aladinBookData.subInfo?.ebookList?.[0]?.isbn13;
            const hasOldEbookInfo = originalBook.subInfo?.ebookList?.[0]?.isbn13;
            if (hasNewEbookInfo && !hasOldEbookInfo) {
              finalBookData.subInfo = aladinBookData.subInfo;
              console.log(`[Ebook Update] '${title}'의 새로운 전자책 정보를 발견하여 업데이트합니다.`);
            }

            // 4. UI 상태를 즉시 업데이트 (ID와 note 포함)
            const updatedBookForUI: SelectedBook = {
              ...finalBookData,
              id: originalBook.id,
              note: originalBook.note, // note는 별도 컬럼이므로 originalBook에서 가져옴
            };

            set(state => ({
              myLibraryBooks: state.myLibraryBooks.map(b => (b.id === id ? updatedBookForUI : b)),
              librarySearchResults: state.librarySearchResults.map(b => (b.id === id ? updatedBookForUI : b)),
              libraryTagFilterResults: state.libraryTagFilterResults.map(b => (b.id === id ? updatedBookForUI : b)),
              selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id ? updatedBookForUI : state.selectedBook,
            }));

            // 5. 최종 DB 업데이트
            const { error } = await supabase
              .from('user_library')
              .update({
                title: finalBookData.title,     // 최상위 컬럼 업데이트
                author: finalBookData.author,   // 최상위 컬럼 업데이트
                book_data: finalBookData as unknown as Json, // book_data 컬럼 업데이트
              })
              .eq('id', id);

            if (error) throw error;

          } catch (error) {
            console.error(`Failed to refresh book info for ${title}:`, error);
            useUIStore.getState().setNotification({ message: '도서 정보 갱신에 실패했습니다.', type: 'error' });

            // 롤백 로직: 에러 발생 시 원래 책 정보로 되돌립니다.
            set(state => ({
              myLibraryBooks: state.myLibraryBooks.map(b => (b.id === id ? originalBook : b)),
              librarySearchResults: state.librarySearchResults.map(b => (b.id === id ? originalBook : b)),
              libraryTagFilterResults: state.libraryTagFilterResults.map(b => (b.id === id ? originalBook : b)),
              selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id ? originalBook : state.selectedBook,
            }));

          } finally {
            set({ refreshingIsbn: null, refreshingEbookId: null });
          }
        },

      updateReadStatus: async (id, status) => {
        await updateBookInStoreAndDB(id, { readStatus: status }, '읽음 상태 변경에 실패했습니다.');
      },

      updateRating: async (id, rating) => {
        await updateBookInStoreAndDB(id, { rating }, '별점 변경에 실패했습니다.');
      },

      sortLibrary: (key) => {
        const { sortConfig } = get();
        if (sortConfig.key === key) {
          set({ sortConfig: { ...sortConfig, order: sortConfig.order === 'asc' ? 'desc' : 'asc' } });
        } else {
          const newOrder = ['addedDate', 'rating', 'readStatus', 'pubDate'].includes(key) ? 'desc' : 'asc';
          set({ sortConfig: { key, order: newOrder } });
        }
      },

      setLibrarySearchQuery: (query: string) => {
        set({ librarySearchQuery: query });
      },

      addTagToBook: async (id, tagId) => {
        // const book = get().myLibraryBooks.find(b => b.id === id);
        const book = await get().getBookById(id); // [개선] getBookById 사용
        if (!book) return;
        const currentTags = book.customTags || [];
        if (currentTags.includes(tagId)) return;
        // [핵심 수정] 스프레드 연산자(...)를 사용해 항상 새로운 배열 생성
        const newTags = [...currentTags, tagId];
        await updateBookInStoreAndDB(id, { customTags: newTags }, '태그 추가에 실패했습니다.');
      },
      removeTagFromBook: async (id, tagId) => {
        // const book = get().myLibraryBooks.find(b => b.id === id);
        const book = await get().getBookById(id); // [개선] getBookById 사용
        if (!book) return;
        // [핵심 수정] filter 메서드는 항상 새로운 배열을 반환하므로 불변성을 지킴
        const updatedTags = (book.customTags || []).filter(t => t !== tagId);
        await updateBookInStoreAndDB(id, { customTags: updatedTags }, '태그 제거에 실패했습니다.');
      },

      updateBookTags: async (id, tagIds) => {
        const book = await get().getBookById(id);
        await updateBookInStoreAndDB(id, { customTags: tagIds }, '태그 업데이트에 실패했습니다.');
      },

      // [교체] updateMultipleBookTags 함수 전체를 아래 코드로 교체
      updateMultipleBookTags: async (bookUpdates) => {
          const { getBookById } = get(); // getBookById 함수를 가져옴

          // 1. 낙관적 업데이트: UI 상태를 먼저 업데이트
          const updatedBooksMap = new Map<number, SelectedBook>();
          // Promise.all을 사용하여 book 객체를 병렬로 가져옴
          await Promise.all(bookUpdates.map(async ({ id, tagIds }) => {
              const book = await getBookById(id);
              if (book) {
                  updatedBooksMap.set(id, { ...book, customTags: tagIds });
              }
          }));

          useBookStore.setState(state => ({
            myLibraryBooks: state.myLibraryBooks.map(book => updatedBooksMap.get(book.id) || book),
            librarySearchResults: state.librarySearchResults.map(book => updatedBooksMap.get(book.id) || book),
            libraryTagFilterResults: state.libraryTagFilterResults.map(book => updatedBooksMap.get(book.id) || book),
          }));

          // 2. 배치 DB 업데이트 (병렬 처리)
          const updatePromises = bookUpdates.map(async ({ id, tagIds }) => {
            // [핵심 수정] getBookById를 사용하여 모든 데이터 소스에서 책을 찾음
            const book = await getBookById(id);
            
            if (!book) {
              console.warn(`[updateMultipleBookTags] Book with id ${id} not found.`);
              return { success: false, id, error: 'Book not found' };
            }

            try {
              // ... (기존 DB 업데이트 로직은 동일)
              const updatedBookData = { ...book, customTags: tagIds };
              const { id: bookId, ...bookDataForDb } = updatedBookData;
              
              const { error } = await supabase
                .from('user_library')
                .update({
                  title: updatedBookData.title,
                  author: updatedBookData.author,
                  book_data: bookDataForDb as unknown as Json,
                })
                .eq('id', id);

              if (error) throw error;
              return { success: true, id };
            } catch (error) {
              console.error(`Failed to update tags for book ${id}:`, error);
              return { success: false, id, error };
            }
          });

          // 3. 결과 처리 (기존과 동일)
          const results = await Promise.allSettled(updatePromises);
          const failures: number[] = [];
          results.forEach((result, index) => {
              if (result.status === 'fulfilled' && result.value && !result.value.success) {
                  failures.push(result.value.id);
              } else if (result.status === 'rejected') {
                  failures.push(bookUpdates[index].id);
              }
          });

          // 4. 실패한 항목들 롤백 (기존과 동일, 하지만 이제 원본을 찾아 롤백 가능)
          if (failures.length > 0) {
            const originalBooksMap = new Map<number, SelectedBook>();
            await Promise.all(failures.map(async (id) => {
                const originalBook = await getBookById(id); // 원본을 다시 찾아옴
                if(originalBook) {
                    originalBooksMap.set(id, originalBook);
                }
            }));
            
            // ... (기존 롤백 로직 수정)
            useBookStore.setState(state => ({
              myLibraryBooks: state.myLibraryBooks.map(book => originalBooksMap.get(book.id) || book),
              librarySearchResults: state.librarySearchResults.map(book => originalBooksMap.get(book.id) || book),
              libraryTagFilterResults: state.libraryTagFilterResults.map(book => originalBooksMap.get(book.id) || book),
            }));

            useUIStore.getState().setNotification({
              message: `${failures.length}개 책의 태그 업데이트에 실패했습니다. 변경사항이 저장되지 않았을 수 있습니다.`,
              type: 'error',
            });
          }

          return {
            success: bookUpdates.length - failures.length,
            failed: failures.length,
            failures,
          };
      },

      toggleFavorite: async (id) => {
        const { myLibraryBooks } = get();
        const book = myLibraryBooks.find(b => b.id === id);
        if (!book) return;

        // Handle undefined isFavorite as false (for existing books)
        const currentFavorite = book.isFavorite || false;
        const newIsFavorite = !currentFavorite;
        await updateBookInStoreAndDB(id, { isFavorite: newIsFavorite }, '좋아요 상태 변경에 실패했습니다.');
      },

      updateBookNote: async (id, note) => {
        // 50자 제한 적용
        const trimmedNote = note.trim().slice(0, 50);
        await updateBookInStoreAndDB(id, { note: trimmedNote }, '메모 저장에 실패했습니다.');
      },

      // [추가] 커스텀 검색어 업데이트 함수
      updateCustomSearchTitle: async (id, title) => {
        const trimmedTitle = title.trim();
        await updateBookInStoreAndDB(id, { customSearchTitle: trimmedTitle }, '커스텀 검색어 저장에 실패했습니다.');
      },

      setResetLibraryFilters: (resetFn) => {
        set({ resetLibraryFilters: resetFn });
      },

      loadMoreSearchResults: async () => {
        const { currentPage, hasMoreResults, isLoadingMore, lastSearchQuery, lastSearchType, searchResults } = get();

        if (!hasMoreResults || isLoadingMore || !lastSearchQuery) return;

        const { setNotification } = useUIStore.getState();
        set({ isLoadingMore: true });

        try {
          const nextPage = currentPage + 1;
          const startIndex = nextPage; // 알라딘 API는 페이지 번호를 그대로 사용
          const results = await searchAladinBooks(lastSearchQuery, lastSearchType, startIndex, default_search_results);

          // [세트] 로 시작하는 도서 제외
          const filteredResults = results.filter(book => !book.title.startsWith('[세트]'));

          // 기존 결과와 중복되지 않는 새로운 결과만 필터링
          const existingIsbn13s = new Set(searchResults.map(book => book.isbn13));
          const uniqueNewResults = filteredResults.filter(book => !existingIsbn13s.has(book.isbn13));

          set({
            searchResults: [...searchResults, ...uniqueNewResults],
            currentPage: nextPage,
            hasMoreResults: filteredResults.length === default_search_results, // 원본 결과 기준으로 판단
            isLoadingMore: false
          });
        } catch (error) {
          console.error(error);
          setNotification({
            message: error instanceof Error ? error.message : '추가 검색 결과를 불러오는 데 실패했습니다.',
            type: 'error'
          });
          set({ isLoadingMore: false });
        }
      },

      setAuthorFilter: (author) => {
        set({ authorFilter: author });
      },

      clearAuthorFilter: () => {
        set({ authorFilter: '' });
      },

      searchUserLibrary: async (query: string) => {
        const { session } = useAuthStore.getState();
        if (!session?.user || query.trim().length < 2) {
          set({ librarySearchResults: [], isSearchingLibrary: false });
          return;
        }

        set({ isSearchingLibrary: true });
        try {
          const { data, error } = await supabase
            .from('user_library')
            .select('id, book_data, note, title, author')
            .eq('user_id', session.user.id)
            .or(`title.ilike.%${query}%,author.ilike.%${query}%`)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const searchResults = data
            .map(item => {
              if (!item.book_data) return null;
              const bookDataWithDefaults = {
                ...{ readStatus: '읽지 않음', rating: 0 },
                ...item.book_data,
              };
              return {
                ...bookDataWithDefaults,
                id: item.id,
                note: item.note,
              };
            })
            .filter((book): book is SelectedBook => book !== null);

          set({ librarySearchResults: searchResults, isSearchingLibrary: false });
        } catch (error) {
          console.error('Error searching library:', error);
          set({ librarySearchResults: [], isSearchingLibrary: false });
        }
      },

      clearLibrarySearch: () => {
        set({ librarySearchResults: [] });
      },

      fetchTagCounts: async () => {
        const session = useAuthStore.getState().session;
        if (!session?.user) return;

        try {
          const { data, error } = await supabase.rpc('get_tag_counts_for_user');

          if (error) throw error;

          // DB에서 받은 배열 [{ tag_id: 'abc', book_count: 10 }, ...]을
          // { abc: 10, ... } 형태의 객체로 변환
          const counts = (data || []).reduce((acc, { tag_id, book_count }) => {
            acc[tag_id] = Number(book_count);
            return acc;
          }, {} as Record<string, number>);

          set({ tagCounts: counts });
        } catch (error) {
          console.error('Error fetching tag counts:', error);
          set({ tagCounts: {} });
        }
      },

      filterLibraryByTags: async (tagIds: string[]) => {
        if (tagIds.length === 0) {
          get().clearLibraryTagFilter();
          return;
        }

        const { session } = useAuthStore.getState();
        if (!session?.user) return;

        set({ isFilteringByTag: true });
        try {
          const { data, error } = await supabase.rpc('get_books_by_tags', {
            tags_to_filter: tagIds,
          });

          if (error) throw error;

          const results = (data || []).map(item => {
            const bookDataWithDefaults = {
              ...{ readStatus: '읽지 않음', rating: 0 },
              ...item.book_data,
            };
            return {
              ...bookDataWithDefaults,
              id: item.id,
              note: item.note,
            };
          });

          set({ libraryTagFilterResults: results, isFilteringByTag: false });
        } catch (error) {
          console.error('Error filtering by tags:', error);
          set({ libraryTagFilterResults: [], isFilteringByTag: false });
        }
      },

      clearLibraryTagFilter: () => {
        set({ libraryTagFilterResults: [] });
      },

      bulkRefreshAllBooks: async (limit, callbacks) => {
        const { myLibraryBooks } = get();

        // 대상 책 선택
        const getBooksToRefresh = (limit: number | 'all') => {
          if (limit === 'all') {
            return myLibraryBooks;
          }
          // 최근 추가된 순으로 정렬 후 limit개 선택
          return [...myLibraryBooks]
            .sort((a, b) => b.addedDate - a.addedDate)
            .slice(0, limit);
        };

        const booksToRefresh = getBooksToRefresh(limit);
        const total = booksToRefresh.length;

        // 초기 상태 설정
        set({
          bulkRefreshState: {
            isRunning: true,
            isPaused: false,
            isCancelled: false,
            current: 0,
            total,
            failed: [],
          },
        });

        const failed: number[] = [];
        let current = 0;

        // 10개씩 배치 처리
        const batchSize = 10;
        for (let i = 0; i < booksToRefresh.length; i += batchSize) {
          // 취소 확인
          if (callbacks.shouldCancel()) {
            set({
              bulkRefreshState: {
                isRunning: false,
                isPaused: false,
                isCancelled: true,
                current,
                total,
                failed,
              },
            });
            callbacks.onComplete(current - failed.length, failed);
            return;
          }

          // 일시정지 확인
          while (callbacks.shouldPause()) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // 배치 처리
          const batch = booksToRefresh.slice(i, Math.min(i + batchSize, booksToRefresh.length));

          for (const book of batch) {
            try {
              await get().refreshBookInfo(book.id, book.isbn13, book.title);
              current++;
            } catch (error) {
              console.error(`Failed to refresh book ${book.id}:`, error);
              failed.push(book.id);
              current++;
            }

            // 진행률 업데이트
            set(state => ({
              bulkRefreshState: {
                ...state.bulkRefreshState,
                current,
                failed,
              },
            }));
            callbacks.onProgress(current, total, failed.length);
          }

          // 다음 배치가 있고, 취소되지 않았으면 1초 대기
          if (i + batchSize < booksToRefresh.length && !callbacks.shouldCancel()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // 완료 상태 설정
        set({
          bulkRefreshState: {
            isRunning: false,
            isPaused: false,
            isCancelled: false,
            current,
            total,
            failed,
          },
        });

        callbacks.onComplete(current - failed.length, failed);
      },

      pauseBulkRefresh: () => {
        set(state => ({
          bulkRefreshState: {
            ...state.bulkRefreshState,
            isPaused: true,
          },
        }));
      },

      resumeBulkRefresh: () => {
        set(state => ({
          bulkRefreshState: {
            ...state.bulkRefreshState,
            isPaused: false,
          },
        }));
      },

      cancelBulkRefresh: () => {
        set(state => ({
          bulkRefreshState: {
            ...state.bulkRefreshState,
            isCancelled: true,
          },
        }));
      },
    })
);
