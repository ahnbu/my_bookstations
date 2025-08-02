
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { AladdinBookItem, SelectedBook, SortKey, ReadStatus, BookData, Json } from '../types';
import { searchAladinBooks } from '../services/aladin.service';
import { fetchLibraryStock as fetchLibraryStockService } from '../services/library.service';
import { useUIStore } from './useUIStore';
import { useAuthStore } from './useAuthStore';


interface BookState {
  searchResults: AladdinBookItem[];
  selectedBook: AladdinBookItem | SelectedBook | null;
  myLibraryBooks: SelectedBook[];
  sortConfig: { key: SortKey; order: 'asc' | 'desc' };
  refreshingIsbn: string | null;

  // Actions
  searchBooks: (query: string, searchType: string) => Promise<void>;
  selectBook: (book: AladdinBookItem | SelectedBook) => void;
  unselectBook: () => void;
  addToLibrary: () => Promise<void>;
  removeFromLibrary: (id: number) => Promise<void>;
  refreshStock: (id: number, isbn13: string) => Promise<void>;
  sortLibrary: (key: SortKey) => void;
  exportToCSV: (books: SelectedBook[]) => void;
  fetchUserLibrary: () => Promise<void>;
  clearLibrary: () => void;
  updateReadStatus: (id: number, status: ReadStatus) => Promise<void>;
  updateRating: (id: number, rating: number) => Promise<void>;
}

const escapeCsvField = (field: string | number | undefined): string => {
    const stringField = String(field ?? '');
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
};

export const useBookStore = create<BookState>(
    (set, get) => ({
      // State
      searchResults: [],
      selectedBook: null,
      myLibraryBooks: [],
      sortConfig: { key: 'addedDate', order: 'desc' },
      refreshingIsbn: null,

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
        } catch (error) {
            console.error('Error fetching user library:', error);
            setNotification({ message: '서재 정보를 불러오는 데 실패했습니다.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
      },

      clearLibrary: () => {
        set({ myLibraryBooks: [], selectedBook: null });
      },
      
      searchBooks: async (query, searchType) => {
        const { setIsLoading, setNotification, openBookModal } = useUIStore.getState();
        setIsLoading(true);
        set({ selectedBook: null });
        try {
          const results = await searchAladinBooks(query, searchType);
          // [세트] 로 시작하는 도서 제외
          const filteredResults = results.filter(book => !book.title.startsWith('[세트]'));
          set({ searchResults: filteredResults });
          openBookModal();
        } catch (error) {
          console.error(error);
          setNotification({ message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.', type: 'error' });
          set({ searchResults: [] });
        } finally {
          setIsLoading(false);
        }
      },
      
      selectBook: (book) => {
        set({ selectedBook: book });
        useUIStore.getState().closeBookModal();
        // Scroll to the top to see the details view
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },

      unselectBook: () => {
        set({ selectedBook: null });
      },

      addToLibrary: async () => {
        const { selectedBook } = get();
        const { session } = useAuthStore.getState();
        if (!selectedBook || !session) return;

        const newBookData: BookData = {
          ...selectedBook,
          addedDate: Date.now(),
          toechonStock: { total: 0, available: 0 },
          otherStock: { total: 0, available: 0 },
          readStatus: '읽지 않음' as ReadStatus,
          rating: 0
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
            
            // After adding, trigger a background stock refresh.
            get().refreshStock(newBookWithId.id, newBookWithId.isbn13);

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
      
      refreshStock: async (id, isbn13) => {
        set({ refreshingIsbn: isbn13 });
        try {
          const result = await fetchLibraryStockService(isbn13);
          const availability = result.availability ?? [];
          let toechonTotal = 0, toechonAvailable = 0, otherTotal = 0, otherAvailable = 0;
          availability.forEach(item => {
            const isToechon = item['소장도서관'] === '퇴촌도서관';
            const isAvailable = item['대출상태'] === '대출가능';
            if (isToechon) { toechonTotal++; if (isAvailable) toechonAvailable++; } 
            else { otherTotal++; if (isAvailable) otherAvailable++; }
          });
          
          const bookToUpdate = get().myLibraryBooks.find(b => b.id === id);
          if(!bookToUpdate) return;

          const newStockData = {
            toechonStock: { total: toechonTotal, available: toechonAvailable },
            otherStock: { total: otherTotal, available: otherAvailable }
          };
          const updatedBook = { ...bookToUpdate, ...newStockData };
          
          const { id: bookId, ...bookDataForDb } = updatedBook; // Exclude id for jsonb
          
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
          console.error(`Failed to refresh stock for ISBN ${isbn13}`, error);
          useUIStore.getState().setNotification({ message: '재고 정보 갱신에 실패했습니다.', type: 'error' });
        } finally {
          set({ refreshingIsbn: null });
        }
      },

      updateReadStatus: async (id, status) => {
        const bookToUpdate = get().myLibraryBooks.find(b => b.id === id);
        if(!bookToUpdate) return;

        const updatedBook = { ...bookToUpdate, readStatus: status };
        const { id: bookId, ...bookDataForDb } = updatedBook;

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
        const { id: bookId, ...bookDataForDb } = updatedBook;

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

      exportToCSV: (books) => {
        if (books.length === 0) return;
        
        const headers = ['Title', 'Author', 'Publisher', 'PublicationDate', 'ISBN13', 'PriceStandard', 'PriceSales', 'ReadStatus', 'Rating', 'EbookAvailable', 'EbookLink', 'Link', 'ToechonStockTotal', 'OtherStockTotal', 'AddedDate'];
        const rows = books.map(book => {
          const ebookAvailable = (book.subInfo?.ebookList && book.subInfo.ebookList.length > 0) ? 'Yes' : 'No';
          const ebookLink = book.subInfo?.ebookList?.[0]?.link ?? '';
          const addedDate = new Date(book.addedDate).toISOString().split('T')[0];
          return [
            escapeCsvField(book.title), 
            escapeCsvField(book.author), 
            escapeCsvField(book.publisher), 
            escapeCsvField(book.pubDate.split(' ')[0]), 
            `="${book.isbn13}"`, 
            escapeCsvField(book.priceStandard), 
            escapeCsvField(book.priceSales),
            escapeCsvField(book.readStatus),
            escapeCsvField(book.rating),
            escapeCsvField(ebookAvailable), 
            escapeCsvField(ebookLink), 
            escapeCsvField(book.link), 
            escapeCsvField(book.toechonStock.total), 
            escapeCsvField(book.otherStock.total), 
            escapeCsvField(addedDate)
        ].join(',');
        });
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `my_library.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
    })
);
