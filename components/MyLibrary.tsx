import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { SelectedBook, SortKey, ReadStatus, CustomTag, LibraryName } from '../types';
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
// [핵심 수정] import 문 정리
import { 
    createLibraryOpenURL,
    processGyeonggiEbookEduTitle, // createOptimalSearchTitle 대신 이 함수를 import
} from '../services/unifiedLibrary.service';

// [핵심 수정] createSearchSubject 정의 변경
const createSearchSubject = processGyeonggiEbookEduTitle;

// --- START: ReadStatusDropdown 로컬 컴포넌트 추가 ---
interface CustomReadStatusDropdownProps {
  value: ReadStatus;
  onChange: (newStatus: ReadStatus) => void;
  size?: 'sm' | 'md';
}

const ReadStatusDropdown: React.FC<CustomReadStatusDropdownProps> = ({
  value,
  onChange,
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const options: ReadStatus[] = ['읽지 않음', '읽는 중', '완독'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const sizeClasses = {
    xs: 'text-xs px-2 py-1',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
  };

  // [핵심 수정] 반응형 너비 클래스를 적용
  const widthClass = size === 'sm' 
    ? 'w-full sm:w-24' // 기본은 w-full, sm(640px) 이상일 때만 w-24
    : ''; // md 사이즈는 너비를 직접 제어하지 않음

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${widthClass}`}>
      <button
        type="button"
        className={`${size === 'sm' ? 'item-dropdown-btn' : 'input-base'} inline-flex ${size === 'sm' ? 'items-center gap-2' : 'w-full justify-between items-center gap-x-1.5'} ${sizeClasses[size]}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {value}
        <svg className={`-mr-1 h-5 w-5 text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-full origin-top-right rounded-md bg-elevated shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`block w-full text-left px-4 py-2 text-sm ${
                  option === value ? 'bg-accent text-primary' : 'text-secondary hover-surface'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
// --- END: ReadStatusDropdown 로컬 컴포넌트 ---

const SortArrow: React.FC<{ order: 'asc' | 'desc' }> = ({ order }) => (
  <span className="ml-1 inline-block w-3 h-3 text-xs">
    {order === 'asc' ? '▲' : '▼'}
  </span>
);

// LibraryTag Component
interface LibraryTagProps {
  name: string;
  totalBooks: number;
  availableBooks: number;
  searchUrl: string;
  size?: 'sm' | 'md';
  isError?: boolean; // [추가]
}

// 2025.10.13 v2- API에러시 퇴촌(에러) -> (빨간점) 퇴촌(0/0)로 표시하도록 수정
const LibraryTag: React.FC<LibraryTagProps> = ({ name, totalBooks, availableBooks, searchUrl, size = 'md', isError = false }) => {
  // - API 실패시: 빨간색 (status-unavailable)
  // - API 성공 & 재고 있으면: 녹색 (status-available)
  // - API 성공 & 재고 없으면: 회색 (status-none)
  const getStatus = () => {
    if (isError) return 'unavailable'; // 빨간색 (기존 unavailable 스타일 재활용)
    if (totalBooks > 0) return 'available'; // 녹색
    return 'none'; // 회색
  };

  const status = getStatus();

  const titleText = isError 
    ? `${name} - 정보 조회 실패 (표시된 정보는 과거 데이터일 수 있음)` 
    : `${name} - 총 ${totalBooks}권 (available_count: ${availableBooks}권)`;

  const displayText = `${name} (${totalBooks}/${availableBooks})`;

  return (
    <a
      href={searchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`library-tag ${size === 'sm' ? 'library-tag-sm' : ''} status-${status} truncate`}
      title={titleText}
    >
      <div className={`status-indicator ${status}`}></div>
      <span>{displayText}</span>
    </a>
  );
};

type ViewType = 'card' | 'grid';

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
                <div className="text-sm text-secondary mb-4">
                  {selectedTagIds.size}개 태그를 {selectedBooks.length}권의 책에 추가합니다.
                </div>
              )}
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
  } = useBookStore();
  
  const [detailModalBookId, setDetailModalBookId] = useState<number | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [viewType, setViewType] = useState<ViewType>('card');
  const [gridColumns, setGridColumns] = useState(5);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const mobileSortDropdownRef = useRef<HTMLDivElement>(null);
  const desktopSortDropdownRef = useRef<HTMLDivElement>(null);
  const [backgroundRefreshComplete, setBackgroundRefreshComplete] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showAllBooks, setShowAllBooks] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteInputValue, setNoteInputValue] = useState('');
  
  // 필터 리셋 함수
  const resetLibraryFilters = useCallback(() => {
    setDebouncedSearchQuery('');
    setActiveTags(new Set());
    setShowFavoritesOnly(false);
    clearAuthorFilter();
    // showAllBooks는 유지 - 사용자가 전체보기를 선택했다면 그 의도 유지
    // setSelectedTagIds는 BulkTagModal 내부 state이므로 여기서 접근하지 않음
  }, [clearAuthorFilter]);

  // 전체 내 서재 상태 리셋 함수 (홈 리셋용) - 성능 최적화
  const resetAllLibraryStates = useCallback(() => {
    // 외부 store Zustand 스토어의 상태를 초기 로딩 상태로 되돌리기 위해 fetchUserLibrary를 호출합니다.

    // const { sortConfig: currentSortConfig, sortLibrary: sortLibraryAction, setLibrarySearchQuery: setSearchQuery, clearAuthorFilter: clearAuthor } = useBookStore.getState();
    // setSearchQuery('');
    // clearAuthor();

    // if (currentSortConfig.key !== 'addedDate' || currentSortConfig.order !== 'desc') {
    //   sortLibraryAction('addedDate');
    // }

    // Zustand 스토어의 상태를 초기 로딩 상태로 되돌리기 위해 fetchUserLibrary를 호출합니다.
    fetchUserLibrary();

    // 검색 관련 상태 초기화
    setLibrarySearchQuery('');
    clearLibrarySearch();
    clearLibraryTagFilter();

    // 로컬 상태 리셋 (배치 업데이트)
    setDebouncedSearchQuery('');
    setActiveTags(new Set());
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        mobileSortDropdownRef.current && !mobileSortDropdownRef.current.contains(target) &&
        desktopSortDropdownRef.current && !desktopSortDropdownRef.current.contains(target)
      ) {
        setSortDropdownOpen(false);
      }
    };

    if (sortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sortDropdownOpen]);

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
  const handleTagClick = (tagId: string) => {
    const newActiveTags = new Set(activeTags);
    if (newActiveTags.has(tagId)) {
      newActiveTags.delete(tagId);
    } else {
      newActiveTags.add(tagId);
    }
    setActiveTags(newActiveTags);

    // [핵심 수정] DB 필터링 함수 호출
    if (newActiveTags.size > 0) {
      filterLibraryByTags(Array.from(newActiveTags));
    } else {
      clearLibraryTagFilter();
    }
  };

  const handleClearAllTags = () => {
    setActiveTags(new Set());
    clearLibraryTagFilter();
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

    if (debouncedSearchQuery.trim().length >= 2) {
      // 1순위: 텍스트 검색 활성화 → 서버 검색 결과 사용
      filteredBooks = [...librarySearchResults];
    } else if (activeTags.size > 0) {
      // 2순위: 태그 필터 활성화 → 서버 태그 필터링 결과 사용
      filteredBooks = [...libraryTagFilterResults];
    } else {
      // 3순위: 필터 없음 → 로컬 데이터 사용
      filteredBooks = [...myLibraryBooks];
    }

    // authorFilter와 showFavoritesOnly는 클라이언트 측에서 추가로 필터링
    if (authorFilter.trim()) {
      const authorQuery = authorFilter.toLowerCase().trim();
      filteredBooks = filteredBooks.filter(book =>
        book.author.toLowerCase().includes(authorQuery)
      );
    }

    if (showFavoritesOnly) {
      filteredBooks = filteredBooks.filter(book => book.isFavorite === true);
    }

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
  }, [myLibraryBooks, librarySearchResults, libraryTagFilterResults, sortConfig, debouncedSearchQuery, activeTags, showFavoritesOnly, authorFilter]);

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
      {/* Header - Three Row Layout */}
      <div className="mb-6 space-y-3 max-w-4xl mx-auto">
        {/* First Row: Search + View Controls */}
        <div className="flex justify-between items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              value={librarySearchQuery}
              onChange={(e) => setLibrarySearchQuery(e.target.value)}
              placeholder="제목, 저자명으로 내 서재를 검색하세요"
              className="input-base block w-full sm:w-80 pl-3 pr-10 py-2 text-sm"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <SearchIcon className="h-4 w-4 text-tertiary" />
            </div>
            {librarySearchQuery && (
              <button
                onClick={() => setLibrarySearchQuery('')}
                className="absolute inset-y-0 right-0 pr-9 flex items-center"
                title="검색어 지우기"
              >
                <CloseIcon className="h-4 w-4 text-tertiary hover:text-primary" />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-tertiary rounded-lg p-1 flex-shrink-0">
            <button
              onClick={() => setViewType('card')}
              className={`p-2 rounded transition-colors duration-200 ${
                viewType === 'card'
                  ? 'bg-blue-600 text-white'
                  : 'text-tertiary hover:text-primary hover-surface'
              }`}
              title="카드 보기"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zM3 8a1 1 0 000 2h14a1 1 0 100-2H3zM3 12a1 1 0 100 2h14a1 1 0 100-2H3z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => setViewType('grid')}
              className={`p-2 rounded transition-colors duration-200 ${
                viewType === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-tertiary hover:text-primary hover-surface'
              }`}
              title="그리드 보기"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Second Row: Tag Filter */}
        <TagFilter
          tags={settings.tagSettings?.tags || []}
          activeTags={activeTags}
          onTagClick={handleTagClick}
          onClearAll={handleClearAllTags}
        />

        {/* Third Row: Responsive 2-row layout for mobile, 1-row for desktop */}
        <div className="space-y-3 md:space-y-0">
          {/* Mobile: First Row - Book count + Sort */}
          <div className="flex justify-between items-center md:hidden">
            <span className="text-sm text-secondary font-medium">
              {/* 총 {sortedAndFilteredLibraryBooks.length}권{!showAllBooks && !hasActiveFilters() && sortedAndFilteredLibraryBooks.length > displayedBooks.length ? ` (${displayedBooks.length}권 표시)` : ''} */}
              총 {hasActiveFilters() ? sortedAndFilteredLibraryBooks.length : totalBooksCount}권{!showAllBooks && !hasActiveFilters() && totalBooksCount > displayedBooks.length ? ` (${displayedBooks.length}권 표시)` : ''}
            </span>
            {/* Sort Dropdown */}
            <div className="relative" ref={mobileSortDropdownRef}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSortDropdownOpen(!sortDropdownOpen);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSortDropdownOpen(!sortDropdownOpen);
                  } else if (e.key === 'Escape') {
                    setSortDropdownOpen(false);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 bg-tertiary text-primary rounded-lg hover-surface transition-colors duration-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-expanded={sortDropdownOpen}
                aria-haspopup="true"
                aria-label="정렬 방식 선택"
              >
                <span>{getCurrentSortName()}</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${sortDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {sortDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-36 bg-elevated border border-secondary rounded-lg shadow-xl z-20 animate-in fade-in duration-200">
                  {(Object.entries(sortOptions) as [SortKey, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        sortLibrary(key);
                        setSortDropdownOpen(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          sortLibrary(key);
                          setSortDropdownOpen(false);
                        } else if (e.key === 'Escape') {
                          setSortDropdownOpen(false);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                        sortConfig.key === key
                          ? 'bg-blue-600 text-white'
                          : 'text-primary hover-surface hover:text-primary focus-surface'
                      }`}
                      aria-label={`${label}로 정렬`}
                    >
                      <span className="flex items-center justify-between">
                        {label}
                        {sortConfig.key === key && <SortArrow order={sortConfig.order} />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Second Row - Selection + Action Buttons */}
          <div className="flex justify-between items-center md:hidden">
            <div className="flex items-center gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => {
                    setSelectAll(e.target.checked);
                    if (e.target.checked) {
                      setSelectedBooks(new Set(sortedAndFilteredLibraryBooks.map(book => book.id)));
                    } else {
                      setSelectedBooks(new Set());
                    }
                  }}
                  className="w-4 h-4 text-blue-600 bg-tertiary border-primary rounded focus:ring-blue-500"
                  title="전체 선택"
                />
              </label>
              <span className="text-sm text-secondary">
                {selectedBooks.size}권 선택
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkTagModalOpen(true)}
                disabled={selectedBooks.size === 0}
                className="p-1 btn-base btn-primary rounded-lg"
                title="선택된 책에 태그 관리"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className="p-1 btn-base btn-primary rounded-lg transition-colors duration-200"
                title={showFavoritesOnly ? "전체 책 보기" : "좋아하는 책만 보기"}
              >
                <HeartIcon
                  className={`w-5 h-5 transition-colors duration-200 ${
                    showFavoritesOnly
                      ? 'text-red-500 fill-red-500'
                      : 'text-[#131729] fill-[#131729]'
                  }`}
                />
              </button>
              <button
                onClick={() => {
                  // Delete selected books logic
                  if (selectedBooks.size > 0 && window.confirm(`선택된 ${selectedBooks.size}권의 책을 삭제하시겠습니까?`)) {
                    selectedBooks.forEach(bookId => removeFromLibrary(bookId));
                    setSelectedBooks(new Set());
                    setSelectAll(false);
                  }
                }}
                disabled={selectedBooks.size === 0}
                className="p-1 btn-base btn-primary rounded-lg"
                title="선택된 책 삭제"
              >
                <TrashIcon className="w-5 h-5 text-[#131729]" />
              </button>
            </div>
          </div>

          {/* Desktop: Single Row Layout (hidden on mobile) */}
          <div className="hidden md:flex justify-between items-center">
            <div className="flex items-center gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => {
                    setSelectAll(e.target.checked);
                    if (e.target.checked) {
                      setSelectedBooks(new Set(sortedAndFilteredLibraryBooks.map(book => book.id)));
                    } else {
                      setSelectedBooks(new Set());
                    }
                  }}
                  className="w-5 h-5 text-blue-600 bg-tertiary border-primary rounded focus:ring-blue-500"
                  title="전체 선택"
                />
              </label>
              <span className="text-sm text-secondary">
                {/* {selectedBooks.size}개 선택(총 {sortedAndFilteredLibraryBooks.length}권{!showAllBooks && !hasActiveFilters() && sortedAndFilteredLibraryBooks.length > displayedBooks.length ? `, ${displayedBooks.length}권 표시` : ''}) */}
                {selectedBooks.size}개 선택(총 {hasActiveFilters() ? sortedAndFilteredLibraryBooks.length : totalBooksCount}권{!showAllBooks && !hasActiveFilters() && totalBooksCount > displayedBooks.length ? ` 중 ${displayedBooks.length}권 표시` : ''})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort Dropdown */}
              <div className="relative" ref={desktopSortDropdownRef}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSortDropdownOpen(!sortDropdownOpen);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSortDropdownOpen(!sortDropdownOpen);
                    } else if (e.key === 'Escape') {
                      setSortDropdownOpen(false);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-tertiary text-primary rounded-lg hover-surface transition-colors duration-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  aria-expanded={sortDropdownOpen}
                  aria-haspopup="true"
                  aria-label="정렬 방식 선택"
                >
                  <span>{getCurrentSortName()}</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${sortDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {sortDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-36 bg-elevated border border-secondary rounded-lg shadow-xl z-20 animate-in fade-in duration-200">
                    {(Object.entries(sortOptions) as [SortKey, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => {
                          sortLibrary(key);
                          setSortDropdownOpen(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            sortLibrary(key);
                            setSortDropdownOpen(false);
                          } else if (e.key === 'Escape') {
                            setSortDropdownOpen(false);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                          sortConfig.key === key
                            ? 'bg-blue-600 text-white'
                            : 'text-primary hover-surface hover:text-primary focus-surface'
                        }`}
                        aria-label={`${label}로 정렬`}
                      >
                        <span className="flex items-center justify-between">
                          {label}
                          {sortConfig.key === key && <SortArrow order={sortConfig.order} />}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <button
                onClick={() => setBulkTagModalOpen(true)}
                disabled={selectedBooks.size === 0}
                className="p-1 btn-base btn-primary rounded-lg"
                title="선택된 책에 태그 관리"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className="p-1 btn-base btn-primary rounded-lg transition-colors duration-200"
                title={showFavoritesOnly ? "전체 책 보기" : "좋아하는 책만 보기"}
              >
                <HeartIcon
                  className={`w-4 h-4 transition-colors duration-200 ${
                    showFavoritesOnly
                      ? 'text-red-500 fill-red-500'
                      : 'text-[#131729] fill-[#131729]'
                  }`}
                />
              </button>
              <button
                onClick={() => {
                  // Delete selected books logic
                  if (selectedBooks.size > 0 && window.confirm(`선택된 ${selectedBooks.size}권의 책을 삭제하시겠습니까?`)) {
                    selectedBooks.forEach(bookId => removeFromLibrary(bookId));
                    setSelectedBooks(new Set());
                    setSelectAll(false);
                  }
                }}
                disabled={selectedBooks.size === 0}
                className="p-1 btn-base btn-primary rounded-lg"
                title="선택된 책 삭제"
              >
                <TrashIcon className="w-4 h-4 text-[#131729]" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* View Type Conditional Rendering */}
      {viewType === 'card' ? (
        /* Card View */
        <div className="space-y-4 max-w-4xl mx-auto">
        {(isSearchingLibrary || isFilteringByTag) ? (
          <div className="text-center p-8">
            <Spinner />
            <p className="mt-2 text-secondary">
              {isSearchingLibrary ? '서재에서 검색 중입니다...' : '태그로 필터링 중입니다...'}
            </p>
          </div>
        ) : displayedBooks.length === 0 && debouncedSearchQuery.trim().length >= 2 ? (
          <div className="text-center text-secondary p-8 bg-secondary rounded-lg shadow-md">
            <h3 className="text-lg font-medium mb-2">검색 결과가 없습니다</h3>
            <p className="text-sm">'{debouncedSearchQuery}' 에 대한 검색 결과를 찾을 수 없습니다.</p>
            <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
          </div>
        ) : (
          // (수정이전 원본) sortedAndFilteredLibraryBooks.map(book => (
          selectedBooksArray.map(book => (
          <div key={book.id} className="flex items-start gap-4 p-4 mb-4 bg-elevated rounded-lg">
            {/* Checkbox Column */}
            <div className="flex items-center justify-center">
              <input 
                type="checkbox" 
                // (수정이전 원본) checked={selectedBooks.has(book.id)}
                checked={book.isSelected} 
                /* (수정이전 원본) onChange={(e) => {
                  const newSelection = new Set(selectedBooks);
                  if (e.target.checked) {
                    newSelection.add(book.id);
                  } else {
                    newSelection.delete(book.id);
                  }
                  setSelectedBooks(newSelection);
                  setSelectAll(newSelection.size === sortedAndFilteredLibraryBooks.length);
                }} */
                onChange={(e) => handleBookSelection(book.id, e.target.checked)} 
                className="w-4 h-4 text-blue-600 bg-tertiary border-primary rounded focus:ring-blue-500"
              />
            </div>
            
            {/* Image and Button Column */}
            <div className="flex flex-col flex-shrink-0 w-24">
              <div className="relative">
                <img
                  src={book.cover}
                  alt={book.title}
                  className="w-full max-h-full object-contain rounded cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setDetailModalBookId(book.id)}
                  title="상세 정보 보기"
                />
                {/* Heart Icon for Favorite */}
                {settings.showFavorites && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(book.id);
                    }}
                    className="absolute top-1 left-1 p-1 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all duration-200"
                    title={book.isFavorite ? "좋아요 취소" : "좋아요"}
                  >
                    <HeartIcon
                      className={`w-4 h-4 transition-colors duration-200 ${
                        book.isFavorite
                          ? 'text-red-500 fill-red-500'
                          : 'text-white hover:text-red-300'
                      }`}
                    />
                  </button>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-1 mt-2">
                {(() => {
                  const isEbookResult = book.mallType === 'EBOOK';

                  const paperBookLink = isEbookResult
                    ? book.subInfo?.paperBookList?.[0]?.link || null
                    : book.link;
                    
                  const ebookLink = isEbookResult
                    ? book.link
                    : book.subInfo?.ebookList?.[0]?.link || null;
                  
                  const hasBothFormats = paperBookLink && ebookLink;
                  // const hasEbook = book.subInfo?.ebookList?.[0]?.isbn13;
                  const buttonClass = hasBothFormats 
                    ? "flex-1 px-1 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors text-center whitespace-nowrap"
                    : "w-full px-2 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors text-center";
                  
                  return (
                    <>
                      {paperBookLink && (
                        <a href={paperBookLink} target="_blank" rel="noopener noreferrer" className={buttonClass}>
                          종이책
                        </a>
                      )}
                      {ebookLink && (
                        <a href={ebookLink} target="_blank" rel="noopener noreferrer" className={buttonClass}>
                          전자책
                        </a>
                      )}
                      {/* <a 
                        href={book.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={buttonClass}
                      >
                        종이책
                      </a>
                      {hasEbook && (
                        <a 
                          href={book.subInfo.ebookList[0].link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex-1 px-1 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors text-center whitespace-nowrap"
                        >
                          전자책
                        </a>
                      )} */}
                    </>
                  );
                })()}
              </div>
            </div>
            
            {/* Right Column: Book Information */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* "상단 정보 블록" (이 블록의 높이가 이미지 높이의 기준이 됨) */}
              <div className="space-y-3">
                {/* Title with Refresh Icon */}
                <div className="flex justify-between items-start">
                  <h2 
                    className="text-lg font-bold text-primary leading-tight flex-1 pr-2 cursor-pointer hover:text-blue-400 transition-colors whitespace-nowrap overflow-hidden text-ellipsis"
                    onClick={() => setDetailModalBookId(book.id)}
                    title={book.title.replace(/^\[\w+\]\s*/, '')} // title 속성에 전체 제목 표시
                  >
                    {book.title.replace(/^\[\w+\]\s*/, '')}
                  </h2>
                  <button
                    onClick={() => refreshAllBookInfo(book.id, book.isbn13, book.title)}
                    disabled={refreshingIsbn === book.isbn13 || refreshingEbookId === book.id}
                    className="flex-shrink-0 p-1 text-tertiary hover:text-primary hover-surface rounded transition-colors disabled:opacity-50 disabled:cursor-wait"
                    title="재고 정보 갱신"
                  >
                    {refreshingIsbn === book.isbn13 || refreshingEbookId === book.id ? (
                      <Spinner />
                    ) : (
                      <RefreshIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                {/* Author and Publication Date */}
                <p className="text-sm text-secondary">
                  {book.author.replace(/\s*\([^)]*\)/g, '').split(',')[0]} | {book.pubDate.substring(0, 7).replace('-', '년 ')}월
                </p>
                
                {/* Read Status and Star Rating */}
                <div className="flex items-center gap-4 flex-wrap">
                  {settings.showReadStatus && (
                    <ReadStatusDropdown
                      value={book.readStatus}
                      onChange={(newStatus) => updateReadStatus(book.id, newStatus)}
                      size="sm"
                    />
                  )}
                  {settings.showRating && (
                    <StarRating
                      rating={book.rating}
                      onRatingChange={(newRating) => updateRating(book.id, newRating)}
                      size="md"
                    />
                  )}
                </div>

                {/* Custom Tags */}
                {settings.showTags && book.customTags && book.customTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {book.customTags.map(tagId => {
                      const tag = settings.tagSettings.tags.find(t => t.id === tagId);
                      return tag ? (
                        <CustomTagComponent
                          key={tag.id}
                          tag={tag}
                          isActive={false}
                          onClick={() => {}}
                          size="sm"
                        />
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              
              {/* 구분선 및 "하단 재고 블록" */}
              {settings.showLibraryStock && <hr className="my-3 border-secondary" />}

              {/* Library Inventory Grid */}
              {settings.showLibraryStock && <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {/* 퇴촌lib */}
                <LibraryTag
                  name="퇴촌"
                  totalBooks={book.toechonStock?.total_count || 0}
                  availableBooks={book.toechonStock?.available_count || 0}
                  searchUrl={createLibraryOpenURL("퇴촌", book.title, book.customSearchTitle)}
                  isError={book.gwangjuPaperInfo ? 'error' in book.gwangjuPaperInfo : false} // 추가
                />
                
                {/* 기타lib */}
                <LibraryTag
                  name="기타"
                  totalBooks={book.otherStock?.total_count || 0}
                  availableBooks={book.otherStock?.available_count || 0}
                  searchUrl={createLibraryOpenURL("기타", book.title, book.customSearchTitle)}
                  isError={book.gwangjuPaperInfo ? 'error' in book.gwangjuPaperInfo : false} // 추가
                />
                
                {/* e북.교육 */}
                <LibraryTag
                  name="e교육"
                  totalBooks={book.ebookInfo?.summary.total_count || 0}
                  availableBooks={book.ebookInfo?.summary.available_count || 0}
                  searchUrl={createLibraryOpenURL("e교육", book.title, book.customSearchTitle)}
                  // summary에 error_count가 있으므로 더 간단하게 확인 가능
                  isError={(book.ebookInfo?.summary.error_count ?? 0) == 2} // 둘 다 에러일때만
                  // isError={(book.ebookInfo?.summary.error_count ?? 0) > 0} // 1군데라도 에러일때
                  // isError={book.ebookInfo?.details.some(d => 'error' in d) || false}
                />
                
                {/* e북.시립구독 */}
                <LibraryTag
                  name="e시립구독"
                  totalBooks={(() => {
                    const siripInfo = book.siripEbookInfo;
                    return siripInfo?.details?.subscription?.total_count || 0;
                  })()}
                  availableBooks={(() => {
                    const siripInfo = book.siripEbookInfo;
                    return siripInfo?.details?.subscription?.available_count || 0;
                  })()}
                  searchUrl={createLibraryOpenURL("e시립구독", book.title, book.customSearchTitle)}
                  isError={book.siripEbookInfo ? ('error' in book.siripEbookInfo || !!book.siripEbookInfo.details?.subscription?.error) : false}
                />
                
                {/* e북.시립소장 */}
                <LibraryTag
                  name="e시립소장"
                  totalBooks={(() => {
                    const siripInfo = book.siripEbookInfo;
                    return siripInfo?.details?.owned?.total_count || 0;
                  })()}
                  availableBooks={(() => {
                    const siripInfo = book.siripEbookInfo;
                    return siripInfo?.details?.owned?.available_count || 0;
                  })()}
                  searchUrl={createLibraryOpenURL("e시립소장", book.title, book.customSearchTitle)}
                  isError={book.siripEbookInfo ? ('error' in book.siripEbookInfo || !!book.siripEbookInfo.details?.owned?.error) : false}
                />
                
                {/* e북.경기 */}
                <LibraryTag
                  name="e경기"
                  totalBooks={(() => {
                    const targetGyeonggiInfo = book.filteredGyeonggiEbookInfo || book.gyeonggiEbookInfo;
                    return targetGyeonggiInfo && 'total_count' in targetGyeonggiInfo ? targetGyeonggiInfo.total_count : 0;
                  })()}
                  availableBooks={(() => {
                    const targetGyeonggiInfo = book.filteredGyeonggiEbookInfo || book.gyeonggiEbookInfo;
                    return targetGyeonggiInfo && 'available_count' in targetGyeonggiInfo ? targetGyeonggiInfo.available_count : 0;
                  })()}
                  // searchUrl={createGyeonggiEbookSearchURL(book.title)}
                  searchUrl={createLibraryOpenURL("e경기", book.title, book.customSearchTitle)}
                  isError={book.gyeonggiEbookInfo ? 'error' in book.gyeonggiEbookInfo : false}
                />
              </div>}

              {/* Book Note Section */}
              {settings.showBookNotes && book.note && (
                <div className="mt-3 pt-3 border-t border-secondary">
                  {editingNoteId === book.id ? (
                    /* Editing Mode */
                    <div className="flex items-center gap-2">
                      <MessageSquareIcon className="w-4 h-4 text-secondary flex-shrink-0" />
                      <input
                        type="text"
                        value={noteInputValue}
                        onChange={(e) => setNoteInputValue(e.target.value)}
                        onKeyDown={(e) => handleNoteKeyDown(e, book.id)}
                        onBlur={() => handleNoteSave(book.id)}
                        maxLength={50}
                        placeholder="메모를 입력하세요..."
                        className="flex-1 px-2 py-1 text-xs bg-tertiary border border-secondary rounded text-primary focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleNoteSave(book.id)}
                        className="p-1 text-secondary hover:text-green-500 transition-colors"
                        title="저장"
                      >
                        <CheckIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className="flex items-center gap-2">
                      <MessageSquareIcon className="w-4 h-4 text-secondary flex-shrink-0" />
                      <span
                        className="flex-1 text-xs text-secondary truncate cursor-pointer hover:text-primary"
                        onClick={() => handleNoteEdit(book.id, book.note)}
                        title={book.note || '메모를 추가하려면 클릭하세요'}
                      >
                        {book.note || '메모'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )))}
        </div>
      ) : (
        /* Grid View */
        <div className="grid gap-4 max-w-4xl mx-auto" style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
          {(isSearchingLibrary || isFilteringByTag) ? (
            <div className="col-span-full text-center p-8">
              <Spinner />
              <p className="mt-2 text-secondary">
                {isSearchingLibrary ? '서재에서 검색 중입니다...' : '태그로 필터링 중입니다...'}
              </p>
            </div>
          ) : displayedBooks.length === 0 && debouncedSearchQuery.trim().length >= 2 ? (
            <div className="col-span-full text-center text-secondary p-8 bg-secondary rounded-lg shadow-md">
              <h3 className="text-lg font-medium mb-2">검색 결과가 없습니다</h3>
              <p className="text-sm">'{debouncedSearchQuery}' 에 대한 검색 결과를 찾을 수 없습니다.</p>
              <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
            </div>
          ) : (
            // sortedAndFilteredLibraryBooks.map(book => (
            selectedBooksArray.map(book => (
            <div key={book.id} className="bg-elevated rounded-lg p-3 relative">
              {/* Checkbox */}
              <div
                className="absolute top-2 left-2 z-20 p-1 -m-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  // checked={selectedBooks.has(book.id)}
                  checked={book.isSelected}
                  /* onChange={(e) => {
                    const newSelection = new Set(selectedBooks);
                    if (e.target.checked) {
                      newSelection.add(book.id);
                    } else {
                      newSelection.delete(book.id);
                    }
                    setSelectedBooks(newSelection);
                    setSelectAll(newSelection.size === sortedAndFilteredLibraryBooks.length);
                  }} */
                  onChange={(e) => {
                    e.stopPropagation();
                    handleBookSelection(book.id, e.target.checked);
                  }}
                  className="w-4 h-4 text-blue-600 bg-tertiary border-primary rounded focus:ring-blue-500 cursor-pointer relative z-20"
                />
              </div>

              {/* Heart Icon for Favorite */}
              {settings.showFavorites && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(book.id);
                  }}
                  className="absolute top-2 right-2 z-20 p-1 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all duration-200"
                  title={book.isFavorite ? "좋아요 취소" : "좋아요"}
                >
                  <HeartIcon
                    className={`w-4 h-4 transition-colors duration-200 ${
                      book.isFavorite
                        ? 'text-red-500 fill-red-500'
                        : 'text-white hover:text-red-300'
                    }`}
                  />
                </button>
              )}

              {/* Book Cover */}
              <div className="text-center mb-3">
                <img
                  src={book.cover}
                  alt={book.title}
                  className="w-full h-40 object-contain rounded mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setDetailModalBookId(book.id)}
                  title="상세 정보 보기"
                />
                
                {/* Action Buttons */}
                <div className="flex gap-1 justify-center">
                  <a 
                    href={book.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-2 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors"
                  >
                    종이책
                  </a>
                  {book.subInfo?.ebookList?.[0]?.isbn13 && (
                    <a 
                      href={book.subInfo.ebookList[0].link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="px-2 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors"
                    >
                      전자책
                    </a>
                  )}
                </div>
              </div>
              
              {/* Book Info */}
              <div className="space-y-2">
                {/* Title with Refresh Icon */}
                <div className="flex justify-between items-start gap-1">
                  <h3 className="text-sm font-bold text-primary line-clamp-2 flex-1">
                    <span
                      className="cursor-pointer hover:text-blue-400 transition-colors"
                      onClick={() => setDetailModalBookId(book.id)}
                      title={book.title}
                    >
                      {book.title.replace(/^\[\w+\]\s*/, '')}
                    </span>
                  </h3>
                  <button
                    onClick={() => refreshAllBookInfo(book.id, book.isbn13, book.title)}
                    disabled={refreshingIsbn === book.isbn13 || refreshingEbookId === book.id}
                    className="flex-shrink-0 p-0.5 text-tertiary hover:text-primary hover-surface rounded transition-colors disabled:opacity-50 disabled:cursor-wait"
                    title="재고 정보 갱신"
                  >
                    {refreshingIsbn === book.isbn13 || refreshingEbookId === book.id ? (
                      <div className="w-3 h-3 flex items-center justify-center">
                        <Spinner />
                      </div>
                    ) : (
                      <RefreshIcon className="w-3 h-3" />
                    )}
                  </button>
                </div>
                
                {/* Author */}
                <p className="text-xs text-secondary truncate">
                  {book.author.replace(/\s*\([^)]*\)/g, '').split(',')[0]}
                </p>
                
                {/* Publication Date */}
                <p className="text-xs text-secondary">
                  {book.pubDate.substring(0, 7).replace('-', '년 ')}월
                </p>
                
                {/* Star Rating */}
                {settings.showRating && (
                  <div className="flex justify-start">
                    <StarRating
                      rating={book.rating}
                      onRatingChange={(newRating) => updateRating(book.id, newRating)}
                      size="md"
                    />
                  </div>
                )}
                
                {/* Read Status */}
                {settings.showReadStatus && (
                  <ReadStatusDropdown
                    value={book.readStatus}
                    onChange={(newStatus) => updateReadStatus(book.id, newStatus)}
                    size="sm"
                  />
                )}

                {/* Custom Tags */}
                {settings.showTags && book.customTags && book.customTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {book.customTags.map(tagId => {
                      const tag = settings.tagSettings.tags.find(t => t.id === tagId);
                      return tag ? (
                        <CustomTagComponent
                          key={tag.id}
                          tag={tag}
                          isActive={false}
                          onClick={() => {}}
                          size="sm"
                        />
                      ) : null;
                    })}
                  </div>
                )}
                
                {/* All Library Stock Info */}
                {settings.showLibraryStock && <div className="grid grid-cols-2 gap-1 text-xs">
                  <LibraryTag
                    name="퇴촌"
                    totalBooks={book.toechonStock?.total_count || 0}
                    availableBooks={book.toechonStock?.available_count || 0}
                    searchUrl={createLibraryOpenURL("퇴촌", book.title, book.customSearchTitle)}
                    isError={book.gwangjuPaperInfo ? 'error' in book.gwangjuPaperInfo : false}
                  />
                  <LibraryTag
                    name="기타"
                    totalBooks={book.otherStock?.total_count || 0}
                    availableBooks={book.otherStock?.available_count || 0}
                    searchUrl={createLibraryOpenURL("기타", book.title, book.customSearchTitle)}
                    isError={book.gwangjuPaperInfo ? 'error' in book.gwangjuPaperInfo : false}
                  />
                  <LibraryTag
                    name="e교육"
                    totalBooks={book.ebookInfo?.summary.total_count || 0}
                    availableBooks={book.ebookInfo?.summary.available_count || 0}
                    searchUrl={createLibraryOpenURL("e교육", book.title, book.customSearchTitle)}
                    // summary에 error_count가 있으므로 더 간단하게 확인 가능
                    isError={(book.ebookInfo?.summary.error_count ?? 0) == 2} // 둘 다 에러일때만
                  // isError={(book.ebookInfo?.summary.error_count ?? 0) > 0} // 1군데라도 에러일때 
                    // isError={book.ebookInfo?.details.some(d => 'error' in d) || false}
                  />
                  <LibraryTag
                    name="e시립구독"
                    totalBooks={(() => {
                      const siripInfo = book.siripEbookInfo;
                      return siripInfo?.details?.subscription?.total_count || 0;
                    })()}
                    availableBooks={(() => {
                      const siripInfo = book.siripEbookInfo;
                      return siripInfo?.details?.subscription?.available_count || 0;
                    })()}
                    searchUrl={createLibraryOpenURL("e시립구독", book.title, book.customSearchTitle)}
                    isError={book.siripEbookInfo ? ('error' in book.siripEbookInfo || !!book.siripEbookInfo.details?.subscription?.error) : false}
                  />
                  <LibraryTag
                    name="e시립소장"
                    totalBooks={(() => {
                      const siripInfo = book.siripEbookInfo;
                      return siripInfo?.details?.owned?.total_count || 0;
                    })()}
                    availableBooks={(() => {
                      const siripInfo = book.siripEbookInfo;
                      return siripInfo?.details?.owned?.available_count || 0;
                    })()}
                    searchUrl={createLibraryOpenURL("e시립소장", book.title, book.customSearchTitle)}
                    isError={book.siripEbookInfo ? ('error' in book.siripEbookInfo || !!book.siripEbookInfo.details?.owned?.error) : false}
                  />
                  <LibraryTag
                    name="e경기"
                    totalBooks={(() => {
                      const targetGyeonggiInfo = book.filteredGyeonggiEbookInfo || book.gyeonggiEbookInfo;
                      return targetGyeonggiInfo && 'total_count' in targetGyeonggiInfo ? targetGyeonggiInfo.total_count : 0;
                    })()}
                    availableBooks={(() => {
                      const targetGyeonggiInfo = book.filteredGyeonggiEbookInfo || book.gyeonggiEbookInfo;
                      return targetGyeonggiInfo && 'available_count' in targetGyeonggiInfo ? targetGyeonggiInfo.available_count : 0;
                    })()}
                    searchUrl={createLibraryOpenURL("e경기", book.title, book.customSearchTitle)}
                    isError={book.gyeonggiEbookInfo ? 'error' in book.gyeonggiEbookInfo : false}
                  />
                </div>}

                {/* Book Note Section */}
                {settings.showBookNotes && book.note && (
                  <div className="mt-2 pt-2 border-t border-secondary">
                    {editingNoteId === book.id ? (
                      /* Editing Mode */
                      <div className="flex items-center gap-1">
                        <MessageSquareIcon className="w-3 h-3 text-secondary flex-shrink-0" />
                        <input
                          type="text"
                          value={noteInputValue}
                          onChange={(e) => setNoteInputValue(e.target.value)}
                          onKeyDown={(e) => handleNoteKeyDown(e, book.id)}
                          onBlur={() => handleNoteSave(book.id)}
                          maxLength={50}
                          placeholder="메모..."
                          className="flex-1 px-1 py-0.5 text-xs bg-tertiary border border-secondary rounded text-primary focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleNoteSave(book.id)}
                          className="p-0.5 text-secondary hover:text-green-500 transition-colors"
                          title="저장"
                        >
                          <CheckIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      /* Display Mode */
                      <div className="flex items-center gap-1">
                        <MessageSquareIcon className="w-3 h-3 text-secondary flex-shrink-0" />
                        <span
                          className="flex-1 text-xs text-secondary truncate cursor-pointer hover:text-primary"
                          onClick={() => handleNoteEdit(book.id, book.note)}
                          title={book.note || '메모를 추가하려면 클릭하세요'}
                        >
                          {book.note || '메모...'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )))}
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
          availableTags={settings.tagSettings?.tags || []}
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
