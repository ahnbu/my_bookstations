
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { AladdinBookItem, SortKey, ReadStatus, Json,
  ApiCombinedBookData, 
  BookData,            
  SelectedBook,       
} from '../types';
import { searchAladinBooks } from '../services/aladin.service';
import { useUIStore } from './useUIStore';
import { useAuthStore } from './useAuthStore';
import { useSettingsStore } from './useSettingsStore';
import { fetchBookAvailability} from '../services/unifiedLibrary.service'; 
import { createBookDataFromApis } from '../utils/bookDataCombiner';

// 1. 중앙화된 컬럼 목록 변수
const stockColumns = `
  stock_gwangju_toechon_total, stock_gwangju_toechon_available,
  stock_gwangju_other_total, stock_gwangju_other_available,
  stock_gyeonggi_edu_total, stock_gyeonggi_edu_available,
  stock_sirip_subs_total, stock_sirip_subs_available,
  stock_sirip_owned_total, stock_sirip_owned_available,
  stock_gyeonggi_total, stock_gyeonggi_available
`.replace(/\s/g, '');

// 2. DB 응답을 SelectedBook 타입으로 변환하는 헬퍼 함수
const mapDbItemToSelectedBook = (item: any): SelectedBook | null => {
    if (!item || !item.book_data) return null;
    return {
        ...(item.book_data as BookData),
        id: item.id,
        note: item.note,
        stock_gwangju_toechon_total: item.stock_gwangju_toechon_total,
        stock_gwangju_toechon_available: item.stock_gwangju_toechon_available,
        stock_gwangju_other_total: item.stock_gwangju_other_total,
        stock_gwangju_other_available: item.stock_gwangju_other_available,
        stock_gyeonggi_edu_total: item.stock_gyeonggi_edu_total,
        stock_gyeonggi_edu_available: item.stock_gyeonggi_edu_available,
        stock_sirip_subs_total: item.stock_sirip_subs_total,
        stock_sirip_subs_available: item.stock_sirip_subs_available,
        stock_sirip_owned_total: item.stock_sirip_owned_total,
        stock_sirip_owned_available: item.stock_sirip_owned_available,
        stock_gyeonggi_total: item.stock_gyeonggi_total,
        stock_gyeonggi_available: item.stock_gyeonggi_available,
    };
};

// 재고 컬럼에 NULL/undefined가 포함되어 있으면 '에러 보유 책'으로 간주
function isBookInError(book: SelectedBook): boolean {
    // stock_* 컬럼 목록을 정의 (types.ts의 LibraryApiResponse 구조와 매칭되도록)
    const stockColumns: Array<keyof SelectedBook> = [
        'stock_gwangju_toechon_total', 'stock_gwangju_other_total',
        'stock_gyeonggi_edu_total', 'stock_gyeonggi_total',
        'stock_sirip_subs_total', 'stock_sirip_owned_total'
    ];

    // 하나라도 null 또는 undefined인 컬럼이 있으면 true 반환
    return stockColumns.some(col => book[col] === null || book[col] === undefined);
}

// 주어진 책 목록에서 에러 책을 찾아 반환
function calculateErrorBooks(books: SelectedBook[]): SelectedBook[] {
    // 이미 전체 로드된 경우에만 정확한 계산을 시도
    if (useBookStore.getState().isAllBooksLoaded) {
        return books.filter(isBookInError);
    }
    // 전체 로드되지 않은 경우, 현재 로드된 책 목록만 계산
    return books.filter(isBookInError);
}

/**
 * 특정 책의 데이터를 업데이트하고, 로컬 상태와 Supabase DB를 동기화하는 헬퍼 함수
 * @param id 업데이트할 책의 ID
 * @param updates BookData 객체의 일부. 변경할 내용만 담습니다.
 * @param errorMessage DB 업데이트 실패 시 보여줄 알림 메시지
 */

async function updateBookInStoreAndDB(
  id: number,
  updates: Partial<Omit<SelectedBook, 'id'>>,
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
  }));

  // 2. DB 업데이트
  // `book_data`에 저장될 객체에서 최상위 컬럼인 id, note를 제외
  // const { id: bookId, note, ...bookDataForDb } = updatedBook; 
  const bookDataForDb = { ...updatedBook };
  
  try {
    // `book_data`에 저장될 객체 만들기: `updatedBook`에서 최상위 컬럼들을 '제외'
    // const updateData: {
    //   book_data: Json;
    //   title?: string;
    //   author?: string;
    //   note?: string | null;
    // } = {
    //   title: updatedBook.title,
    //   author: updatedBook.author,
    //   book_data: bookDataForDb as unknown as Json,
    //   note: updatedBook.note ?? null, // 👈 updatedBook의 note 값으로 항상 동기화
    // };

    // const { error } = await supabase
    //   .from('user_library')
    //   .update(updateData)
    //   .eq('id', id);
        // `book_data`에 저장될 객체 만들기: `updatedBook`에서 최상위 컬럼들을 '제외'
    const { id: bookId, note, ...bookDataForDb } = updatedBook;
    stockColumns.split(',').forEach(col => {
      delete (bookDataForDb as any)[col.trim()];
    });

    // DB 업데이트를 위한 최종 payload 생성
    const dbUpdatePayload: { [key: string]: any } = {
      title: updatedBook.title,
      author: updatedBook.author,
      note: updatedBook.note ?? null,
      book_data: bookDataForDb as unknown as Json,
    };
    
    // `updates` 객체에 `stock_*` 필드가 있다면, payload에 최상위 컬럼으로 추가
    Object.keys(updates).forEach(key => {
        if (key.startsWith('stock_')) {
            dbUpdatePayload[key] = (updates as any)[key];
        }
    });

    const { error } = await supabase
      .from('user_library')
      .update(dbUpdatePayload) // 수정된 payload 사용
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
        // libraryFavoritesFilterResults: state.libraryFavoritesFilterResults.map(b => (b.id === id ? originalBook : b)),
        selectedBook:
          state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id
            ? originalBook
            : state.selectedBook,
    }));
  }
}

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
  isAllBooksLoaded: boolean;
  totalBooksCount: number;
  tagCounts: Record<string, number>;

  // Server-based library search
  librarySearchResults: SelectedBook[];
  isSearchingLibrary: boolean;

  // Server-based tag filtering
  libraryTagFilterResults: SelectedBook[];
  isFilteringByTag: boolean;

  // ✅ [추가] 에러 보유 책 관련 상태
  errorBooks: SelectedBook[]; 
  errorBooksCount: number;

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
    currentBookTitle: string | null; // ✅ [추가]
  };

  // Actions
  searchBooks: (query: string, searchType: string) => Promise<void>;
  loadMoreSearchResults: () => Promise<void>;
  selectBook: (book: AladdinBookItem | SelectedBook, options?: { scroll?: boolean }) => void;
  unselectBook: () => void;
  addToLibrary: (bookToAdd?: AladdinBookItem | SelectedBook) => Promise<SelectedBook | null>;
  removeFromLibrary: (id: number) => Promise<void>;
  refreshBookInfo: (id: number, isbn13: string, title: string, author: string) => Promise<void>;
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
  // filterLibraryByTags: (tagIds: string[]) => Promise<void>;
  filterLibraryByTags: (tagIds: string[], filterByFavorites: boolean) => Promise<void>;
  clearLibraryTagFilter: () => void;
  // bulkRefreshAllBooks: (
  //   limit: number | 'all',
  //   callbacks: {
  //     onProgress: (current: number, total: number, failed: number) => void;
  //     onComplete: (success: number, failed: number[]) => void;
  //     shouldPause: () => boolean;
  //     shouldCancel: () => boolean;
  //   }
  // ) => Promise<void>;
  bulkRefreshAllBooks: (
    options: { // 💥 limit 대신 options 객체를 받도록 변경
      type: 'recent' | 'old' | 'all' | 'range';
      limit?: number;
      start?: number;
      end?: number;
    },
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
      myLibraryIsbnSet: new Set(),
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

      // ✅ [해결] 여기에 초기 상태를 추가합니다.
      errorBooks: [],
      errorBooksCount: 0,

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
        currentBookTitle: null, // ✅ [추가]
      },

      isBookInLibrary: (isbn13: string) => {
        // ✅ 함수 구현: Set에서 확인
        return get().myLibraryIsbnSet.has(isbn13);
      },

      // 책상세>API book_data 조회

      fetchRawBookData: async (id: number): Promise<BookData | null> => { // 반환 타입을 BookData로 수정
        const { session } = useAuthStore.getState();
        if (!session) return null;

        try {
          const { data, error } = await supabase
            .from('user_library')
            .select('book_data') // book_data만 조회하도록 원복
            .eq('id', id)
            .single();

          if (error) throw error;
          
          // data 객체에서 book_data 속성만 추출하여 반환
          return data?.book_data ? (data.book_data as BookData) : null;

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
                  // .select('id, book_data, note')
                  .select(`id, book_data, note, ${stockColumns}`) // <<< 수정
                  .eq('user_id', session.user.id)
                  .eq('id', id)
                  .single();

              if (error) throw error;

              const fetchedBook = mapDbItemToSelectedBook(data); // <<< 수정
              if (!fetchedBook) return null;

              // if (!data || !data.book_data) return null;
              
              // const bookDataWithDefaults = {
              //     ...{ readStatus: '읽지 않음', rating: 0 },
              //     ...data.book_data,
              // };
              // const fetchedBook: SelectedBook = {
              //     ...bookDataWithDefaults,
              //     id: data.id,
              //     note: data.note,
              // };

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
                  .select(`id, book_data, note, ${stockColumns}`, { count: 'exact' }) // 수정
                  .order('created_at', { ascending: false })
                  .limit(pageSize);

              if (error) throw error;

              const libraryBooks = (Array.isArray(data) ? data : [])
                .map(mapDbItemToSelectedBook) // 수정
                .filter((book): book is SelectedBook => book !== null);

              // const libraryBooks = (Array.isArray(data) ? data : []) 
              //   .map(item => {
              //       if (!item.book_data) return null;
              //       const bookDataWithDefaults = {
              //           ...{ readStatus: '읽지 않음', rating: 0 },
              //           ...item.book_data,
              //       };
              //       return {
              //           ...bookDataWithDefaults,
              //           id: item.id,
              //           note: item.note,
              //       };
              //   })
              //   .filter((book): book is SelectedBook => book !== null);
                          
              // --- 최종 상태 업데이트 ---
              const totalBooksCount = count || 0;
              const isAllBooksLoaded = libraryBooks.length >= totalBooksCount;

              // ✅ [추가] 에러 책 계산 및 업데이트
              const errorBooks = calculateErrorBooks(libraryBooks);

              set({
                myLibraryBooks: libraryBooks,
                myLibraryIsbnSet: new Set(Array.isArray(isbnList) ? isbnList : []),
                totalBooksCount: totalBooksCount,
                isAllBooksLoaded: isAllBooksLoaded,
                // ✅ [추가] 상태 업데이트
                errorBooks: errorBooks,
                errorBooksCount: errorBooks.length,
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
                // .select('id, book_data, note')
                .select(`id, book_data, note, ${stockColumns}`) // <<< 수정
                .order('created_at', { ascending: false })
                .range(currentCount, 9999); // 현재 개수 이후부터 끝까지

            if (error) throw error;

            const remainingBooks = data
              .map(mapDbItemToSelectedBook) // <<< 수정
              .filter((book): book is SelectedBook => book !== null);
            // const remainingBooks = data
            //   .map(item => {
            //       if (!item.book_data) return null;
            //       const bookDataWithDefaults = {
            //           ...{ readStatus: '읽지 않음', rating: 0 },
            //           ...item.book_data,
            //       };
            //       return {
            //           ...bookDataWithDefaults,
            //           id: item.id,
            //           note: item.note,
            //       };
            //   })
            //   .filter((book): book is SelectedBook => book !== null);

            // 기존 책 + 새로 로드한 책 병합
            const combinedBooks = [...myLibraryBooks, ...remainingBooks];

            // ✅ [추가] 에러 책 계산 및 업데이트
            const errorBooks = calculateErrorBooks(combinedBooks);

            set({
              myLibraryBooks: combinedBooks,
              isAllBooksLoaded: true,
              // ✅ [추가] 상태 업데이트
              errorBooks: errorBooks,
              errorBooksCount: errorBooks.length,
            });

            // set({
            //   myLibraryBooks: [...myLibraryBooks, ...remainingBooks],
            //   isAllBooksLoaded: true
            // });

            // 태그 카운트 갱신
            get().fetchTagCounts();
        } catch (error) {
            console.error('Error fetching remaining library:', error);
            setNotification({ message: '나머지 서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
      },

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

      addToLibrary: async (bookToAdd) => {
          
          const { selectedBook, isBookInLibrary } = get(); // ✅ isBookInLibrary 사용
          const { session } = useAuthStore.getState();
          const targetBook = bookToAdd ?? selectedBook;
          if (!targetBook || !session || !('isbn13' in targetBook)) return null;

          const normalizedIsbn = (targetBook.isbn13 || '').toString().trim();
          if (!normalizedIsbn) {
            useUIStore.getState().setNotification({ message: 'ISBN 정보가 없어 서재에 추가할 수 없습니다.', type: 'error' });
            return null;
          }
          
          // ✅ isBookInLibrary 함수를 사용하여 중복 체크 (더 정확함)
          if (isBookInLibrary(normalizedIsbn)) {
            useUIStore.getState().setNotification({ message: '이미 서재에 추가된 책입니다.', type: 'warning' });
            return null;
          }

          // ✅ BookData 타입에 맞게 초기 데이터 구성
          const newBookData: BookData = {
            ...(targetBook as AladdinBookItem), // targetBook은 AladdinBookItem 타입
            isbn13: normalizedIsbn,
            
            // 도서관/재고 정보 초기화
            toechonStock: { totalCount: 0, availableCount: 0 },
            otherStock: { totalCount: 0, availableCount: 0 },
            // gwangjuPaperInfo: { error: '아직 조회되지 않았습니다.' },
            gwangjuPaperInfo: null,
            gyeonggiEduEbookInfo: null,
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
                  // .select('id, book_data, note')
                  .select(`id, book_data, note, ${stockColumns}`) // 수정
                  .single();
              
              if (error) throw error;
              const newBookWithId = mapDbItemToSelectedBook(data); // 수정
              if (!newBookWithId) throw new Error("Failed to add book: No data returned."); // 추가
              
              // if (!data || !data.book_data) throw new Error("Failed to add book: No data returned.");
              // const newBookWithId: SelectedBook = { 
              //     ...(data.book_data as BookData), 
              //     id: data.id,
              //     note: data.note, 
              // };

              set(state => ({ 
                myLibraryBooks: [newBookWithId, ...state.myLibraryBooks],
                // ✅ 책 추가 시, Set에도 새로운 ISBN 추가
                myLibraryIsbnSet: new Set(state.myLibraryIsbnSet).add(newBookWithId.isbn13),
                totalBooksCount: state.totalBooksCount + 1, // ✅ 전체 책 개수 1 증가
              }));
              if (!bookToAdd) {
                set({ selectedBook: null });
              }

              // 내 서재 필터 리셋
              const { resetLibraryFilters } = get();
              if (resetLibraryFilters) {
                resetLibraryFilters();
              }

              // 백그라운드 재고 조회 실행
              const delay = window.location.hostname === 'localhost' ? 100 : 800;
              setTimeout(() => { get().refreshBookInfo(newBookWithId.id, newBookWithId.isbn13, newBookWithId.title, newBookWithId.author); }, delay);

              return newBookWithId;

          } catch(error) {
              console.error("Error adding book to library:", error);
              useUIStore.getState().setNotification({ message: '서재에 책을 추가하는 데 실패했습니다.', type: 'error'});
              return null;
          }
      },

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

            // ✅ [추가] 에러 책 재계산
            const newMyLibraryBooks = state.myLibraryBooks.filter(b => b.id !== id);
            const errorBooks = calculateErrorBooks(newMyLibraryBooks); 

            return {
              // 모든 관련 배열에서 삭제된 아이템 필터링
              myLibraryBooks: state.myLibraryBooks.filter(b => b.id !== id),
              librarySearchResults: state.librarySearchResults.filter(b => b.id !== id),
              libraryTagFilterResults: state.libraryTagFilterResults.filter(b => b.id !== id),
              myLibraryIsbnSet: newIsbnSet,
              totalBooksCount: Math.max(0, state.totalBooksCount - 1), // 전체 책 개수 1 감소
              // ✅ [추가] 상태 업데이트
              errorBooks: errorBooks,
              errorBooksCount: errorBooks.length,
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
      refreshBookInfo: async (id, isbn13, title, author) => {
          set({ refreshingIsbn: isbn13, refreshingEbookId: id });
          const originalBook = await get().getBookById(id);

          if (!originalBook) {
            set({ refreshingIsbn: null, refreshingEbookId: null });
            return;
          }

          try {
            // 끝을 true로 바꾸면 기존 저장캐시 무시하고, 항상 캐싱 새롭게 저장한다.
            // (예)  fetchBookAvailability(isbn13, title, author, originalBook.customSearchTitle, true);
            const libraryPromise = fetchBookAvailability(isbn13, title, author, originalBook.customSearchTitle, false);

            const aladinPromise = searchAladinBooks(isbn13, 'ISBN');
            const [libraryResult, aladinResult] = await Promise.allSettled([libraryPromise, aladinPromise]);

            if (libraryResult.status === 'rejected') throw new Error(`도서관 재고 조회 실패: ${libraryResult.reason.message}`);
            
            const aladinBookData = (aladinResult.status === 'fulfilled' && aladinResult.value.length > 0)
              ? aladinResult.value.find(b => b.isbn13 === isbn13) : null;

            if (!aladinBookData) throw new Error("알라딘 정보 조회 실패");
            
            const pureApiData = createBookDataFromApis(aladinBookData, libraryResult.value);
            
            const finalBookData: BookData = {
                ...(originalBook as BookData),
                ...pureApiData,
                gwangjuPaperInfo: ('error' in pureApiData.gwangjuPaperInfo && originalBook.gwangjuPaperInfo && !('error' in originalBook.gwangjuPaperInfo)) ? originalBook.gwangjuPaperInfo : pureApiData.gwangjuPaperInfo,
                
                // --- ▼▼▼ [타입 가드 추가] ▼▼▼ ---
                gyeonggiEduEbookInfo: (pureApiData.gyeonggiEduEbookInfo && 'errorCount' in pureApiData.gyeonggiEduEbookInfo && pureApiData.gyeonggiEduEbookInfo.errorCount > 0 && originalBook.gyeonggiEduEbookInfo && originalBook.gyeonggiEduEbookInfo.errorCount === 0) ? originalBook.gyeonggiEduEbookInfo : pureApiData.gyeonggiEduEbookInfo,
                // --- ▲▲▲ [타입 가드 추가] ▲▲▲ ---

                gyeonggiEbookInfo: (pureApiData.gyeonggiEbookInfo && 'error' in pureApiData.gyeonggiEbookInfo && originalBook.gyeonggiEbookInfo && !('error' in originalBook.gyeonggiEbookInfo)) ? originalBook.gyeonggiEbookInfo : pureApiData.gyeonggiEbookInfo,
                siripEbookInfo: ((pureApiData.siripEbookInfo === null || ('error' in (pureApiData.siripEbookInfo || {})) || (pureApiData.siripEbookInfo && 'errors' in pureApiData.siripEbookInfo)) && originalBook.siripEbookInfo && !originalBook.siripEbookInfo.errors) ? originalBook.siripEbookInfo : pureApiData.siripEbookInfo,
            };
            
            delete (finalBookData as any).id;
            delete (finalBookData as any).note;
            stockColumns.split(',').forEach(col => delete (finalBookData as any)[col.trim()]);
            
            const dbUpdatePayload: { [key: string]: any } = {
                book_data: finalBookData as unknown as Json,
                title: finalBookData.title,
                author: finalBookData.author,
            };

            const libData = libraryResult.value;

            if (libData.gwangjuPaper && !('error' in libData.gwangjuPaper)) {
                dbUpdatePayload.stock_gwangju_toechon_total = libData.gwangjuPaper.totalCountToechon;
                dbUpdatePayload.stock_gwangju_toechon_available = libData.gwangjuPaper.availableCountToechon;
                dbUpdatePayload.stock_gwangju_other_total = libData.gwangjuPaper.totalCountOther;
                dbUpdatePayload.stock_gwangju_other_available = libData.gwangjuPaper.availableCountOther;
            }

            // --- ▼▼▼ [타입 가드 추가] ▼▼▼ ---
            if (libData.gyeonggiEbookEdu && 'errorCount' in libData.gyeonggiEbookEdu && libData.gyeonggiEbookEdu.errorCount === 0) {
                dbUpdatePayload.stock_gyeonggi_edu_total = libData.gyeonggiEbookEdu.totalCountSummary;
                dbUpdatePayload.stock_gyeonggi_edu_available = libData.gyeonggiEbookEdu.availableCountSummary;
            }
            // --- ▲▲▲ [타입 가드 추가] ▲▲▲ ---

            if (libData.siripEbook && !('error' in libData.siripEbook)) {
                const siripData = libData.siripEbook;
                const hasSubsError = siripData.errors && 'subscription' in siripData.errors;
                const hasOwnedError = siripData.errors && 'owned' in siripData.errors;

                if (!hasSubsError) {
                    dbUpdatePayload.stock_sirip_subs_total = siripData.totalCountSubs;
                    dbUpdatePayload.stock_sirip_subs_available = siripData.availableCountSubs;
                }
                
                if (!hasOwnedError) {
                    dbUpdatePayload.stock_sirip_owned_total = siripData.totalCountOwned;
                    dbUpdatePayload.stock_sirip_owned_available = siripData.availableCountOwned;
                }
            }
            if (libData.gyeonggiEbookLib && !('error' in libData.gyeonggiEbookLib)) {
                dbUpdatePayload.stock_gyeonggi_total = libData.gyeonggiEbookLib.totalCountSummary;
                dbUpdatePayload.stock_gyeonggi_available = libData.gyeonggiEbookLib.availableCountSummary;
            }

            // 낙관적 UI 업데이트 객체 생성
            const updatedBookForUI: SelectedBook = {
              ...originalBook,
              ...finalBookData,
              ...Object.keys(dbUpdatePayload).filter(k => k.startsWith('stock_')).reduce((obj, key) => ({...obj, [key]: dbUpdatePayload[key]}), {})
            };

            // UI 상태 즉시 업데이트
            set(state => {
              const newMyLibraryBooks = state.myLibraryBooks.map(b => (b.id === id ? updatedBookForUI : b));
              
              // ✅ [추가] 에러 책 재계산
              const errorBooks = calculateErrorBooks(newMyLibraryBooks);

              return {
                myLibraryBooks: newMyLibraryBooks,
                librarySearchResults: state.librarySearchResults.map(b => (b.id === id ? updatedBookForUI : b)),
                libraryTagFilterResults: state.libraryTagFilterResults.map(b => (b.id === id ? updatedBookForUI : b)),
                selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id ? updatedBookForUI : state.selectedBook,
                // ✅ [추가] 상태 업데이트
                errorBooks: errorBooks,
                errorBooksCount: errorBooks.length,
              };
            });

            // --- ▼▼▼ [수정] DB 업데이트 로직 직접 처리 ▼▼▼ ---
            const { error } = await supabase
              .from('user_library')
              .update(dbUpdatePayload)
              .eq('id', id);

            if (error) throw error;
            // --- ▲▲▲ [수정] ▲▲▲ ---

          } catch (error) {
            console.error(`Failed to refresh book info for ${title}:`, error);
            useUIStore.getState().setNotification({ message: '도서 정보 갱신에 실패했습니다.', type: 'error' });
            // 롤백 로직 (필요 시 구현)
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

        // ✅ [추가] 태그 카운트 즉시 업데이트 (+1)
        set(state => ({
          tagCounts: {
            ...state.tagCounts,
            [tagId]: (state.tagCounts[tagId] || 0) + 1,
          }
        }));

        await updateBookInStoreAndDB(id, { customTags: newTags }, '태그 추가에 실패했습니다.');
      },

      removeTagFromBook: async (id, tagId) => {
        const book = await get().getBookById(id); // [개선] getBookById 사용
        if (!book) return;
        const updatedTags = (book.customTags || []).filter(t => t !== tagId);

        // ✅ [추가] removeTagFromBook에 대한 올바른 카운트 업데이트
        set(state => ({
          tagCounts: {
            ...state.tagCounts,
            [tagId]: Math.max(0, (state.tagCounts[tagId] || 1) - 1),
          }
        }));

        await updateBookInStoreAndDB(id, { customTags: updatedTags }, '태그 제거에 실패했습니다.');
      },
      
      // ✅ [수정] updateBookTags 함수 전체를 아래 코드로 교체합니다.
      updateBookTags: async (id, tagIds) => {
        const book = await get().getBookById(id);
        if (!book) return;

        // --- 카운트 업데이트 로직 시작 ---
        const oldTags = new Set(book.customTags || []);
        const newTags = new Set(tagIds);
        const tagCountChanges: Record<string, number> = {};

        // 새로 추가된 태그 계산
        newTags.forEach(tagId => {
            if (!oldTags.has(tagId)) {
                tagCountChanges[tagId] = (tagCountChanges[tagId] || 0) + 1;
            }
        });

        // 제거된 태그 계산
        oldTags.forEach(tagId => {
            if (!newTags.has(tagId)) {
                tagCountChanges[tagId] = (tagCountChanges[tagId] || 0) - 1;
            }
        });

        if (Object.keys(tagCountChanges).length > 0) {
            set(state => {
                const newTagCounts = { ...state.tagCounts };
                for (const tagId in tagCountChanges) {
                    newTagCounts[tagId] = Math.max(0, (newTagCounts[tagId] || 0) + tagCountChanges[tagId]);
                }
                return { tagCounts: newTagCounts };
            });
        }
        // --- 카운트 업데이트 로직 끝 ---

        await updateBookInStoreAndDB(id, { customTags: tagIds }, '태그 업데이트에 실패했습니다.');
      },

      // [교체] updateMultipleBookTags 함수 전체를 아래 코드로 교체
      updateMultipleBookTags: async (bookUpdates) => {
          const { getBookById } = get(); // getBookById 함수를 가져옴

          // ✅ [추가 시작] 태그 카운트 즉시 업데이트 로직
          const originalBooks: (SelectedBook | null)[] = await Promise.all(
              bookUpdates.map(update => getBookById(update.id))
          );

          const tagCountChanges: Record<string, number> = {};

          bookUpdates.forEach((update, index) => {
              const originalBook = originalBooks[index];
              if (!originalBook) return;

              const oldTags = new Set(originalBook.customTags || []);
              const newTags = new Set(update.tagIds); // 'tagIds'가 올바른 변수명입니다.

              // 추가된 태그 찾기
              newTags.forEach(tagId => {
                  if (!oldTags.has(tagId)) {
                      tagCountChanges[tagId] = (tagCountChanges[tagId] || 0) + 1;
                  }
              });

              // 제거된 태그 찾기
              oldTags.forEach(tagId => {
                  if (!newTags.has(tagId)) {
                      tagCountChanges[tagId] = (tagCountChanges[tagId] || 0) - 1;
                  }
              });
          });

          set(state => {
              const newTagCounts = { ...state.tagCounts };
              for (const tagId in tagCountChanges) {
                  newTagCounts[tagId] = Math.max(0, (newTagCounts[tagId] || 0) + tagCountChanges[tagId]);
              }
              return { tagCounts: newTagCounts };
          });
          // ✅ [추가 끝]
          
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
        // const { myLibraryBooks } = get();
        // const book = myLibraryBooks.find(b => b.id === id);
        // ✅ [수정] 초기 로딩(50권) -> 모든 데이터 소스에서 책을 찾도록
        const book = await get().getBookById(id); 
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
            // .select('id, book_data, note, title, author')
            .select(`id, book_data, note, title, author, ${stockColumns}`) // <<< 수정
            .eq('user_id', session.user.id)
            .or(`title.ilike.%${query}%,author.ilike.%${query}%`)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const searchResults = data
            .map(mapDbItemToSelectedBook) // <<< 수정
            .filter((book): book is SelectedBook => book !== null);
          // const searchResults = data
          //   .map(item => {
          //     if (!item.book_data) return null;
          //     const bookDataWithDefaults = {
          //       ...{ readStatus: '읽지 않음', rating: 0 },
          //       ...item.book_data,
          //     };
          //     return {
          //       ...bookDataWithDefaults,
          //       id: item.id,
          //       note: item.note,
          //     };
          //   })
          //   .filter((book): book is SelectedBook => book !== null);

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

      // filterLibraryByTags: async (tagIds: string[]) => {
      //   if (tagIds.length === 0) {
      //     get().clearLibraryTagFilter();
      //     return;
      //   }

      //   const { session } = useAuthStore.getState();
      //   if (!session?.user) return;

      //   set({ isFilteringByTag: true });
      //   try {
      //     const { data, error } = await supabase.rpc('get_books_by_tags', {
      //       tags_to_filter: tagIds,
      //     });

      //     if (error) throw error;

      //     const results = (data || []).map(item => {
      //       const bookDataWithDefaults = {
      //         ...{ readStatus: '읽지 않음', rating: 0 },
      //         ...item.book_data,
      //       };
      //       return {
      //         ...bookDataWithDefaults,
      //         id: item.id,
      //         note: item.note,
      //       };
      //     });

      //     set({ libraryTagFilterResults: results, isFilteringByTag: false });
      //   } catch (error) {
      //     console.error('Error filtering by tags:', error);
      //     set({ libraryTagFilterResults: [], isFilteringByTag: false });
      //   }
      // },


      
      // ✅ [핵심 수정] filterLibraryByTags 함수를 AND 조건을 처리하도록 완전히 변경합니다.
      filterLibraryByTags: async (tagIds: string[], filterByFavorites: boolean) => {
        set({ isFilteringByTag: true, libraryTagFilterResults: [] });
        try {
          // ✅ [수정] Supabase에 생성된 함수 이름과 파라미터 이름에 정확히 맞춰줍니다.
          const { data, error } = await supabase.rpc('get_books_by_tags', {
            tags_to_filter: tagIds,
            filter_by_favorites: filterByFavorites,
          });

          if (error) throw error;

          // ✅ [수정] 반환된 데이터 구조에 맞춰 파싱 로직을 변경합니다.
          // SQL 함수가 user_library 테이블 전체 행(id, book_data, note 포함)을 반환하므로,
          // book_data를 추출하고 id, note를 합쳐주는 과정이 필요합니다.
          // const filteredBooks = data.map((item: any) => {
          //   // 기본값(readStatus, rating)을 포함하여 SelectedBook 형태로 재구성
          //   const bookDataWithDefaults = {
          //     ...{ readStatus: '읽지 않음', rating: 0 },
          //     ...item.book_data,
          //   };
          //   return {
          //     ...bookDataWithDefaults,
          //     id: item.id,
          //     note: item.note,
          //   };
          // });

          // `data`가 `user_library`의 전체 행을 포함하므로 `mapDbItemToSelectedBook` 사용 가능
          const filteredBooks = data
            .map(mapDbItemToSelectedBook) // <<< 수정
            .filter((book): book is SelectedBook => book !== null);
          set({ libraryTagFilterResults: filteredBooks });

        } catch (error) {
          console.error('Error filtering library by tags and favorites:', error);
          set({ libraryTagFilterResults: [] });
        } finally {
          set({ isFilteringByTag: false });
        }
      },

      clearLibraryTagFilter: () => {
        set({ libraryTagFilterResults: [] });
      },

      bulkRefreshAllBooks: async (
          options: {
            type: 'recent' | 'old' | 'all' | 'range' | 'error'; // ✅ [수정] 'error' 타입 추가
            limit?: number;
            start?: number;
            end?: number;
            targetBooks?: SelectedBook[]; // ✅ [추가] 타겟 책 목록을 직접 받음
          },
          callbacks
        ) => {
          const { isAllBooksLoaded, fetchRemainingLibrary, myLibraryBooks, errorBooks } = get(); // ✅ [추가] errorBooks 가져옴

          // 1. 필요한 경우 전체 라이브러리를 먼저 로드
          if (!isAllBooksLoaded) {
            await fetchRemainingLibrary();
          }
          
          // 2. 최신 책 목록을 가져와서 옵션에 따라 대상 책을 선정
          const booksToRefresh = ((): SelectedBook[] => {
            // ✅ [핵심 수정] targetBooks가 있으면 그것을 최우선으로 사용
            if (options.targetBooks && options.targetBooks.length > 0) {
                // targetBooks가 전달된 경우, 해당 목록을 사용 (예: errorBooks)
                return options.targetBooks;
            }
            
            const allBooks = [...myLibraryBooks];
            
            switch (options.type) {
              case 'recent':
                // 최근 추가된 순서대로 정렬
                return allBooks.sort((a, b) => b.addedDate - a.addedDate).slice(0, options.limit);
              case 'old':
                // 오래된 순서대로 정렬 (addedDate가 작은 순)
                return allBooks.sort((a, b) => a.addedDate - b.addedDate).slice(0, options.limit);
              case 'range':
                // 최근 추가된 순서를 기준으로 범위 지정 (1부터 시작)
                const start = (options.start || 1) - 1;
                const end = options.end || allBooks.length;
                return allBooks.sort((a, b) => b.addedDate - a.addedDate).slice(start, end);
              case 'all':
              default:
                return allBooks;
            }
          })();
          
          // ... (3. 초기 상태 설정부터 끝까지 로직은 동일)
          const total = booksToRefresh.length;

          // 3. 초기 상태 설정
          set({
            bulkRefreshState: {
              isRunning: true,
              isPaused: false,
              isCancelled: false,
              current: 0,
              total,
              failed: [],
              currentBookTitle: null, // ✅ [해결] 여기에 초기값을 추가합니다.
            },
          });

          // ... (for 루프 및 로직은 동일하게 진행)

          const failed: number[] = [];
          let current = 0;
          const batchSize = 10;
          
          for (let i = 0; i < booksToRefresh.length; i += batchSize) {
            // ... (취소/일시정지 확인 로직)
            if (get().bulkRefreshState.isCancelled) { break; }
            while (get().bulkRefreshState.isPaused) {
              await new Promise(resolve => setTimeout(resolve, 100));
              if (get().bulkRefreshState.isCancelled) break;
            }
            if (get().bulkRefreshState.isCancelled) break;

            const batch = booksToRefresh.slice(i, i + batchSize);

            for (const book of batch) {
              if (get().bulkRefreshState.isCancelled) break;

              // ✅ [핵심 추가] 재고 조회 시작 직전에 현재 책 제목으로 상태 업데이트
              set(state => ({
                bulkRefreshState: {
                  ...state.bulkRefreshState,
                  currentBookTitle: book.title,
                },
              }));

              try {
                await get().refreshBookInfo(book.id, book.isbn13, book.title, book.author);
              } catch (error) {
                console.error(`Failed to refresh book ${book.id}:`, error);
                failed.push(book.id);
              } finally {
                current++;
                set(state => ({
                  bulkRefreshState: { ...state.bulkRefreshState, current, failed: [...failed] },
                }));
                callbacks.onProgress(current, total, failed.length);
            
                // 1개마다 0.2초 쉰다
                if (!get().bulkRefreshState.isCancelled) {
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              }
            }
            if (get().bulkRefreshState.isCancelled) break;

            // 10개마다 1초 쉰다
            if (i + batchSize < booksToRefresh.length && !get().bulkRefreshState.isCancelled) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          // 5. 최종 완료 상태 설정
          set(state => ({
            bulkRefreshState: { ...state.bulkRefreshState, isRunning: false, isPaused: false },
          }));

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
