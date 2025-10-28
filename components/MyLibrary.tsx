import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { SelectedBook, SortKey, ReadStatus, CustomTag, LibraryName, TagColor, ViewType } from '../types';
import { TrashIcon, RefreshIcon, CheckIcon, SearchIcon, CloseIcon, HeartIcon, MessageSquareIcon } from './Icons';
import Spinner from './Spinner';
import { useBookStore } from '../stores/useBookStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import StarRating from './StarRating';
import MyLibraryBookDetailModal from './MyLibraryBookDetailModal';
import TagFilter from './TagFilter';
import CustomTagComponent from './CustomTag';
import { addHomeResetListener } from '../utils/events';
import MyLibraryListItem from './MyLibraryListItem'; // ✅ 새로 만든 컴포넌트 import
import MyLibraryToolbar from './MyLibraryToolbar';   // ✅ 새로 추가

// [핵심 수정] import 문 정리
import { 
    createLibraryOpenURL,
    processGyeonggiEbookEduTitle, // createOptimalSearchTitle 대신 이 함수를 import
} from '../services/unifiedLibrary.service';

// [핵심 수정] createSearchSubject 정의 변경
const createSearchSubject = processGyeonggiEbookEduTitle;

// Bulk Tag Management Modal Component
interface BulkTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBooks: SelectedBook[];
  availableTags: CustomTag[];
  onAddTag: (bookId: number, tagId: string) => Promise<void>;
  onRemoveTag: (bookId: number, tagId: string) => Promise<void>;
  onUpdateMultipleBookTags: (bookUpdates: Array<{id: number, tagIds: string[]}>) => Promise<void>;
  onClearSelection: () => void;
}

const BulkTagModal: React.FC<BulkTagModalProps> = ({
  isOpen,
  onClose,
  selectedBooks,
  availableTags,
  onAddTag,
  onRemoveTag,
  onUpdateMultipleBookTags,
  onClearSelection
}) => {
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    currentOperation?: string;
    startTime?: number;
  }>({ current: 0, total: 0 });

  // 모든 선택된 책에 공통으로 적용된 태그들 찾기
  const commonTags = useMemo(() => {
    if (selectedBooks.length === 0) return new Set<string>();

    const firstBookTags = new Set(selectedBooks[0].customTags || []);
    return selectedBooks.slice(1).reduce((common, book) => {
      const bookTags = new Set(book.customTags || []);
      return new Set([...common].filter(tagId => bookTags.has(tagId)));
    }, firstBookTags);
  }, [selectedBooks]);

  const handleTagClick = (tagId: string) => {
    const newSelection = new Set(selectedTagIds);
    if (newSelection.has(tagId)) {
      newSelection.delete(tagId);
    } else {
      newSelection.add(tagId);
    }
    setSelectedTagIds(newSelection);
  };

  const handleApplyTags = async () => {
    if (selectedTagIds.size === 0) return;

    setProcessing(true);

    // 책별로 추가할 태그들을 계산하고 배치 업데이트 데이터 준비
    const bookUpdates = selectedBooks
      .map(book => {
        const currentTags = book.customTags || [];
        const newTags = Array.from(selectedTagIds).filter(tagId => !currentTags.includes(tagId));
        if (newTags.length > 0) {
          return {
            id: book.id,
            tagIds: [...currentTags, ...newTags],
            title: book.title
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{id: number, tagIds: string[], title: string}>;

    if (bookUpdates.length === 0) {
      setProcessing(false);
      return;
    }

    // 청킹 설정 (50개씩 처리)
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < bookUpdates.length; i += CHUNK_SIZE) {
      chunks.push(bookUpdates.slice(i, i + CHUNK_SIZE));
    }

    setProgress({
      current: 0,
      total: bookUpdates.length,
      startTime: Date.now(),
      currentOperation: '태그 추가 준비 중...'
    });

    try {
      let processedCount = 0;

      // 청크별로 배치 처리
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];

        setProgress(prev => ({
          ...prev,
          currentOperation: `배치 ${chunkIndex + 1}/${chunks.length} 처리 중... (${chunk.length}권)`
        }));

        // 배치 업데이트 실행
        const chunkUpdates = chunk.map(({ id, tagIds }) => ({ id, tagIds }));
        await onUpdateMultipleBookTags(chunkUpdates);

        processedCount += chunk.length;
        setProgress(prev => ({
          ...prev,
          current: processedCount
        }));

        // 서버 부하 방지를 위한 짧은 대기 (마지막 청크 제외)
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setProgress(prev => ({
        ...prev,
        currentOperation: `완료! ${processedCount}권의 책에 태그가 추가되었습니다.`
      }));

      // 잠시 완료 상태를 보여준 후 모달 닫기
      setTimeout(() => {
        onClearSelection();
      }, 900);
    } catch (error) {
      console.error('일괄 태그 적용 실패:', error);
      setProgress(prev => ({
        ...prev,
        currentOperation: '오류가 발생했습니다. 일부 변경사항이 저장되지 않았을 수 있습니다.'
      }));
    } finally {
      setTimeout(() => {
        setProcessing(false);
        setProgress({ current: 0, total: 0 });
      }, 1500);
    }
  };

  const handleRemoveCommonTag = async (tagId: string) => {
    setProcessing(true);

    // 태그를 제거할 책들 계산하고 배치 업데이트 데이터 준비
    const booksToUpdate = selectedBooks
      .filter(book => book.customTags?.includes(tagId))
      .map(book => ({
        id: book.id,
        tagIds: (book.customTags || []).filter(t => t !== tagId),
        title: book.title
      }));

    const tagName = availableTags.find(tag => tag.id === tagId)?.name || '태그';

    if (booksToUpdate.length === 0) {
      setProcessing(false);
      return;
    }

    // 청킹 설정 (50개씩 처리)
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < booksToUpdate.length; i += CHUNK_SIZE) {
      chunks.push(booksToUpdate.slice(i, i + CHUNK_SIZE));
    }

    setProgress({
      current: 0,
      total: booksToUpdate.length,
      startTime: Date.now(),
      currentOperation: `"${tagName}" 태그 제거 준비 중...`
    });

    try {
      let processedCount = 0;

      // 청크별로 배치 처리
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];

        setProgress(prev => ({
          ...prev,
          currentOperation: `배치 ${chunkIndex + 1}/${chunks.length}에서 "${tagName}" 태그 제거 중... (${chunk.length}권)`
        }));

        // 배치 업데이트 실행
        const chunkUpdates = chunk.map(({ id, tagIds }) => ({ id, tagIds }));
        await onUpdateMultipleBookTags(chunkUpdates);

        processedCount += chunk.length;
        setProgress(prev => ({
          ...prev,
          current: processedCount
        }));

        // 서버 부하 방지를 위한 짧은 대기 (마지막 청크 제외)
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setProgress(prev => ({
        ...prev,
        currentOperation: `완료! ${processedCount}권의 책에서 "${tagName}" 태그가 제거되었습니다.`
      }));

      // // 잠시 완료 상태를 보여준 후
      // setTimeout(() => {
      //   setProgress({ current: 0, total: 0 });
      // }, 1000);
      
      // [핵심 수정] 태그 추가와 동일하게, 성공 후 모달을 닫고 선택 해제
      setTimeout(() => {
          onClearSelection();
      }, 900); // 1초 후 실행하여 사용자에게 완료 메시지를 보여줄 시간을 줌

    } catch (error) {
      console.error('공통 태그 제거 실패:', error);
      setProgress(prev => ({
        ...prev,
        currentOperation: '오류가 발생했습니다. 일부 변경사항이 저장되지 않았을 수 있습니다.'
      }));
    } finally {
      setTimeout(() => {
        setProcessing(false);
        setProgress({ current: 0, total: 0 });
      }, 1500);
    }
  };

  if (!isOpen) return null;

    // ✅ [추가] 선택된 태그의 이름 목록을 생성하는 로직
  const selectedTagNames = Array.from(selectedTagIds)
    .map(id => availableTags.find(tag => tag.id === id)?.name) // ID에 해당하는 태그 객체를 찾아 이름(name)을 추출
    .filter(Boolean) // 혹시 모를 undefined 값을 제거
    .join(', '); // 이름들을 ", "로 연결하여 하나의 문자열로 만듦

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-elevated rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-primary">
          <h2 className="text-xl font-bold text-primary">일괄 태그 관리</h2>
          <button onClick={onClose} className="text-secondary hover:text-primary">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* 선택된 책 정보 */}
            <div>
              <h3 className="text-lg font-semibold text-primary mb-3">
                선택된 책 ({selectedBooks.length}권)
              </h3>
              <div className="max-h-32 overflow-y-auto bg-secondary rounded-md p-3">
                {selectedBooks.map(book => (
                  <div key={book.id} className="text-sm text-secondary mb-1">
                    {book.title.replace(/^\[\w+\]\s*/, '')}
                  </div>
                ))}
              </div>
            </div>

            {/* 공통 태그 */}
            {commonTags.size > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-primary mb-3">
                  모든 책에 적용된 태그
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from(commonTags).map(tagId => {
                    const tag = availableTags.find(t => t.id === tagId);
                    return tag ? (
                      <div key={tag.id} className="flex items-center gap-2">
                        <CustomTagComponent tag={tag} isActive={false} onClick={() => {}} size="sm" />
                        <button
                          onClick={() => handleRemoveCommonTag(tag.id)}
                          disabled={processing}
                          className="text-red-500 hover:text-red-600 text-sm"
                          title="모든 책에서 제거"
                        >
                          ✕
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* 태그 추가 */}
            <div>
              <h3 className="text-lg font-semibold text-primary mb-3">
                추가할 태그 선택
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {availableTags.map(tag => (
                  <CustomTagComponent
                    key={tag.id}
                    tag={tag}
                    isActive={selectedTagIds.has(tag.id)}
                    onClick={() => handleTagClick(tag.id)}
                    size="sm"
                  />
                ))}
              </div>
              {selectedTagIds.size > 0 && (
                // ✅ [수정] 원하는 메시지 형식으로 변경
                <div className="text-sm text-secondary mb-4">
                  {selectedBooks.length}권의 책에 다음 태그를 추가합니다 :{' '}
                  <span className="font-medium text-primary">{selectedTagNames}</span>
                </div>
              )}
              {/* {selectedTagIds.size > 0 && (
                <div className="text-sm text-secondary mb-4">
                  {selectedTagIds.size}개 태그를 {selectedBooks.length}권의 책에 추가합니다.
                </div>
              )} */}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {processing && progress.total > 0 && (
          <div className="px-6 pb-4">
            <div className="bg-secondary rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-primary font-medium">
                  {progress.currentOperation || '처리 중...'}
                </span>
                <span className="text-secondary">
                  {progress.current}/{progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-tertiary rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>

              {/* Estimated time */}
              {progress.startTime && progress.current > 0 && (
                <div className="text-xs text-secondary">
                  {(() => {
                    const elapsed = Date.now() - progress.startTime;
                    const avgTimePerItem = elapsed / progress.current;
                    const remainingItems = progress.total - progress.current;
                    const estimatedRemaining = Math.round((avgTimePerItem * remainingItems) / 1000);

                    if (estimatedRemaining > 60) {
                      return `예상 완료까지 약 ${Math.round(estimatedRemaining / 60)}분 ${estimatedRemaining % 60}초`;
                    } else {
                      return `예상 완료까지 약 ${estimatedRemaining}초`;
                    }
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 p-4 border-t border-primary">
          <button
            onClick={onClose}
            disabled={processing}
            className="btn-base btn-secondary flex-1"
          >
            취소
          </button>
          <button
            onClick={handleApplyTags}
            disabled={processing || selectedTagIds.size === 0}
            className="btn-base btn-primary flex-1"
          >
            {processing ? '적용 중...' : `선택된 태그 적용 (${selectedTagIds.size}개)`}
          </button>
        </div>
      </div>
    </div>
  );
};

const MyLibrary: React.FC = () => {
  const { session } = useAuthStore();
  const { settings } = useSettingsStore();
  const {
    myLibraryBooks,
    sortConfig,
    sortLibrary,
    removeFromLibrary,
    refreshingIsbn,
    refreshingEbookId,
    refreshBookInfo: refreshAllBookInfo,
    updateReadStatus,
    updateRating,
    librarySearchQuery,
    setLibrarySearchQuery,
    authorFilter,
    setAuthorFilter,
    clearAuthorFilter,
    addTagToBook,
    removeTagFromBook,
    updateMultipleBookTags,
    toggleFavorite,
    updateBookNote,
    setResetLibraryFilters,
    fetchRemainingLibrary,
    isAllBooksLoaded,
    fetchUserLibrary,
    totalBooksCount,
    searchUserLibrary,
    clearLibrarySearch,
    librarySearchResults,
    isSearchingLibrary,
    filterLibraryByTags,
    clearLibraryTagFilter,
    libraryTagFilterResults,
    isFilteringByTag,
    tagCounts,
  } = useBookStore();
  
  // ✅ [추가] 색상 기준으로 정렬된 태그 목록을 미리 계산합니다.
  const sortedAvailableTags = useMemo(() => {
    if (!settings.tagSettings?.tags) return [];
    // 원본 배열을 변경하지 않기 위해 복사본([...])을 만들어 정렬합니다.
    return [...settings.tagSettings.tags].sort((a, b) => {
      const colorOrder: Record<TagColor, number> = { 'primary': 0, 'secondary': 1, 'tertiary': 2 };
      // 정의되지 않은 색상에 대한 예외처리(?? 99) 추가
      return (colorOrder[a.color] ?? 99) - (colorOrder[b.color] ?? 99);
    });
  }, [settings.tagSettings.tags]);

  const [detailModalBookId, setDetailModalBookId] = useState<number | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [gridColumns, setGridColumns] = useState(5);
  const [backgroundRefreshComplete, setBackgroundRefreshComplete] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false);
  const [showAllBooks, setShowAllBooks] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteInputValue, setNoteInputValue] = useState('');



  // ✅ [수정] 초기 상태를 settings 값에서 가져오도록 변경
  const [viewType, setViewType] = useState<ViewType>(settings.defaultViewType || 'card');
  // const [activeTags, setActiveTags] = useState<Set<string>>(new Set(settings.defaultFilterTagIds || []));
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set((settings.defaultFilterTagIds as string[]) || []));
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(settings.defaultFilterFavorites || false);
  
  // ✅ '전체 선택'과 '선택 삭제'를 위한 핸들러 함수를 정의합니다.
  const handleSelectAllChange = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedBooks(new Set(sortedAndFilteredLibraryBooks.map(book => book.id)));
    } else {
      setSelectedBooks(new Set());
    }
  };

  const handleDeleteSelected = () => {
    if (selectedBooks.size > 0 && window.confirm(`선택된 ${selectedBooks.size}권의 책을 삭제하시겠습니까?`)) {
      selectedBooks.forEach(bookId => removeFromLibrary(bookId));
      setSelectedBooks(new Set());
      setSelectAll(false);
    }
  };

  // 좋아요 필터  
  const handleToggleFavoritesFilter = () => {
    setShowFavoritesOnly(prev => !prev);
  };

  // 필터 리셋 함수
  // ✅ [수정] 필터 리셋 함수: 이제 로컬 상태만 기본값으로 되돌립니다.
  const resetLibraryFilters = useCallback(() => {
    setDebouncedSearchQuery('');
    clearAuthorFilter();
    clearLibrarySearch();

    const { defaultFilterFavorites, defaultFilterTagIds } = settings;
    setShowFavoritesOnly(defaultFilterFavorites);
    setActiveTags(new Set((defaultFilterTagIds as string[]) || []));
  }, [clearAuthorFilter, settings, clearLibrarySearch]);

  //   setActiveTags(new Set<string>()); 
  //   setShowFavoritesOnly(false);
  // }, [clearAuthorFilter]);

  // 전체 내 서재 상태 리셋 함수 (홈 리셋용) - 성능 최적화
  const resetAllLibraryStates = useCallback(() => {
    fetchUserLibrary();

    // 검색 관련 상태 초기화
    setLibrarySearchQuery('');
    clearLibrarySearch();
    clearLibraryTagFilter();

    // 로컬 상태 리셋 (배치 업데이트)
    setDebouncedSearchQuery('');
    // setActiveTags(new Set());
    setActiveTags(new Set<string>());
    setShowFavoritesOnly(false);
    setShowAllBooks(false);
    setSelectedBooks(new Set());
    setSelectAll(false);
    setBulkTagModalOpen(false);
    setEditingNoteId(null);
    setNoteInputValue('');
  // }, []); // 의존성 배열을 비워서 함수 재생성 방지
  }, [fetchUserLibrary, setLibrarySearchQuery, clearLibrarySearch, clearLibraryTagFilter]); // fetchUserLibrary를 의존성 배열에 추가

  // 메모 편집 관련 함수들
  const handleNoteEdit = useCallback((bookId: number, currentNote: string = '') => {
    setEditingNoteId(bookId);
    setNoteInputValue(currentNote);
  }, []);

  const handleNoteSave = useCallback(async (bookId: number) => {
    try {
      await updateBookNote(bookId, noteInputValue);
      setEditingNoteId(null);
      setNoteInputValue('');
    } catch (error) {
      console.error('메모 저장 실패:', error);
    }
  }, [noteInputValue, updateBookNote]);

  const handleNoteCancel = useCallback(() => {
    setEditingNoteId(null);
    setNoteInputValue('');
  }, []);

  const handleNoteKeyDown = useCallback((e: React.KeyboardEvent, bookId: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNoteSave(bookId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleNoteCancel();
    }
  }, [handleNoteSave, handleNoteCancel]);

  // MyLibrary 컴포넌트 내부 최상단 (useState 훅들 아래)
const handleBookSelection = useCallback((bookId: number, isSelected: boolean) => {
  setSelectedBooks(prev => {
    const newSelection = new Set(prev);
    if (isSelected) {
      newSelection.add(bookId);
    } else {
      newSelection.delete(bookId);
    }
    return newSelection;
  });
}, []); // 의존성 배열이 비어있으므로 이 함수는 단 한 번만 생성됩니다.


  // ✅ 초기 화면 세팅
    // ✅ [핵심 수정 1] settings 동기화 useEffect: 로컬 상태만 업데이트
  useEffect(() => {
    const { defaultViewType, defaultFilterFavorites, defaultFilterTagIds } = settings;

    setViewType(defaultViewType || 'card');
    setShowFavoritesOnly(defaultFilterFavorites || false);
    setActiveTags(new Set((defaultFilterTagIds as string[]) || []));
  }, [settings]);


  // ✅ [핵심 수정 2] 데이터 로딩 useEffect: 로컬 필터 상태 변경 시 RPC 호출
  useEffect(() => {
    const tagsToFilter = Array.from(activeTags);

    // 검색어가 있으면 서버 필터링을 하지 않음 (검색이 우선)
    if (debouncedSearchQuery.trim().length >= 2) {
      clearLibraryTagFilter(); // 기존 필터 결과는 지워줌
      return;
    }
    
    // '좋아요' 또는 '태그' 필터 중 하나라도 활성화되어 있으면 RPC 호출
    if (tagsToFilter.length > 0 || showFavoritesOnly) {
      filterLibraryByTags(tagsToFilter, showFavoritesOnly);
    } else {
      // 모든 필터가 비활성화되면 필터 결과 목록을 비움
      clearLibraryTagFilter();
    }
  }, [activeTags, showFavoritesOnly, debouncedSearchQuery, filterLibraryByTags, clearLibraryTagFilter]);


  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(librarySearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [librarySearchQuery]);

  // Server search trigger
  useEffect(() => {
    if (debouncedSearchQuery.trim().length >= 2) {
      searchUserLibrary(debouncedSearchQuery);
    } else {
      clearLibrarySearch();
    }
  }, [debouncedSearchQuery, searchUserLibrary, clearLibrarySearch]);

  // ================== ✅ 여기까지 추가 ==================

  // 필터 리셋 함수를 store에 등록
  useEffect(() => {
    setResetLibraryFilters(resetLibraryFilters);
    return () => setResetLibraryFilters(undefined);
  }, [resetLibraryFilters, setResetLibraryFilters]);

  // 홈 리셋 이벤트 구독 - 성능 최적화: 한 번만 등록
  useEffect(() => {
    const cleanup = addHomeResetListener(() => {
      resetAllLibraryStates();
    });

    return cleanup;
  }, []); // 빈 의존성 배열로 이벤트 리스너 재등록 방지

  // Responsive grid columns (optimized for max-w-4xl container)
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) setGridColumns(2);        // 모바일: 2개 (~320px/카드)
      else if (width < 768) setGridColumns(3);   // 태블릿: 3개 (~256px/카드)
      else if (width < 1024) setGridColumns(3);  // 소형 데스크톱: 3개 (~298px/카드)
      else setGridColumns(4);                    // 중형 이상: 4개 (~224px/카드)
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);
  
  // Sort options mapping
  const sortOptions: Record<SortKey, string> = {
    addedDate: '추가순',
    title: '제목순',
    author: '저자순',
    pubDate: '출간일순',
    rating: '별점순',
    readStatus: '읽음순'
  };
  
  // Get current sort display name
  const getCurrentSortName = () => {
    return sortOptions[sortConfig.key] || '정렬';
  };

  // Tag filtering handlers
  // ✅ [수정] 태그 클릭 핸들러: 이제 로컬 상태만 변경합니다.
  const handleTagClick = (tagId: string) => {
    setActiveTags(prevTags => {
      const newActiveTags = new Set(prevTags);
      if (newActiveTags.has(tagId)) {
        newActiveTags.delete(tagId);
      } else {
        newActiveTags.add(tagId);
      }
      return newActiveTags;
    });
  };

  const handleClearAllTags = () => {
    setActiveTags(new Set());
  };

  // 그리드 컬럼별 완전한 행을 위한 사전 계산 테이블
  const GRID_PAGE_SIZES = {
    25: { 2: 24, 3: 24, 4: 24 },    // 25 설정시 -> 12행/8행/6행
    50: { 2: 50, 3: 48, 4: 48 },    // 50 설정시 -> 25행/16행/12행
    100: { 2: 100, 3: 99, 4: 100 }, // 100 설정시 -> 50행/33행/25행
    200: { 2: 200, 3: 198, 4: 200 } // 200 설정시 -> 100행/66행/50행
  } as const;

  const getGridPageSize = (pageSize: number, columns: number): number => {
    return GRID_PAGE_SIZES[pageSize as keyof typeof GRID_PAGE_SIZES]?.[columns as keyof typeof GRID_PAGE_SIZES[25]] || pageSize;
  };

  // 필터링 상태 감지 함수
  const hasActiveFilters = useCallback(() => {
    return debouncedSearchQuery.trim().length >= 2 ||
           activeTags.size > 0 ||
           showFavoritesOnly ||
           authorFilter.trim().length > 0;
  }, [debouncedSearchQuery, activeTags, showFavoritesOnly, authorFilter]);

  const sortedAndFilteredLibraryBooks = useMemo(() => {
    const readStatusOrder: Record<ReadStatus, number> = { '완독': 0, '읽는 중': 1, '읽지 않음': 2 };

    // [핵심 수정] 필터 우선순위에 따라 기본 데이터셋 결정
    let filteredBooks: SelectedBook[];

    const hasServerFilters = activeTags.size > 0 || showFavoritesOnly;

    if (debouncedSearchQuery.trim().length >= 2) {
      // 1순위: 텍스트 검색 결과
      filteredBooks = [...librarySearchResults];
    } else if (hasServerFilters) {
      // 2순위: 태그 또는 좋아요 필터 결과 (통합된 결과를 사용)
      filteredBooks = [...libraryTagFilterResults];
    } else {
      // 3순위: 필터 없음 (기본 서재 목록)
      filteredBooks = [...myLibraryBooks];
    }

    // authorFilter와 showFavoritesOnly는 클라이언트 측에서 추가로 필터링
    if (authorFilter.trim()) {
      const authorQuery = authorFilter.toLowerCase().trim();
      filteredBooks = filteredBooks.filter(book =>
        book.author.toLowerCase().includes(authorQuery)
      );
    }

    // if (showFavoritesOnly) {
    //   filteredBooks = filteredBooks.filter(book => book.isFavorite === true);
    // }

    // Then sort the filtered books
    return filteredBooks.sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aVal = a[sortConfig.key as keyof SelectedBook];
        let bVal = b[sortConfig.key as keyof SelectedBook];

        // Handle pubDate for sorting
        if (sortConfig.key === 'pubDate') {
            aVal = new Date(a.pubDate).getTime();
            bVal = new Date(b.pubDate).getTime();
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortConfig.order === 'asc' ? aVal - bVal : bVal - aVal;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
             if (sortConfig.key === 'readStatus') {
                const comparison = readStatusOrder[a.readStatus] - readStatusOrder[b.readStatus];
                return sortConfig.order === 'asc' ? comparison : -comparison;
            }
            const comparison = aVal.localeCompare(bVal, 'ko-KR');
            return sortConfig.order === 'asc' ? comparison : -comparison;
        }
        return 0;
    });
  }, [
    myLibraryBooks, 
    librarySearchResults, 
    libraryTagFilterResults, 
    sortConfig, 
    debouncedSearchQuery, 
    activeTags, 
    showFavoritesOnly, 
    authorFilter
  ]);

  // 페이지네이션이 적용된 표시할 책 목록 계산
  const displayedBooks = useMemo(() => {
    // 필터링이 있거나 전체보기 모드면 모든 책 표시
    if (showAllBooks || hasActiveFilters()) {
      return sortedAndFilteredLibraryBooks;
    }

    const pageSize = settings.defaultPageSize;

    if (viewType === 'grid') {
      // 그리드: 사전 계산된 룩업 테이블 사용
      const actualPageSize = getGridPageSize(pageSize, gridColumns);
      return sortedAndFilteredLibraryBooks.slice(0, actualPageSize);
    } else {
      // 카드뷰: 정확히 pageSize만큼
      return sortedAndFilteredLibraryBooks.slice(0, pageSize);
    }
  }, [sortedAndFilteredLibraryBooks, showAllBooks, hasActiveFilters, viewType, gridColumns, settings.defaultPageSize]);

  const selectedBooksArray = useMemo(() => {
    return displayedBooks.map(book => ({
      ...book,
      isSelected: selectedBooks.has(book.id)
    }));
  }, [displayedBooks, selectedBooks]);

  // Background refresh for books missing detailed stock info - 비활성화
  useEffect(() => {
    // 백그라운드 재고 업데이트 비활성화 - 사용자가 명시적으로 요청할 때만 실행
    setBackgroundRefreshComplete(true);
  }, [myLibraryBooks, backgroundRefreshComplete, refreshAllBookInfo]);


  if (!session) {
    return (
      <div className="mt-12 animate-fade-in text-center text-secondary p-8 bg-elevated rounded-lg shadow-inner">
        <h2 className="text-2xl font-bold mb-4 text-primary">내 서재</h2>
        <p>로그인 후 '내 서재' 기능을 사용해보세요.</p>
        <p className="text-sm mt-2">관심있는 책을 저장하고, 여러 기기에서 확인하세요.</p>
      </div>
    );
  }
  
  if (myLibraryBooks.length === 0) {
    return (
       <div className="mt-12 animate-fade-in text-center text-secondary p-8 bg-elevated rounded-lg shadow-inner">
        <h2 className="text-2xl font-bold mb-4 text-primary">내 서재</h2>
        <p>서재가 비어있습니다.</p><br></br>
        <p className="text-sm mt-2">책을 검색하고 </p>
        <p className="text-sm mt-2">'내 서재에 추가' 버튼을 눌러 관리해보세요.</p>
      </div>
    );
  }

  return (
    <div className="mt-12 animate-fade-in">
      {/* ================= ✅ 아래 코드를 붙여넣으세요 ================= */}
      <MyLibraryToolbar
        searchQuery={librarySearchQuery}
        onSearchQueryChange={setLibrarySearchQuery}
        viewType={viewType}
        onViewTypeChange={setViewType}
        availableTags={sortedAvailableTags}
        activeTags={activeTags}
        onTagClick={handleTagClick}
        onClearAllTags={handleClearAllTags}
        sortConfig={sortConfig}
        onSortChange={sortLibrary}
        selectedBookCount={selectedBooks.size}
        filteredBookCount={sortedAndFilteredLibraryBooks.length}
        totalBookCount={totalBooksCount}
        displayedBookCount={displayedBooks.length}
        isAllBooksShown={showAllBooks}
        hasActiveFilters={hasActiveFilters()}
        selectAllChecked={selectAll}
        onSelectAllChange={handleSelectAllChange}
        onBulkTagManage={() => setBulkTagModalOpen(true)}
        onToggleFavoritesFilter={handleToggleFavoritesFilter}
        isFavoritesFilterActive={showFavoritesOnly}
        onDeleteSelected={handleDeleteSelected}
      />
      {/* ================= ✅ 여기까지 ================= */}
      
      {/* View Type Conditional Rendering */}
      {viewType === 'card' ? (
        /* Card View */
        <div className="space-y-4 max-w-4xl mx-auto">
          {/* ================= ✅ 아래 코드를 붙여넣으세요 ================= */}
          {(isSearchingLibrary || isFilteringByTag ) ? (
            <div className="text-center p-8">
              <Spinner />
              <p className="mt-2 text-secondary">
                  {isSearchingLibrary 
                  ? '서재에서 검색 중입니다...' 
                  : '필터링 중입니다...' // 메시지를 하나로 통일
                }
              </p>
            </div>
          ) : displayedBooks.length === 0 && debouncedSearchQuery.trim().length >= 2 ? (
            <div className="text-center text-secondary p-8 bg-secondary rounded-lg shadow-md">
              <h3 className="text-lg font-medium mb-2">검색 결과가 없습니다</h3>
              <p className="text-sm">'{debouncedSearchQuery}' 에 대한 검색 결과를 찾을 수 없습니다.</p>
              <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
            </div>
          ) : (
            selectedBooksArray.map(book => (
              <MyLibraryListItem
                key={book.id}
                book={book}
                viewType="card"
                refreshingIsbn={refreshingIsbn}
                refreshingEbookId={refreshingEbookId}
                tagCounts={tagCounts}
                editingNoteId={editingNoteId}
                noteInputValue={noteInputValue}
                onSelect={handleBookSelection}
                onRefresh={refreshAllBookInfo}
                onOpenDetail={setDetailModalBookId}
                onToggleFavorite={toggleFavorite}
                onUpdateReadStatus={updateReadStatus}
                onUpdateRating={updateRating}
                onNoteEdit={handleNoteEdit}
                onNoteSave={() => handleNoteSave(book.id)}
                onNoteCancel={handleNoteCancel}
                onNoteChange={setNoteInputValue}
                onNoteKeyDown={(e) => handleNoteKeyDown(e, book.id)}
              />
            ))
          )}
          {/* ================= ✅ 여기까지 ================= */}
        </div>
      ) : (
        /* Grid View */
        <div className="grid gap-4 max-w-4xl mx-auto" style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
          {/* ================= ✅ 아래 코드를 붙여넣으세요 ================= */}
          {(isSearchingLibrary || isFilteringByTag) ? ( // 그리드 뷰에는 isFilteringByFavorites가 빠져있었네요. 필요하면 추가하세요.
            <div className="col-span-full text-center p-8">
              <Spinner />
              <p className="mt-2 text-secondary">
                {isSearchingLibrary ? '서재에서 검색 중입니다...' : '필터링 중입니다...'}
              </p>
            </div>
          ) : displayedBooks.length === 0 && debouncedSearchQuery.trim().length >= 2 ? (
            <div className="col-span-full text-center text-secondary p-8 bg-secondary rounded-lg shadow-md">
              <h3 className="text-lg font-medium mb-2">검색 결과가 없습니다</h3>
              <p className="text-sm">'{debouncedSearchQuery}' 에 대한 검색 결과를 찾을 수 없습니다.</p>
              <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
            </div>
          ) : (
            selectedBooksArray.map(book => (
              <MyLibraryListItem
                key={book.id}
                book={book}
                viewType="grid"
                refreshingIsbn={refreshingIsbn}
                refreshingEbookId={refreshingEbookId}
                tagCounts={tagCounts}
                editingNoteId={editingNoteId}
                noteInputValue={noteInputValue}
                onSelect={handleBookSelection}
                onRefresh={refreshAllBookInfo}
                onOpenDetail={setDetailModalBookId}
                onToggleFavorite={toggleFavorite}
                onUpdateReadStatus={updateReadStatus}
                onUpdateRating={updateRating}
                onNoteEdit={handleNoteEdit}
                onNoteSave={() => handleNoteSave(book.id)}
                onNoteCancel={handleNoteCancel}
                onNoteChange={setNoteInputValue}
                onNoteKeyDown={(e) => handleNoteKeyDown(e, book.id)}
              />
            ))
          )}
          {/* ================= ✅ 여기까지 ================= */}
        </div>
      )}

      {/* View All Button - 필터가 없고 전체보기 모드가 아닐 때만 표시 */}
      {/* {!showAllBooks && !hasActiveFilters() && sortedAndFilteredLibraryBooks.length > displayedBooks.length && ( */}
      {/* 전체보기 버튼 표시 기준 변경: 필터+전체보기x -> 전체보기x 변경 */}
      {!showAllBooks && !hasActiveFilters() && !isAllBooksLoaded && (

        <div className="flex justify-center mt-6">
          <button
            onClick={async () => {
              // DB에서 나머지 책 로드 (아직 전체 로드하지 않았을 경우)
              if (!isAllBooksLoaded) {
                await fetchRemainingLibrary();
              }
              // UI 전체 표시
              setShowAllBooks(true);
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
          >
            <span>전체 보기</span>
            <span className="text-blue-200">
              ({displayedBooks.length}/{totalBooksCount}권)
            </span>
          </button>
        </div>
      )}

      {detailModalBookId && (
        <MyLibraryBookDetailModal
            bookId={detailModalBookId}
            onClose={() => setDetailModalBookId(null)}
        />
      )}

      {/* Bulk Tag Management Modal */}
      {bulkTagModalOpen && (
        <BulkTagModal
          isOpen={bulkTagModalOpen}
          onClose={() => setBulkTagModalOpen(false)}
          // [핵심 수정] myLibraryBooks 대신 sortedAndFilteredLibraryBooks에서 책을 찾도록 변경
          // selectedBooks={Array.from(selectedBooks).map(id => myLibraryBooks.find(book => book.id === id)!).filter(Boolean)}
          selectedBooks={Array.from(selectedBooks).map(id => sortedAndFilteredLibraryBooks.find(book => book.id === id)!).filter(Boolean)}
          availableTags={sortedAvailableTags} // ✅ [수정] 동일하게 정렬된 태그 배열을 prop으로 전달
          // availableTags={settings.tagSettings?.tags || []}
          onAddTag={(bookId, tagId) => addTagToBook(bookId, tagId)}
          onRemoveTag={(bookId, tagId) => removeTagFromBook(bookId, tagId)}
          onUpdateMultipleBookTags={updateMultipleBookTags}
          onClearSelection={() => {
            setSelectedBooks(new Set());
            setSelectAll(false);
            setBulkTagModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default MyLibrary;
