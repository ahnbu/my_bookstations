
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { AladdinBookItem, SelectedBook, SortKey, ReadStatus, BookData, Json, EBookInfo, StockInfo } from '../types';
import { searchAladinBooks } from '../services/aladin.service';
import { filterGyeonggiEbookByIsbn } from '../utils/isbnMatcher';
import { useUIStore } from './useUIStore';
import { useAuthStore } from './useAuthStore';
import { useSettingsStore } from './useSettingsStore';
import { fetchBookAvailability, GyeonggiEduEbookSummarize, GwangjuPaperResult, GyeonggiEduEbookError, GyeonggiEbookResult} from '../services/unifiedLibrary.service'; // GyeonggiEbookLibraryResult 임포트 추가

/**
 * 특정 책의 데이터를 업데이트하고, 로컬 상태와 Supabase DB를 동기화하는 헬퍼 함수
 * @param id 업데이트할 책의 ID
 * @param updates BookData 객체의 일부. 변경할 내용만 담습니다.
 * @param errorMessage DB 업데이트 실패 시 보여줄 알림 메시지
 */

async function updateBookInStoreAndDB(
  id: number,
  updates: Partial<Omit<BookData, 'id'>>,
  errorMessage: string = '책 정보 업데이트에 실패했습니다.'
): Promise<void> {
  // [핵심 수정] getBookById를 호출하여 모든 데이터 소스에서 책을 찾음
  const originalBook = await useBookStore.getState().getBookById(id);

  if (!originalBook) {
    console.warn(`[updateBook] Book with id ${id} not found in any available source.`);
    return;
  }

  // 1. 낙관적 업데이트 (기존 로직과 동일)
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

  // 2. DB 업데이트 (기존 로직과 동일)
  const { id: bookId, detailedStockInfo, note, ...bookDataForDb } = updatedBook;
  try {
    const updateData: { book_data: Json; note?: string | null; title?: string; author?: string } = {
      title: updatedBook.title,
      author: updatedBook.author,
      book_data: bookDataForDb as unknown as Json
    };
    if ('note' in updates) {
      updateData.note = note || null;
    }
    const { error } = await supabase
      .from('user_library')
      .update(updateData)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    // 3. 롤백 (기존 로직과 동일)
    console.error(`[updateBook] Failed to update book (id: ${id}) in DB:`, error);
    useUIStore.getState().setNotification({
      message: `${errorMessage} 변경사항이 저장되지 않았을 수 있습니다.`,
      type: 'error',
    });
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

interface BookState {
  getBookById: (id: number) => Promise<SelectedBook | null>; // [추가]
  searchResults: AladdinBookItem[];
  selectedBook: AladdinBookItem | SelectedBook | null;
  myLibraryBooks: SelectedBook[];
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

  // Pagination state
  currentPage: number;
  hasMoreResults: boolean;
  isLoadingMore: boolean;
  lastSearchQuery: string;
  lastSearchType: string;

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
  refreshEBookInfo: (id: number, isbn: string, title: string) => Promise<void>;
  refreshAllBookInfo: (id: number, isbn13: string, title: string) => Promise<void>;
  sortLibrary: (key: SortKey) => void;
  fetchUserLibrary: () => Promise<void>;
  fetchRemainingLibrary: () => Promise<void>;
  clearLibrary: () => void;
  updateReadStatus: (id: number, status: ReadStatus) => Promise<void>;
  updateRating: (id: number, rating: number) => Promise<void>;
  updateMissingEbookIsbn13: () => Promise<void>;
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
}


export const useBookStore = create<BookState>(
    (set, get) => ({
      // State
      searchResults: [],
      selectedBook: null,
      myLibraryBooks: [],
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
      fetchUserLibrary: async () => {
        const { session } = useAuthStore.getState();
        if (!session) return;

        const { setIsLoading, setNotification } = useUIStore.getState();
        setIsLoading(true);

        try {
            // 사용자 설정에서 초기 로딩 건수 가져오기
            const { settings } = useSettingsStore.getState();
            const pageSize = settings.defaultPageSize;

            const { data, error, count } = await supabase
                .from('user_library')
                .select('id, book_data, note', { count: 'exact' })
                .order('created_at', { ascending: false })
                .limit(pageSize);

            if (error) throw error;

            const libraryBooks = data
              .map(item => {
                  if (!item.book_data) return null; // Safety check for null jsonb
                  // Provide default values for older data that might not have these fields
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

            // pageSize보다 적게 로드되면 전체 로드 완료
            const isAllLoaded = libraryBooks.length < pageSize;
            set({
              myLibraryBooks: libraryBooks,
              totalBooksCount: count || 0,
              isAllBooksLoaded: isAllLoaded
            });
            // 태그 카운트 갱신
            get().fetchTagCounts();
            // 자동 전자책 정보 업데이트 제거 - 사용자가 명시적으로 요청할 때만 실행
            // get().updateMissingEbookIsbn13();
        } catch (error) {
            console.error('Error fetching user library:', error);
            setNotification({ message: '서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
      },

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

      updateMissingEbookIsbn13: async () => {
        const { myLibraryBooks } = get();
        const { setNotification } = useUIStore.getState();
        
        for (const book of myLibraryBooks) {
          // ebookList가 없거나, 첫 번째 항목이 없거나, isbn13이 없는 경우
          if (!book.subInfo?.ebookList?.[0]?.isbn13) {
            try {
              // 해당 책의 ISBN13으로 알라딘 API를 다시 검색하여 최신 정보 가져오기
              const results = await searchAladinBooks(book.isbn13, 'ISBN');
              const updatedAladinBook = results.find(item => item.isbn13 === book.isbn13);

              if (updatedAladinBook && updatedAladinBook.subInfo?.ebookList?.[0]?.isbn13) {
                const newSubInfo = updatedAladinBook.subInfo;
                
                const updatedBookData: SelectedBook  = {
                  ...book,
                  subInfo: newSubInfo, // 새로운 subInfo로 업데이트
                };

                // DB 저장 시 detailedStockInfo 필드 제외하여 저장공간 절약
                const { id: bookId, detailedStockInfo, ...bookDataForDb } = updatedBookData;

                const { error } = await supabase
                  .from('user_library')
                  .update({
                    title: updatedBookData.title,
                    author: updatedBookData.author,
                    book_data: bookDataForDb as unknown as Json
                  })
                  .eq('id', book.id);

                if (error) throw error;

                // 상태 업데이트
                set(state => ({
                  myLibraryBooks: state.myLibraryBooks.map(b =>
                    b.id === book.id ? updatedBookData : b
                  ),
                  selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === book.id ? updatedBookData : state.selectedBook
                }));
                // console.log(`Updated ebook isbn13 for book ID: ${book.id}`); // 성능 개선을 위해 주석 처리
              }
            } catch (error) {
              console.error(`Failed to update ebook isbn13 for book ID: ${book.id}`, error);
              setNotification({ message: `일부 책의 전자책 ISBN 정보 갱신에 실패했습니다: ${book.title}`, type: 'warning' });
            }
          }
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
          const results = await searchAladinBooks(query, searchType, 1);
          // [세트] 로 시작하는 도서 제외
          const filteredResults = results.filter(book => !book.title.startsWith('[세트]'));

          // 같은 페이지 내에서도 중복 ISBN13 제거 (안전장치)
          const uniqueResults = filteredResults.filter((book, index, self) =>
            index === self.findIndex(b => b.isbn13 === book.isbn13)
          );

          set({
            searchResults: uniqueResults,
            hasMoreResults: filteredResults.length === 20 // 원본 결과 기준으로 판단
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
          const { selectedBook, myLibraryBooks } = get();
          const { session } = useAuthStore.getState();
          if (!selectedBook || !session) return;

          // ISBN 기준으로 중복 체크 (이중 안전장치)
          const isDuplicate = myLibraryBooks.some(book => book.isbn13 === selectedBook.isbn13);
          if (isDuplicate) {
            useUIStore.getState().setNotification({ 
              message: '이미 서재에 추가된 책입니다.', 
              type: 'warning'
            });
            return;
          }

          const newBookData: BookData = {
            ...selectedBook,
            addedDate: Date.now(),
            toechonStock: { total_count: 0, available_count: 0 },
            otherStock: { total_count: 0, available_count: 0 },
            readStatus: '읽지 않음' as ReadStatus,
            rating: 0,
            isFavorite: false,
            // subInfo가 selectedBook에 있다면 명시적으로 포함
            ...(selectedBook.subInfo && { subInfo: selectedBook.subInfo }),
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

              const newBookWithId: SelectedBook = { ...(data.book_data as BookData), id: data.id };

              set(state => ({ myLibraryBooks: [newBookWithId, ...state.myLibraryBooks] }));
              // 책 추가 성공 후 모달 닫기 및 선택된 책 초기화
              // useUIStore.getState().closeBookSearchListModal();
              set({ selectedBook: null });

              // 내 서재 필터 리셋 (추가된 책이 보이도록)
              const { resetLibraryFilters } = get();
              if (resetLibraryFilters) {
                resetLibraryFilters();
              }

              // 비동기 백그라운드 재고 조회 실행 (환경별 지연 시간 적용)
              const delay = window.location.hostname === 'localhost' ? 100 : 800;
              setTimeout(() => { get().refreshAllBookInfo(newBookWithId.id, newBookWithId.isbn13, newBookWithId.title); }, delay);

          } catch(error) {
              console.error("Error adding book to library:", error);
              useUIStore.getState().setNotification({ message: '서재에 책을 추가하는 데 실패했습니다.', type: 'error'});
          }
      },

      removeFromLibrary: async (id: number) => {
        try {
            const { error } = await supabase.from('user_library').delete().eq('id', id);
            if (error) throw error;

            set(state => {
                const newLibraryBooks = state.myLibraryBooks.filter(b => b.id !== id);
                let newSelectedBook = state.selectedBook;

                // If the deleted book was the selected book, unselect it to prevent errors.
                if (newSelectedBook && 'id' in newSelectedBook && newSelectedBook.id === id) {
                    newSelectedBook = null;
                }
                
                return {
                    myLibraryBooks: newLibraryBooks,
                    selectedBook: newSelectedBook,
                };
            });
        } catch(error) {
            console.error("Error removing book from library:", error);
            useUIStore.getState().setNotification({ message: '서재에서 책을 삭제하는 데 실패했습니다.', type: 'error'});
        }
      },

      // refreshEBookInfo: async (id, isbn, title) => {
      //   set({ refreshingEbookId: id });
      //   try {
      //     const result = await fetchBookAvailability(isbn, title);
      //     const ebookSummary = GyeonggiEduEbookSummarize(result.gyeonggi_ebook_edu);
      //     const bookToUpdate = get().myLibraryBooks.find(b => b.id === id);
      //     if (!bookToUpdate) return;
      //     const newEBookInfo: EBookInfo = {
      //       summary: ebookSummary,
      //       details: result.gyeonggi_ebook_edu,
      //       lastUpdated: Date.now()
      //     };

      //     // DB 저장 시 detailedStockInfo 필드 제외하여 저장공간 절약
      //     const { id: bookId, detailedStockInfo, ...bookDataForDb } = updatedBook;

      //     const { error } = await supabase
      //       .from('user_library')
      //       .update({
      //         title: updatedBook.title,
      //         author: updatedBook.author,
      //         book_data: bookDataForDb as unknown as Json
      //       })
      //       .eq('id', id);

      //     if (error) throw error;
          
      //     set(state => ({
      //       myLibraryBooks: state.myLibraryBooks.map(book =>
      //         book.id === id ? updatedBook : book
      //       ),
      //       selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id ? updatedBook : state.selectedBook
      //     }));


      //   } catch (error) {
      //     console.error(`Failed to refresh ebook info for ${title}`, error);
      //     useUIStore.getState().setNotification({ message: '전자책 정보 갱신에 실패했습니다.', type: 'error' });
      //   } finally {
      //     set({ refreshingEbookId: null });
      //   }
      // },

      // useBookStore.ts 파일 내의 refreshEBookInfo 함수를 아래 코드로 교체하세요.

      refreshEBookInfo: async (id, isbn, title) => {      // 개선 버전
          set({ refreshingEbookId: id });
          try {
              // 1. 통합 API를 호출하여 최신 재고 정보를 가져옵니다.
              // 이 함수는 내부적으로 customSearchTitle도 고려하여 호출합니다.
              const result = await fetchBookAvailability(isbn, title);

              // 2. getBookById를 사용하여 모든 데이터 소스에서 업데이트할 책을 찾습니다.
              // 이렇게 하면 검색 결과나 태그 필터링 뷰에서도 새로고침이 정상적으로 작동합니다.
              const bookToUpdate = await get().getBookById(id);
              if (!bookToUpdate) {
                  console.warn(`[refreshEBookInfo] Book with id ${id} not found in any available source.`);
                  set({ refreshingEbookId: null });
                  return;
              }

              let newEBookInfo: EBookInfo;

              // 3. 변경된 API 응답 구조에 맞춰 newEBookInfo 객체를 생성합니다.
              // if (result.gyeonggi_ebook_edu && !('error' in result.gyeonggi_ebook_edu)) {
              if (result.gyeonggi_ebook_edu && 'book_list' in result.gyeonggi_ebook_edu) {
                  // API 호출이 성공한 경우
                  const eduResult = result.gyeonggi_ebook_edu;
                  newEBookInfo = {
                      summary: {
                          total_count: eduResult.total_count,
                          available_count: eduResult.available_count,
                          unavailable_count: eduResult.unavailable_count,
                          seongnam_count: eduResult.seongnam_count,
                          tonghap_count: eduResult.tonghap_count,
                          error_count: eduResult.error_count,
                      },
                      details: eduResult.book_list,
                      lastUpdated: Date.now()
                  };
              } else {
                  // API 호출이 실패하거나 에러 객체를 반환한 경우
                  newEBookInfo = {
                      summary: { total_count: 0, available_count: 0, unavailable_count: 0, seongnam_count: 0, tonghap_count: 0, error_count: 1 },
                      details: [{ error: (result.gyeonggi_ebook_edu as any)?.error || '정보 조회 실패' }],
                      lastUpdated: Date.now()
                  };
              }

              // 4. 중앙화된 헬퍼 함수를 사용하여 상태 업데이트와 DB 저장을 한 번에 처리합니다.
              // 이 함수는 낙관적 업데이트, DB 저장, 실패 시 롤백을 모두 담당합니다.
              await updateBookInStoreAndDB(id, { ebookInfo: newEBookInfo }, '전자책 정보 갱신에 실패했습니다.');

          } catch (error) {
              // API 호출 자체(fetchBookAvailability)에서 발생한 네트워크 에러 등을 처리합니다.
              console.error(`Failed to refresh ebook info for ${title}`, error);
              useUIStore.getState().setNotification({ message: '전자책 정보 갱신 중 네트워크 오류가 발생했습니다.', type: 'error' });
          } finally {
              // 성공하든 실패하든 로딩 상태를 해제합니다.
              set({ refreshingEbookId: null });
          }
      },

      // 2025.10.13 - API에러시 퇴촌(0/0) -> 퇴촌(에러)로 표시하도록 수정
      refreshAllBookInfo: async (id, isbn13, title) => {
        set({ refreshingIsbn: isbn13, refreshingEbookId: id });
        
        // [핵심 수정] getBookById를 호출하여 모든 데이터 소스에서 책을 찾음
        // const originalBook = get().myLibraryBooks.find(b => b.id === id);
        const originalBook = await get().getBookById(id);
        
        if (!originalBook) {
          console.warn(`[refreshAllBookInfo] Book with id ${id} not found.`);
          set({ refreshingIsbn: null, refreshingEbookId: null });
          return;
        }

        try {
          // 1. 통합 API 호출
          const result = await fetchBookAvailability(
            isbn13, 
            title,
            originalBook.customSearchTitle // customSearchTitle을 세 번째 인자로 전달
          );

          // 2. UI 상태 즉시 업데이트 (API 결과를 그대로 반영)
          const bookWithLatestApiResult = { ...originalBook };
          
          // --- 종이책 UI 상태 업데이트 ---
          bookWithLatestApiResult.gwangjuPaperInfo = result.gwangju_paper;
          // [개선] API 응답에 요약 정보가 있는지 확인
          if ('summary_total_count' in result.gwangju_paper) {
            const paperResult = result.gwangju_paper as GwangjuPaperResult;
            
            // [개선] API가 제공하는 요약 정보를 직접 사용하여 stock 상태를 업데이트
            bookWithLatestApiResult.toechonStock = { 
              total_count: paperResult.toechon_total_count, 
              available_count: paperResult.toechon_available_count 
            };
            bookWithLatestApiResult.otherStock = { 
              total_count: paperResult.other_total_count, 
              available_count: paperResult.other_available_count 
            };
          }

          // --- 기존 : book_list에서 직접 계산 ---
          // bookWithLatestApiResult.gwangjuPaperInfo = result.gwangju_paper;
          // if ('book_list' in result.gwangju_paper) {
          //   const paperResult = result.gwangju_paper as GwangjuPaperResult;
          //   let toechonTotal = 0, toechonAvailable = 0, otherTotal = 0, otherAvailable = 0;
          //   (paperResult.book_list ?? []).forEach(item => {
          //     const libraryName = item['소장도서관'];
          //     if (libraryName === '정보없음' || !libraryName) return;
          //     const isToechon = libraryName === '퇴촌도서관';
          //     const isAvailable = item['대출상태'] === '대출가능';
          //     if (isToechon) { toechonTotal++; if (isAvailable) toechonAvailable++; } 
          //     else { otherTotal++; if (isAvailable) otherAvailable++; }
          //   });
          //   bookWithLatestApiResult.toechonStock = { total_count: toechonTotal, available_count: toechonAvailable };
          //   bookWithLatestApiResult.otherStock = { total_count: otherTotal, available_count: otherAvailable };
          // }
          
          // --- 전자책 UI 상태 업데이트 ---

          // API 응답이 이미 요약 정보를 포함한 객체이므로, GyeonggiEduEbookSummarize 함수는 더 이상 필요 없습니다.
          // bookWithLatestApiResult.ebookInfo = {
            // summary: GyeonggiEduEbookSummarize(result.gyeonggi_ebook_edu),
            // details: result.gyeonggi_ebook_edu,
            // lastUpdated: Date.now(),
          // };
          
          if (result.gyeonggi_ebook_edu && !('error' in result.gyeonggi_ebook_edu)) {
          // if (result.gyeonggi_ebook_edu && !('error' in result.gyeonggi_ebook_edu)) {
            // GyeonggiEduEbookResult 타입에서 필요한 summary와 details를 추출합니다.
            const eduResult = result.gyeonggi_ebook_edu;
            bookWithLatestApiResult.ebookInfo = {
              summary: { // summary 객체를 API 응답에서 직접 구성
                total_count: eduResult.total_count,
                available_count: eduResult.available_count,
                unavailable_count: eduResult.unavailable_count,
                seongnam_count: eduResult.seongnam_count,
                tonghap_count: eduResult.tonghap_count,
                error_count: eduResult.error_count,
              },
              details: eduResult.book_list, // details는 book_list를 사용
              lastUpdated: Date.now(),
            };
          } else {
              // API 응답에 에러가 있는 경우의 처리
              bookWithLatestApiResult.ebookInfo = {
                  summary: { total_count: 0, available_count: 0, unavailable_count: 0, seongnam_count: 0, tonghap_count: 0, error_count: 1 },
                  details: [{ error: (result.gyeonggi_ebook_edu as GyeonggiEduEbookError)?.error || '정보 조회 실패' }],
                  lastUpdated: Date.now(),
              };
          }


          if (result.gyeonggi_ebook_library) {
            bookWithLatestApiResult.gyeonggiEbookInfo = result.gyeonggi_ebook_library;
            
            // [핵심 수정] API 호출이 성공했을 때만 필터링 함수를 호출
            if (!('error' in result.gyeonggi_ebook_library)) {
                bookWithLatestApiResult.filteredGyeonggiEbookInfo = filterGyeonggiEbookByIsbn(
                    bookWithLatestApiResult,
                    result.gyeonggi_ebook_library // 이 시점에서 이 변수는 GyeonggiEbookLibraryResult 타입임이 보장됨
                );
            } else {
                // 에러가 발생한 경우, 필터링된 결과도 에러 객체로 설정
                bookWithLatestApiResult.filteredGyeonggiEbookInfo = result.gyeonggi_ebook_library;
            }
          }

          if (result.sirip_ebook) {
            bookWithLatestApiResult.siripEbookInfo = result.sirip_ebook;
          }
          
          // Zustand 스토어에 UI용 최신 상태 반영
          set(state => ({
            myLibraryBooks: state.myLibraryBooks.map(b => (b.id === id ? bookWithLatestApiResult : b)),
            librarySearchResults: state.librarySearchResults.map(b => (b.id === id ? bookWithLatestApiResult : b)),
            libraryTagFilterResults: state.libraryTagFilterResults.map(b => (b.id === id ? bookWithLatestApiResult : b)),
            selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id ? bookWithLatestApiResult : state.selectedBook,
          }));


          // 3. DB에 저장할 데이터 선별
          const bookDataForDb = { ...originalBook } as BookData & { id: number };
          // const bookDataForDb = { ...bookWithLatestApiResult } as BookData & { id: number };

          // --- 종이책 DB 업데이트 데이터 선별 ---
          if ('book_list' in result.gwangju_paper) {
            // bookWithLatestApiResult에서 계산된 최신 재고 정보를 bookDataForDb에 할당
            bookDataForDb.gwangjuPaperInfo = bookWithLatestApiResult.gwangjuPaperInfo;
            bookDataForDb.toechonStock = bookWithLatestApiResult.toechonStock;
            bookDataForDb.otherStock = bookWithLatestApiResult.otherStock;
          } else if (!originalBook.gwangjuPaperInfo) {
            // API 실패 시, 기존 정보가 없었다면 에러 정보라도 저장
            bookDataForDb.gwangjuPaperInfo = result.gwangju_paper;
            bookDataForDb.toechonStock = { total_count: 0, available_count: 0 };
            bookDataForDb.otherStock = { total_count: 0, available_count: 0 };
          }

          // --- 전자책 DB 업데이트 데이터 선별 ---
          bookDataForDb.ebookInfo = bookWithLatestApiResult.ebookInfo;

          if (result.gyeonggi_ebook_library) {
              if (!('error' in result.gyeonggi_ebook_library)) {
                  bookDataForDb.gyeonggiEbookInfo = bookWithLatestApiResult.gyeonggiEbookInfo;
                  bookDataForDb.filteredGyeonggiEbookInfo = bookWithLatestApiResult.filteredGyeonggiEbookInfo;
              } else if (!originalBook.gyeonggiEbookInfo) {
                  bookDataForDb.gyeonggiEbookInfo = result.gyeonggi_ebook_library;
                  const emptyResult: GyeonggiEbookResult = { library_name: "경기도 전자도서관", total_count: 0, available_count: 0, unavailable_count: 0, owned_count: 0, subscription_count: 0, book_list: [] };
                  bookDataForDb.filteredGyeonggiEbookInfo = filterGyeonggiEbookByIsbn(bookDataForDb, emptyResult);
              }
          }
          
          if (result.sirip_ebook) {
              if (!('error' in result.sirip_ebook)) {
                  bookDataForDb.siripEbookInfo = bookWithLatestApiResult.siripEbookInfo;
              } else if (!originalBook.siripEbookInfo) {
                  bookDataForDb.siripEbookInfo = result.sirip_ebook;
              }
          }

          // 4. 최종 DB 업데이트
          const { id: bookId, detailedStockInfo, ...finalDataForDb } = bookDataForDb;

          const { error } = await supabase
            .from('user_library')
            .update({
              title: finalDataForDb.title,
              author: finalDataForDb.author,
              book_data: finalDataForDb as unknown as Json,
            })
            .eq('id', id);

          if (error) throw error;

        } catch (error) {
          console.error(`Failed to refresh all book info for ${title}`, error);
          useUIStore.getState().setNotification({ message: '도서 정보 갱신에 실패했습니다.', type: 'error' });
          
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
              const { id: bookId, detailedStockInfo, ...bookDataForDb } = updatedBookData;
              
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
          const results = await searchAladinBooks(lastSearchQuery, lastSearchType, startIndex);

          // [세트] 로 시작하는 도서 제외
          const filteredResults = results.filter(book => !book.title.startsWith('[세트]'));

          // 기존 결과와 중복되지 않는 새로운 결과만 필터링
          const existingIsbn13s = new Set(searchResults.map(book => book.isbn13));
          const uniqueNewResults = filteredResults.filter(book => !existingIsbn13s.has(book.isbn13));

          set({
            searchResults: [...searchResults, ...uniqueNewResults],
            currentPage: nextPage,
            hasMoreResults: filteredResults.length === 20, // 원본 결과 기준으로 판단
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
              await get().refreshAllBookInfo(book.id, book.isbn13, book.title);
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
