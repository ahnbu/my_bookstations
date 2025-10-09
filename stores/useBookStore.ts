
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { AladdinBookItem, SelectedBook, SortKey, ReadStatus, BookData, Json, EBookInfo, StockInfo } from '../types';
import { searchAladinBooks } from '../services/aladin.service';
import { fetchBookAvailability, summarizeEBooks, GwangjuPaperResult } from '../services/unifiedLibrary.service';
import { filterGyeonggiEbookByIsbn } from '../utils/isbnMatcher';
import { useUIStore } from './useUIStore';
import { useAuthStore } from './useAuthStore';
import { useSettingsStore } from './useSettingsStore';

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
  const { myLibraryBooks } = useBookStore.getState();
  const originalBook = myLibraryBooks.find(b => b.id === id);

  if (!originalBook) {
    console.warn(`[updateBook] Book with id ${id} not found.`);
    return;
  }

  // 1. 낙관적 업데이트: UI 상태를 즉시 변경
  const updatedBook: SelectedBook = { ...originalBook, ...updates };
  useBookStore.setState(state => ({
    myLibraryBooks: state.myLibraryBooks.map(b => (b.id === id ? updatedBook : b)),
    selectedBook:
      state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id
        ? updatedBook
        : state.selectedBook,
  }));

  // 2. DB 업데이트: 백그라운드에서 실행
  // DB에 저장할 때는 id, detailedStockInfo 등 불필요한 속성을 제외합니다.
  const { id: bookId, detailedStockInfo, note, ...bookDataForDb } = updatedBook;
  try {
    // note 필드는 별도 컬럼으로, book_data는 JSONB로 저장
    const updateData: { book_data: Json; note?: string | null; title?: string; author?: string } = {
      title: updatedBook.title,
      author: updatedBook.author,
      book_data: bookDataForDb as Json
    };

    // note가 updates에 포함된 경우에만 DB의 note 컬럼 업데이트
    if ('note' in updates) {
      updateData.note = note || null;
    }

    const { error } = await supabase
      .from('user_library')
      .update(updateData)
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    // 3. 롤백: DB 업데이트 실패 시 UI 상태를 원래대로 되돌림

    console.error(`[updateBook] Failed to update book (id: ${id}) in DB:`, error);
    useUIStore.getState().setNotification({
      message: `${errorMessage} 변경사항이 저장되지 않았을 수 있습니다.`,
      type: 'error',
    });
    useBookStore.setState(state => ({
      myLibraryBooks: state.myLibraryBooks.map(b => (b.id === id ? originalBook : b)),
      selectedBook:
        state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id
          ? originalBook
          : state.selectedBook,
    }));
  }
}

interface BookState {
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
  updateMultipleBookTags: (bookUpdates: Array<{id: number, tagIds: string[]}>) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  updateBookNote: (id: number, note: string) => Promise<void>;
  setResetLibraryFilters: (resetFn?: () => void) => void;
  setAuthorFilter: (author: string) => void;
  clearAuthorFilter: () => void;
  searchUserLibrary: (query: string) => Promise<void>;
  clearLibrarySearch: () => void;
  fetchTagCounts: () => Promise<void>;
  filterLibraryByTags: (tagIds: string[]) => Promise<void>;
  clearLibraryTagFilter: () => void;
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
                .select('id, book_data', { count: 'exact' })
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
                .select('id, book_data')
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
                
                const updatedBookData: BookData = {
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
                    book_data: bookDataForDb as Json
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
            toechonStock: { total: 0, available: 0 },
            otherStock: { total: 0, available: 0 },
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
                    book_data: newBookData as Json
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

      refreshEBookInfo: async (id, isbn, title) => {
        set({ refreshingEbookId: id });
        try {
          const result = await fetchBookAvailability(isbn, title);
          const ebookSummary = summarizeEBooks(result.gyeonggi_ebook_education);
          
          const bookToUpdate = get().myLibraryBooks.find(b => b.id === id);
          if (!bookToUpdate) return;

          const newEBookInfo: EBookInfo = {
            summary: ebookSummary,
            details: result.gyeonggi_ebook_education,
            lastUpdated: Date.now()
          };

          const updatedBook = { ...bookToUpdate, ebookInfo: newEBookInfo };
          // DB 저장 시 detailedStockInfo 필드 제외하여 저장공간 절약
          const { id: bookId, detailedStockInfo, ...bookDataForDb } = updatedBook;

          const { error } = await supabase
            .from('user_library')
            .update({
              title: updatedBook.title,
              author: updatedBook.author,
              book_data: bookDataForDb as Json
            })
            .eq('id', id);

          if (error) throw error;
          
          set(state => ({
            myLibraryBooks: state.myLibraryBooks.map(book =>
              book.id === id ? updatedBook : book
            ),
            selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id ? updatedBook : state.selectedBook
          }));
        } catch (error) {
          console.error(`Failed to refresh ebook info for ${title}`, error);
          useUIStore.getState().setNotification({ message: '전자책 정보 갱신에 실패했습니다.', type: 'error' });
        } finally {
          set({ refreshingEbookId: null });
        }
      },


      refreshAllBookInfo: async (id, isbn13, title) => {
        set({ refreshingIsbn: isbn13, refreshingEbookId: id });
        try {
          // 통합 API 호출
          const result = await fetchBookAvailability(isbn13, title);

          const bookToUpdate = get().myLibraryBooks.find(b => b.id === id);
          if (!bookToUpdate) return;

          let updatedBook = { ...bookToUpdate };

          // 종이책 재고 업데이트
          if ('availability' in result.gwangju_paper) {
            const paperResult = result.gwangju_paper as GwangjuPaperResult;
            const availability = paperResult.availability ?? [];
            let toechonTotal = 0, toechonAvailable = 0, otherTotal = 0, otherAvailable = 0;
            
            // hasToechonStock 변수 제거 - 상세 정보 수집이 불필요해짐
            
            availability.forEach(item => {
              // "정보 없음" 케이스 필터링 - 의미있는 도서관 정보가 있는 경우만 카운트
              const libraryName = item['소장도서관'];
              if (libraryName === '정보 없음' || libraryName === '알 수 없음' || !libraryName) {
                return; // 이 항목은 카운트하지 않음
              }
              
              const isToechon = libraryName === '퇴촌도서관';
              const isAvailable = item['대출상태'] === '대출가능';
              if (isToechon) { toechonTotal++; if (isAvailable) toechonAvailable++; } 
              else { otherTotal++; if (isAvailable) otherAvailable++; }
            });
            
            updatedBook.toechonStock = { total: toechonTotal, available: toechonAvailable };
            updatedBook.otherStock = { total: otherTotal, available: otherAvailable };
            
            // detailedStockInfo 수집 제거 - 퇴촌도서관 상세페이지 연결 불가로 불필요
            // 성능 최적화를 위해 상세 재고 정보 저장 로직 완전 제거
          }

          // 전자책 정보 업데이트
          const ebookSummary = summarizeEBooks(result.gyeonggi_ebook_education);
          updatedBook.ebookInfo = {
            summary: ebookSummary,
            details: result.gyeonggi_ebook_education,
            lastUpdated: Date.now()
          };

          // 경기도 전자도서관 정보 업데이트
          if (result.gyeonggi_ebook_library) {
            updatedBook.gyeonggiEbookInfo = result.gyeonggi_ebook_library;
            // ISBN 필터링을 데이터 갱신 시점에 수행하여 렌더링 성능 최적화
            updatedBook.filteredGyeonggiEbookInfo = filterGyeonggiEbookByIsbn(updatedBook, result.gyeonggi_ebook_library);
          }

          // 시립도서관 전자책 정보 업데이트
          if (result.sirip_ebook) {
            updatedBook.siripEbookInfo = result.sirip_ebook;
          }

          // DB 저장 시 detailedStockInfo 필드 제외하여 저장공간 절약
          const { id: bookId, detailedStockInfo, ...bookDataForDb } = updatedBook;

          const { error } = await supabase
            .from('user_library')
            .update({
              title: updatedBook.title,
              author: updatedBook.author,
              book_data: bookDataForDb as Json
            })
            .eq('id', id);

          if (error) throw error;

          set(state => ({
            myLibraryBooks: state.myLibraryBooks.map(book =>
              book.id === id ? updatedBook : book
            ),
            selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id ? updatedBook : state.selectedBook
          }));
        } catch (error) {
          console.error(`Failed to refresh all book info for ${title}`, error);
          useUIStore.getState().setNotification({ message: '도서 정보 갱신에 실패했습니다.', type: 'error' });
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
        const book = get().myLibraryBooks.find(b => b.id === id);
        if (!book) return;
        const currentTags = book.customTags || [];
        if (currentTags.includes(tagId)) return;
        await updateBookInStoreAndDB(id, { customTags: [...currentTags, tagId] }, '태그 추가에 실패했습니다.');
      },
      removeTagFromBook: async (id, tagId) => {
        const book = get().myLibraryBooks.find(b => b.id === id);
        if (!book) return;
        const updatedTags = (book.customTags || []).filter(t => t !== tagId);
        await updateBookInStoreAndDB(id, { customTags: updatedTags }, '태그 제거에 실패했습니다.');
      },

      updateBookTags: async (id, tagIds) => {
        await updateBookInStoreAndDB(id, { customTags: tagIds }, '태그 업데이트에 실패했습니다.');
      },

      updateMultipleBookTags: async (bookUpdates) => {
        const { myLibraryBooks } = get();

        // 1. 낙관적 업데이트: UI 상태를 먼저 업데이트
        const updatedBooks = new Map<number, SelectedBook>();
        bookUpdates.forEach(({ id, tagIds }) => {
          const book = myLibraryBooks.find(b => b.id === id);
          if (book) {
            updatedBooks.set(id, { ...book, customTags: tagIds });
          }
        });

        useBookStore.setState(state => ({
          myLibraryBooks: state.myLibraryBooks.map(book =>
            updatedBooks.has(book.id) ? updatedBooks.get(book.id)! : book
          )
        }));

        // 2. 배치 DB 업데이트 (병렬 처리)
        const updatePromises = bookUpdates.map(async ({ id, tagIds }) => {
          const book = myLibraryBooks.find(b => b.id === id);
          if (!book) return { success: false, id, error: 'Book not found' };

          try {
            const updatedBookData = { ...book, customTags: tagIds };
            const { id: bookId, detailedStockInfo, ...bookDataForDb } = updatedBookData;
            const { error } = await supabase
              .from('user_library')
              .update({
                title: updatedBookData.title,
                author: updatedBookData.author,
                book_data: bookDataForDb as Json
              })
              .eq('id', id);

            if (error) throw error;
            return { success: true, id };
          } catch (error) {
            console.error(`Failed to update book ${id}:`, error);
            return { success: false, id, error };
          }
        });

        // 3. 결과 처리
        const results = await Promise.allSettled(updatePromises);
        const failures: number[] = [];

        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && !result.value.success) {
            failures.push(result.value.id);
          } else if (result.status === 'rejected') {
            failures.push(bookUpdates[index].id);
          }
        });

        // 4. 실패한 항목들 롤백
        if (failures.length > 0) {
          const originalBooks = new Map<number, SelectedBook>();
          failures.forEach(id => {
            const originalBook = myLibraryBooks.find(b => b.id === id);
            if (originalBook) {
              originalBooks.set(id, originalBook);
            }
          });

          useBookStore.setState(state => ({
            myLibraryBooks: state.myLibraryBooks.map(book =>
              originalBooks.has(book.id) ? originalBooks.get(book.id)! : book
            )
          }));

          useUIStore.getState().setNotification({
            message: `${failures.length}개 책의 태그 업데이트에 실패했습니다. 변경사항이 저장되지 않았을 수 있습니다.`,
            type: 'error',
          });
        }

        return {
          success: bookUpdates.length - failures.length,
          failed: failures.length,
          failures
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
    })
);
