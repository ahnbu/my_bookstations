
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { AladdinBookItem, SelectedBook, SortKey, ReadStatus, BookData, Json, EBookInfo, StockInfo } from '../types';
import { searchAladinBooks } from '../services/aladin.service';
import { fetchBookAvailability, summarizeEBooks, GwangjuPaperResult } from '../services/unifiedLibrary.service';
import { filterGyeonggiEbookByIsbn } from '../utils/isbnMatcher';
import { useUIStore } from './useUIStore';
import { useAuthStore } from './useAuthStore';


interface BookState {
  searchResults: AladdinBookItem[];
  selectedBook: AladdinBookItem | SelectedBook | null;
  myLibraryBooks: SelectedBook[];
  sortConfig: { key: SortKey; order: 'asc' | 'desc' };
  refreshingIsbn: string | null;
  refreshingEbookId: number | null;
  librarySearchQuery: string;

  // Actions
  searchBooks: (query: string, searchType: string) => Promise<void>;
  selectBook: (book: AladdinBookItem | SelectedBook, options?: { scroll?: boolean }) => void;
  unselectBook: () => void;
  addToLibrary: () => Promise<void>;
  removeFromLibrary: (id: number) => Promise<void>;
  refreshEBookInfo: (id: number, isbn: string, title: string) => Promise<void>;
  refreshAllBookInfo: (id: number, isbn13: string, title: string) => Promise<void>;
  sortLibrary: (key: SortKey) => void;
  fetchUserLibrary: () => Promise<void>;
  clearLibrary: () => void;
  updateReadStatus: (id: number, status: ReadStatus) => Promise<void>;
  updateRating: (id: number, rating: number) => Promise<void>;
  updateMissingEbookIsbn13: () => Promise<void>;
  setLibrarySearchQuery: (query: string) => void;
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

      // Actions
      fetchUserLibrary: async () => {
        const { session } = useAuthStore.getState();
        if (!session) return;
        
        const { setIsLoading, setNotification } = useUIStore.getState();
        setIsLoading(true);

        try {
            const { data, error } = await supabase
                .from('user_library')
                .select('id, book_data')
                .order('created_at', { ascending: false });

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

            set({ myLibraryBooks: libraryBooks });
            // 자동 전자책 정보 업데이트 제거 - 사용자가 명시적으로 요청할 때만 실행
            // get().updateMissingEbookIsbn13();
        } catch (error) {
            console.error('Error fetching user library:', error);
            setNotification({ message: '서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
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
                  .update({ book_data: bookDataForDb as Json })
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
        const { setIsLoading, setNotification, openBookSearchListModal } = useUIStore.getState();
        setIsLoading(true);
        set({ selectedBook: null });
        try {
          const results = await searchAladinBooks(query, searchType);
          // [세트] 로 시작하는 도서 제외
          const filteredResults = results.filter(book => !book.title.startsWith('[세트]'));
          set({ searchResults: filteredResults });
          openBookSearchListModal();
        } catch (error) {
          console.error(error);
          setNotification({ message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.', type: 'error' });
          set({ searchResults: [] });
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
          // subInfo가 selectedBook에 있다면 명시적으로 포함
          ...(selectedBook.subInfo && { subInfo: selectedBook.subInfo }),
        };
        
        try {
            const { data, error } = await supabase
                .from('user_library')
                .insert([{ user_id: session.user.id, book_data: newBookData as Json }])
                .select('id, book_data')
                .single();
            
            if (error) throw error;
            if (!data || !data.book_data) throw new Error("Failed to add book: No data returned.");

            const newBookWithId: SelectedBook = {
                ...(data.book_data as BookData),
                id: data.id,
            };

            set(state => ({
                myLibraryBooks: [newBookWithId, ...state.myLibraryBooks]
            }));
            
            // 책 추가 성공 후 모달 닫기 및 선택된 책 초기화
            useUIStore.getState().closeBookSearchListModal();
            set({ selectedBook: null });
            
            // 비동기 백그라운드 재고 조회 실행 (환경별 지연 시간 적용)
            const delay = window.location.hostname === 'localhost' ? 100 : 800;
            setTimeout(() => {
                get().refreshAllBookInfo(newBookWithId.id, newBookWithId.isbn13, newBookWithId.title);
            }, delay);

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
            .update({ book_data: bookDataForDb as Json })
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
            .update({ book_data: bookDataForDb as Json })
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
        const bookToUpdate = get().myLibraryBooks.find(b => b.id === id);
        if(!bookToUpdate) return;

        const updatedBook = { ...bookToUpdate, readStatus: status };
        // DB 저장 시 detailedStockInfo 필드 제외하여 저장공간 절약
        const { id: bookId, detailedStockInfo, ...bookDataForDb } = updatedBook;

        try {
            const { error } = await supabase
                .from('user_library')
                .update({ book_data: bookDataForDb as Json })
                .eq('id', id);

            if (error) throw error;
            set(state => ({
                myLibraryBooks: state.myLibraryBooks.map(b => b.id === id ? updatedBook : b),
                selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id ? updatedBook : state.selectedBook
            }));
        } catch (error) {
            console.error('Error updating read status:', error);
            useUIStore.getState().setNotification({ message: '읽음 상태 변경에 실패했습니다.', type: 'error' });
        }
      },

      updateRating: async (id, rating) => {
        const bookToUpdate = get().myLibraryBooks.find(b => b.id === id);
        if(!bookToUpdate) return;
        
        const updatedBook = { ...bookToUpdate, rating };
        // DB 저장 시 detailedStockInfo 필드 제외하여 저장공간 절약
        const { id: bookId, detailedStockInfo, ...bookDataForDb } = updatedBook;

        try {
            const { error } = await supabase
                .from('user_library')
                .update({ book_data: bookDataForDb as Json })
                .eq('id', id);

            if (error) throw error;
            set(state => ({
                myLibraryBooks: state.myLibraryBooks.map(b => b.id === id ? updatedBook : b),
                selectedBook: state.selectedBook && 'id' in state.selectedBook && state.selectedBook.id === id ? updatedBook : state.selectedBook
            }));
        } catch (error) {
            console.error('Error updating rating:', error);
            useUIStore.getState().setNotification({ message: '별점 변경에 실패했습니다.', type: 'error' });
        }
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
    })
);
