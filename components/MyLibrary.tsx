

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { SelectedBook, StockInfo, SortKey, ReadStatus } from '../types';
import { DownloadIcon, TrashIcon, RefreshIcon, CheckIcon, SearchIcon, CloseIcon } from './Icons';
import Spinner from './Spinner';
import { useBookStore } from '../stores/useBookStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import StarRating from './StarRating';
import MyLibraryBookDetailModal from './MyLibraryBookDetailModal';
import TagFilter from './TagFilter';
import { getStatusEmoji, isEBooksEmpty, hasAvailableEBooks, processBookTitle, processGyeonggiEbookTitle, createGyeonggiEbookSearchURL, generateLibraryDetailURL, isLibraryStockClickable } from '../services/unifiedLibrary.service';
// import { filterGyeonggiEbookByIsbn, debugIsbnMatching } from '../utils/isbnMatcher'; // 성능 최적화로 사용 안함

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
}

const LibraryTag: React.FC<LibraryTagProps> = ({ name, totalBooks, availableBooks, searchUrl }) => {
  const getStatus = () => {
    if (availableBooks > 0) return 'available';
    if (totalBooks > 0) return 'unavailable';
    return 'none';
  };

  const status = getStatus();

  const statusStyles = {
    available: 'bg-green-600/20 text-green-400',
    unavailable: 'bg-red-600/20 text-red-400',
    none: 'bg-tertiary/20 text-tertiary'
  }[status];

  return (
    <a 
      href={searchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block px-2 py-1 text-xs rounded-md ${statusStyles} hover:opacity-80 transition-all hover:scale-105 truncate`}
      title={`${name} - 총 ${totalBooks}권 (대출가능: ${availableBooks}권)`}
    >
      {name} ({totalBooks}/{availableBooks})
    </a>
  );
};

type ViewType = 'card' | 'grid';


const MyLibrary: React.FC = () => {
  const { session } = useAuthStore();
  const { settings } = useSettingsStore();
  const {
    myLibraryBooks,
    sortConfig,
    sortLibrary,
    removeFromLibrary,
    refreshingIsbn,
    refreshEBookInfo,
    refreshingEbookId,
    refreshAllBookInfo,
    updateReadStatus,
    updateRating,
    librarySearchQuery,
    setLibrarySearchQuery,
  } = useBookStore();
  
  const [detailModalBookId, setDetailModalBookId] = useState<number | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [viewType, setViewType] = useState<ViewType>('card');
  const [gridColumns, setGridColumns] = useState(5);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [backgroundRefreshComplete, setBackgroundRefreshComplete] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(librarySearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [librarySearchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
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
  
  // Use the standardized title processing function from ebook.service
  const createSearchSubject = processBookTitle;

  // Tag filtering handlers
  const handleTagClick = (tagId: string) => {
    const newActiveTags = new Set(activeTags);
    if (newActiveTags.has(tagId)) {
      newActiveTags.delete(tagId);
    } else {
      newActiveTags.add(tagId);
    }
    setActiveTags(newActiveTags);
  };

  const handleClearAllTags = () => {
    setActiveTags(new Set());
  };

  const sortedAndFilteredLibraryBooks = useMemo(() => {
    const readStatusOrder: Record<ReadStatus, number> = { '완독': 0, '읽는 중': 1, '읽지 않음': 2 };

    // First filter by search query
    let filteredBooks = [...myLibraryBooks];

    if (debouncedSearchQuery.trim() && debouncedSearchQuery.trim().length >= 2) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filteredBooks = filteredBooks.filter(book =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query)
      );
    }

    // Then filter by active tags
    if (activeTags.size > 0) {
      filteredBooks = filteredBooks.filter(book =>
        book.customTags?.some(tagId => activeTags.has(tagId))
      );
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
  }, [myLibraryBooks, sortConfig, debouncedSearchQuery, activeTags]);
  

  // Background refresh for books missing detailed stock info - 비활성화
  useEffect(() => {
    // 백그라운드 재고 업데이트 비활성화 - 사용자가 명시적으로 요청할 때만 실행
    setBackgroundRefreshComplete(true);
    
    /* 
    if (!backgroundRefreshComplete && myLibraryBooks.length > 0) {
      const booksNeedingDetailedInfo = myLibraryBooks.filter(book => 
        book.toechonStock?.total > 0 && !book.detailedStockInfo?.gwangju_paper?.availability
      );
      
      // console.log(`Background refresh: Found ${booksNeedingDetailedInfo.length} books needing detailed stock info`); // 성능 개선을 위해 주석 처리
      
      if (booksNeedingDetailedInfo.length > 0) {
        // Refresh books with staggered timing (3 second intervals)
        booksNeedingDetailedInfo.forEach((book, index) => {
          setTimeout(() => {
            // console.log(`Background refreshing book ${index + 1}/${booksNeedingDetailedInfo.length}: ${book.title}`); // 성능 개선을 위해 주석 처리
            refreshAllBookInfo(book.id, book.isbn13, book.title);
            
            // Mark as complete when last book is processed
            if (index === booksNeedingDetailedInfo.length - 1) {
              setTimeout(() => setBackgroundRefreshComplete(true), 1000);
            }
          }, index * 3000); // 3 second intervals to avoid rate limiting
        });
      } else {
        setBackgroundRefreshComplete(true);
      }
    }
    */
  }, [myLibraryBooks, backgroundRefreshComplete, refreshAllBookInfo]);


  const renderStockCell = (stock?: StockInfo) => {
    if (typeof stock === 'undefined') {
      return <span className="text-xs text-secondary">확인중...</span>;
    }
    const { total, available } = stock;
    const showIcon = available > 0;
    const iconClass = available > 0 ? 'text-green-500' : 'text-tertiary opacity-50';
    const textClass = available > 0 ? '' : 'text-tertiary opacity-50';
    return (
      <span className="flex items-center justify-center whitespace-nowrap">
        {showIcon && <CheckIcon title="대출가능" className={`mr-1 w-3 h-3 ${iconClass}`} />}
        <span className={textClass}>{total}({available})</span>
      </span>
    );
  };

  const renderEBookCell = (book: SelectedBook) => {
    const isRefreshing = refreshingEbookId === book.id;
    
    if (isRefreshing) {
      return (
        <div className="flex justify-center">
          <Spinner />
        </div>
      );
    }

    if (!book.ebookInfo) {
      return (
        <button
          onClick={() => refreshEBookInfo(book.id, book.isbn13, book.title)}
          className="text-blue-400 hover:text-blue-300 underline"
          title="전자책 정보 조회"
        >
          조회
        </button>
      );
    }

    const { summary } = book.ebookInfo;
    
    const processedTitle = createSearchSubject(book.title);
    const ebookEduUrl = `https://lib.goe.go.kr/elib/module/elib/search/index.do?menu_idx=94&author_name=&viewPage=1&search_text=${encodeURIComponent(processedTitle)}&sortField=book_pubdt&sortType=desc&rowCount=20`;

    if (summary.총개수 === 0 && summary.오류개수 > 0) {
      return (
        <a
          href={ebookEduUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center whitespace-nowrap text-tertiary opacity-50 hover:text-blue-300"
          title="조회 실패 - 클릭하여 직접 검색"
        >
          0(0)
        </a>
      );
    }

    if (summary.총개수 === 0) {
      return (
        <a
          href={ebookEduUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center whitespace-nowrap text-tertiary opacity-50 hover:text-blue-300"
          title="전자책 없음 - 클릭하여 직접 검색"
        >
          0(0)
        </a>
      );
    }

    const showIcon = summary.대출가능 > 0;
    const iconClass = summary.대출가능 > 0 ? 'text-green-500' : 'text-tertiary opacity-50';
    const statusTitle = `총 ${summary.총개수}권 (대출가능: ${summary.대출가능}권, 대출불가: ${summary.대출불가}권)`;

    return (
      <a
        href={ebookEduUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center whitespace-nowrap text-blue-400 hover:text-blue-300"
      >
        {showIcon && <CheckIcon className={`mr-1 w-3 h-3 ${iconClass}`} />}
        {summary.총개수}({summary.대출가능})
      </a>
    );
  };

  const renderSidokEbookCell = useCallback((book: SelectedBook) => {
    // e북.시립구독은 실제 API 데이터 사용
    const siripInfo = book.siripEbookInfo;
    const totalCount = siripInfo?.details?.subscription?.total_count || 0;
    const availableCount = siripInfo?.details?.subscription?.available_count || 0;
    
    const titleForSearch = (() => {
      let titleForSearch = book.title;
      const dashIndex = titleForSearch.indexOf('-');
      const parenthesisIndex = titleForSearch.indexOf('(');
      
      // 대시(-) 또는 괄호시작("(") 중 더 앞에 있는 위치를 찾아서 그 이전까지만 사용
      let cutIndex = -1;
      if (dashIndex !== -1 && parenthesisIndex !== -1) {
        cutIndex = Math.min(dashIndex, parenthesisIndex);
      } else if (dashIndex !== -1) {
        cutIndex = dashIndex;
      } else if (parenthesisIndex !== -1) {
        cutIndex = parenthesisIndex;
      }
      
      if (cutIndex !== -1) {
        titleForSearch = titleForSearch.substring(0, cutIndex).trim();
      }
      return titleForSearch.split(' ').slice(0, 3).join(' ');
    })();

    const sidokUrl = `https://gjcitylib.dkyobobook.co.kr/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent(titleForSearch)}`;

    const showIcon = availableCount > 0;
    const iconClass = availableCount > 0 ? 'text-green-500' : 'text-tertiary opacity-50';
    const textClass = totalCount > 0 && availableCount > 0 ? 'text-blue-400 hover:text-blue-300' : 'text-tertiary opacity-50 hover:text-blue-300';

    return (
      <a
        href={sidokUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center whitespace-nowrap ${textClass}`}
        title={`광주시립도서관 전자책(구독) - 총 ${totalCount}권 (대출가능: ${availableCount}권)`}
      >
        {showIcon && <CheckIcon className={`mr-1 w-3 h-3 ${iconClass}`} />}
        {totalCount}({availableCount})
      </a>
    );
  }, []);

  const renderGyeonggiEbookCell = useCallback((book: SelectedBook) => {
    const isRefreshing = refreshingEbookId === book.id;
    
    if (isRefreshing) {
      return (
        <div className="flex justify-center">
          <Spinner />
        </div>
      );
    }

    // 필터링된 데이터를 우선 사용하고, 없으면 원본 데이터 사용
    const targetGyeonggiInfo = book.filteredGyeonggiEbookInfo || book.gyeonggiEbookInfo;

    if (!targetGyeonggiInfo) {
      return (
        <button
          onClick={() => refreshAllBookInfo(book.id, book.isbn13, book.title)}
          className="text-blue-400 hover:text-blue-300 underline"
          title="경기도 전자도서관 정보 조회"
        >
          조회
        </button>
      );
    }

    const gyeonggiEbookUrl = createGyeonggiEbookSearchURL(book.title);

    if ('error' in targetGyeonggiInfo) {
      return (
        <a
          href={gyeonggiEbookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center whitespace-nowrap text-tertiary opacity-50 hover:text-blue-300"
          title="조회 실패 - 클릭하여 직접 검색"
        >
          0(0)
        </a>
      );
    }

    // 사전 필터링된 데이터 사용 - 렌더링 시 ISBN 매칭 계산 불필요
    const { total_count, available_count } = targetGyeonggiInfo;
    
    if (total_count === 0) {
      return (
        <a
          href={gyeonggiEbookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center whitespace-nowrap text-tertiary opacity-50 hover:text-blue-300"
          title="전자책 없음 - 클릭하여 직접 검색"
        >
          0(0)
        </a>
      );
    }

    const showIcon = available_count > 0;
    const iconClass = available_count > 0 ? 'text-green-500' : 'text-tertiary opacity-50';
    const statusTitle = `총 ${total_count}권 (대출가능: ${available_count}권, 소장형: ${targetGyeonggiInfo.owned_count}권, 구독형: ${targetGyeonggiInfo.subscription_count}권)`;

    return (
      <a
        href={gyeonggiEbookUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center whitespace-nowrap text-blue-400 hover:text-blue-300"
        title={statusTitle}
      >
        {showIcon && <CheckIcon className={`mr-1 w-3 h-3 ${iconClass}`} />}
        {total_count}({available_count})
      </a>
    );
  }, [refreshingEbookId, refreshAllBookInfo]);

  const renderSiripEbookCell = useCallback((book: SelectedBook) => {
    const isRefreshing = refreshingEbookId === book.id;
    
    if (isRefreshing) {
      return (
        <div className="flex justify-center">
          <Spinner />
        </div>
      );
    }

    // 시립도서관 전자책 검색 URL 생성
    const titleForSearch = (() => {
      let titleForSearch = book.title;
      const dashIndex = titleForSearch.indexOf('-');
      const parenthesisIndex = titleForSearch.indexOf('(');
      
      // 대시(-) 또는 괄호시작("(") 중 더 앞에 있는 위치를 찾아서 그 이전까지만 사용
      let cutIndex = -1;
      if (dashIndex !== -1 && parenthesisIndex !== -1) {
        cutIndex = Math.min(dashIndex, parenthesisIndex);
      } else if (dashIndex !== -1) {
        cutIndex = dashIndex;
      } else if (parenthesisIndex !== -1) {
        cutIndex = parenthesisIndex;
      }
      
      if (cutIndex !== -1) {
        titleForSearch = titleForSearch.substring(0, cutIndex).trim();
      }
      return titleForSearch.split(' ').slice(0, 3).join(' ');
    })();

    const siripUrl = `https://lib.gjcity.go.kr:444/elibrary-front/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent(titleForSearch)}`;

    if (!book.siripEbookInfo) {
      return (
        <button
          onClick={() => refreshAllBookInfo(book.id, book.isbn13, book.title)}
          className="text-blue-400 hover:text-blue-300 underline"
          title="시립도서관 전자책 정보 조회"
        >
          조회
        </button>
      );
    }

    if ('error' in book.siripEbookInfo) {
      return (
        <a
          href={siripUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center whitespace-nowrap text-tertiary opacity-50 hover:text-blue-300"
          title="조회 실패 - 클릭하여 직접 검색"
        >
          0(0)
        </a>
      );
    }

    // owned 항목의 데이터만 사용
    const totalCount = book.siripEbookInfo.details?.owned?.total_count || 0;
    const availableCount = book.siripEbookInfo.details?.owned?.available_count || 0;
    
    if (totalCount === 0) {
      return (
        <a
          href={siripUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center whitespace-nowrap text-tertiary opacity-50 hover:text-blue-300"
          title="전자책 없음 - 클릭하여 직접 검색"
        >
          0(0)
        </a>
      );
    }

    const showIcon = availableCount > 0;
    const iconClass = availableCount > 0 ? 'text-green-500' : 'text-tertiary opacity-50';
    const statusTitle = `총 ${totalCount}권 (대출가능: ${availableCount}권, 대출불가: ${totalCount - availableCount}권)`;

    return (
      <a
        href={siripUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center whitespace-nowrap text-blue-400 hover:text-blue-300"
        title={statusTitle}
      >
        {showIcon && <CheckIcon className={`mr-1 w-3 h-3 ${iconClass}`} />}
        {totalCount}({availableCount})
      </a>
    );
  }, [refreshingEbookId, refreshAllBookInfo]);
  
  
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
        <p>서재가 비어있습니다.</p>
        <p className="text-sm mt-2">책을 검색하고 '내 서재에 추가' 버튼을 눌러 관리해보세요.</p>
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
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-4 w-4 text-tertiary" />
            </div>
            <input
              type="text"
              value={librarySearchQuery}
              onChange={(e) => setLibrarySearchQuery(e.target.value)}
              placeholder="책 제목, 저자명으로 검색..."
              className="input-base block w-full sm:w-80 pl-10 pr-10 py-2 text-sm"
            />
            {librarySearchQuery && (
              <button
                onClick={() => setLibrarySearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
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
          books={myLibraryBooks}
          activeTags={activeTags}
          onTagClick={handleTagClick}
          onClearAll={handleClearAllTags}
        />

        {/* Third Row: Selection Info + Sort + Action Buttons */}
        <div className="flex justify-between items-center">
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
              {selectedBooks.size}개 선택됨(총 {sortedAndFilteredLibraryBooks.length}권)
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort Dropdown */}
            <div className="relative" ref={sortDropdownRef}>
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
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
                <span className="hidden sm:inline">{getCurrentSortName()}</span>
                <span className="sm:hidden">{getCurrentSortName().substring(0, 2)}</span>
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
              onClick={() => {
                // Delete selected books logic
                if (selectedBooks.size > 0 && window.confirm(`선택된 ${selectedBooks.size}권의 책을 삭제하시겠습니까?`)) {
                  selectedBooks.forEach(bookId => removeFromLibrary(bookId));
                  setSelectedBooks(new Set());
                  setSelectAll(false);
                }
              }}
              disabled={selectedBooks.size === 0}
              className="p-2 btn-base btn-danger rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title="선택된 책 삭제"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                // 태그 관리 모달 열기 (나중에 구현)
                console.log('태그 관리 모달 열기');
              }}
              disabled={selectedBooks.size === 0}
              className="p-2 btn-base btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title="선택된 책에 태그 관리"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* View Type Conditional Rendering */}
      {viewType === 'card' ? (
        /* Card View */
        <div className="space-y-4 max-w-4xl mx-auto">
        {sortedAndFilteredLibraryBooks.length === 0 && debouncedSearchQuery.trim().length >= 2 ? (
          <div className="text-center text-secondary p-8 bg-secondary rounded-lg shadow-md">
            <h3 className="text-lg font-medium mb-2">검색 결과가 없습니다</h3>
            <p className="text-sm">'{debouncedSearchQuery}' 에 대한 검색 결과를 찾을 수 없습니다.</p>
            <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
          </div>
        ) : (
          sortedAndFilteredLibraryBooks.map(book => (
          <div key={book.id} className="flex items-start gap-4 p-4 mb-4 bg-elevated rounded-lg hover-surface transition-colors">
            {/* Checkbox Column */}
            <div className="flex items-center justify-center">
              <input 
                type="checkbox" 
                checked={selectedBooks.has(book.id)}
                onChange={(e) => {
                  const newSelection = new Set(selectedBooks);
                  if (e.target.checked) {
                    newSelection.add(book.id);
                  } else {
                    newSelection.delete(book.id);
                  }
                  setSelectedBooks(newSelection);
                  setSelectAll(newSelection.size === sortedAndFilteredLibraryBooks.length);
                }}
                className="w-4 h-4 text-blue-600 bg-tertiary border-primary rounded focus:ring-blue-500"
              />
            </div>
            
            {/* Image and Button Column */}
            <div className="flex flex-col flex-shrink-0 w-24">
              <img 
                src={book.cover} 
                alt={book.title} 
                className="w-full max-h-full object-contain rounded cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setDetailModalBookId(book.id)}
                title="상세 정보 보기"
              />
              
              {/* Action Buttons */}
              <div className="flex gap-1 mt-2">
                {(() => {
                  const hasEbook = book.subInfo?.ebookList?.[0]?.isbn13;
                  const buttonClass = hasEbook 
                    ? "flex-1 px-1 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors text-center whitespace-nowrap"
                    : "w-full px-2 py-1 bg-elevated border border-secondary text-secondary text-xs rounded hover:bg-secondary hover:text-primary transition-colors text-center";
                  
                  return (
                    <>
                      <a 
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
                      )}
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
                    <select
                      value={book.readStatus}
                      onChange={(e) => updateReadStatus(book.id, e.target.value as ReadStatus)}
                      className="input-base text-sm px-3 py-2"
                    >
                      <option value="읽지 않음">읽지 않음</option>
                      <option value="읽는 중">읽는 중</option>
                      <option value="완독">완독</option>
                    </select>
                  )}
                  {settings.showRating && (
                    <StarRating
                      rating={book.rating}
                      onRatingChange={(newRating) => updateRating(book.id, newRating)}
                    />
                  )}
                </div>
              </div>
              
              {/* 구분선 및 "하단 재고 블록" */}
              <hr className="my-3 border-secondary" />
              
              {/* Library Inventory Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {/* 퇴촌lib */}
                <LibraryTag
                  name="퇴촌"
                  totalBooks={book.toechonStock?.total || 0}
                  availableBooks={book.toechonStock?.available || 0}
                  searchUrl={(() => {
                    const subject = createSearchSubject(book.title);
                    return `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${encodeURIComponent(subject)}`;
                  })()}
                />
                
                {/* 기타lib */}
                <LibraryTag
                  name="기타"
                  totalBooks={book.otherStock?.total || 0}
                  availableBooks={book.otherStock?.available || 0}
                  searchUrl={(() => {
                    const subject = createSearchSubject(book.title);
                    return `https://lib.gjcity.go.kr/lay1/program/S1T446C461/jnet/resourcessearch/resultList.do?searchType=SIMPLE&searchKey=TITLE&searchLibrary=ALL&searchKeyword=${encodeURIComponent(subject)}`;
                  })()}
                />
                
                {/* e북.교육 */}
                <LibraryTag
                  name="e교육"
                  totalBooks={book.ebookInfo?.summary.총개수 || 0}
                  availableBooks={book.ebookInfo?.summary.대출가능 || 0}
                  searchUrl={(() => {
                    const processedTitle = createSearchSubject(book.title);
                    return `https://lib.goe.go.kr/elib/module/elib/search/index.do?menu_idx=94&author_name=&viewPage=1&search_text=${encodeURIComponent(processedTitle)}&sortField=book_pubdt&sortType=desc&rowCount=20`;
                  })()}
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
                  searchUrl={(() => {
                    const titleForSearch = (() => {
                      let titleForSearch = book.title;
                      const dashIndex = titleForSearch.indexOf('-');
                      const parenthesisIndex = titleForSearch.indexOf('(');
                      
                      let cutIndex = -1;
                      if (dashIndex !== -1 && parenthesisIndex !== -1) {
                        cutIndex = Math.min(dashIndex, parenthesisIndex);
                      } else if (dashIndex !== -1) {
                        cutIndex = dashIndex;
                      } else if (parenthesisIndex !== -1) {
                        cutIndex = parenthesisIndex;
                      }
                      
                      if (cutIndex !== -1) {
                        titleForSearch = titleForSearch.substring(0, cutIndex).trim();
                      }
                      return titleForSearch.split(' ').slice(0, 3).join(' ');
                    })();
                    return `https://gjcitylib.dkyobobook.co.kr/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent(titleForSearch)}`;
                  })()}
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
                  searchUrl={(() => {
                    const titleForSearch = (() => {
                      let titleForSearch = book.title;
                      const dashIndex = titleForSearch.indexOf('-');
                      const parenthesisIndex = titleForSearch.indexOf('(');
                      
                      let cutIndex = -1;
                      if (dashIndex !== -1 && parenthesisIndex !== -1) {
                        cutIndex = Math.min(dashIndex, parenthesisIndex);
                      } else if (dashIndex !== -1) {
                        cutIndex = dashIndex;
                      } else if (parenthesisIndex !== -1) {
                        cutIndex = parenthesisIndex;
                      }
                      
                      if (cutIndex !== -1) {
                        titleForSearch = titleForSearch.substring(0, cutIndex).trim();
                      }
                      return titleForSearch.split(' ').slice(0, 3).join(' ');
                    })();
                    return `https://lib.gjcity.go.kr:444/elibrary-front/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent(titleForSearch)}`;
                  })()}
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
                  searchUrl={createGyeonggiEbookSearchURL(book.title)}
                />
              </div>
            </div>
          </div>
        )))}
        </div>
      ) : (
        /* Grid View */
        <div className="grid gap-4 max-w-4xl mx-auto" style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
          {sortedAndFilteredLibraryBooks.length === 0 && debouncedSearchQuery.trim().length >= 2 ? (
            <div className="col-span-full text-center text-secondary p-8 bg-secondary rounded-lg shadow-md">
              <h3 className="text-lg font-medium mb-2">검색 결과가 없습니다</h3>
              <p className="text-sm">'{debouncedSearchQuery}' 에 대한 검색 결과를 찾을 수 없습니다.</p>
              <p className="text-sm mt-1">다른 키워드로 검색해보세요.</p>
            </div>
          ) : (
            sortedAndFilteredLibraryBooks.map(book => (
            <div key={book.id} className="bg-elevated rounded-lg p-3 hover-surface transition-colors relative">
              {/* Checkbox */}
              <div className="absolute top-2 left-2">
                <input 
                  type="checkbox" 
                  checked={selectedBooks.has(book.id)}
                  onChange={(e) => {
                    const newSelection = new Set(selectedBooks);
                    if (e.target.checked) {
                      newSelection.add(book.id);
                    } else {
                      newSelection.delete(book.id);
                    }
                    setSelectedBooks(newSelection);
                    setSelectAll(newSelection.size === sortedAndFilteredLibraryBooks.length);
                  }}
                  className="w-4 h-4 text-blue-600 bg-tertiary border-primary rounded focus:ring-blue-500"
                />
              </div>
              
              {/* Book Cover */}
              <div className="text-center mb-3">
                <img 
                  src={book.cover} 
                  alt={book.title} 
                  className="w-full h-32 object-contain rounded mb-2 cursor-pointer hover:opacity-80 transition-opacity"
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
                  <h3 
                    className="text-sm font-bold text-primary line-clamp-2 flex-1 cursor-pointer hover:text-blue-400 transition-colors" 
                    title={book.title}
                    onClick={() => setDetailModalBookId(book.id)}
                  >
                    {book.title.replace(/^\[\w+\]\s*/, '')}
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
                      size="sm"
                    />
                  </div>
                )}
                
                {/* Read Status */}
                {settings.showReadStatus && (
                  <select
                    value={book.readStatus}
                    onChange={(e) => updateReadStatus(book.id, e.target.value as ReadStatus)}
                    className="w-full input-base text-xs px-2 py-1"
                  >
                    <option value="읽지 않음">읽지 않음</option>
                    <option value="읽는 중">읽는 중</option>
                    <option value="완독">완독</option>
                  </select>
                )}
                
                {/* All Library Stock Info */}
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <LibraryTag
                    name="퇴촌"
                    totalBooks={book.toechonStock?.total || 0}
                    availableBooks={book.toechonStock?.available || 0}
                    searchUrl={(() => {
                      const subject = createSearchSubject(book.title);
                      return `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${encodeURIComponent(subject)}`;
                    })()}
                  />
                  <LibraryTag
                    name="기타"
                    totalBooks={book.otherStock?.total || 0}
                    availableBooks={book.otherStock?.available || 0}
                    searchUrl={(() => {
                      const subject = createSearchSubject(book.title);
                      return `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=ES&searchKeyword=${encodeURIComponent(subject)}`;
                    })()}
                  />
                  <LibraryTag
                    name="e교육"
                    totalBooks={book.ebookInfo?.summary.총개수 || 0}
                    availableBooks={book.ebookInfo?.summary.대출가능 || 0}
                    searchUrl={(() => {
                      const processedTitle = createSearchSubject(book.title);
                      return `https://lib.goe.go.kr/elib/module/elib/search/index.do?menu_idx=94&author_name=&viewPage=1&search_text=${encodeURIComponent(processedTitle)}&sortField=book_pubdt&sortType=desc&rowCount=20`;
                    })()}
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
                    searchUrl={(() => {
                      let titleForSearch = book.title;
                      const dashIndex = titleForSearch.indexOf('-');
                      const parenthesisIndex = titleForSearch.indexOf('(');
                      let cutIndex = -1;
                      if (dashIndex !== -1 && parenthesisIndex !== -1) {
                        cutIndex = Math.min(dashIndex, parenthesisIndex);
                      } else if (dashIndex !== -1) {
                        cutIndex = dashIndex;
                      } else if (parenthesisIndex !== -1) {
                        cutIndex = parenthesisIndex;
                      }
                      if (cutIndex !== -1) {
                        titleForSearch = titleForSearch.substring(0, cutIndex).trim();
                      }
                      titleForSearch = titleForSearch.split(' ').slice(0, 3).join(' ');
                      return `https://gjcitylib.dkyobobook.co.kr/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent(titleForSearch)}`;
                    })()}
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
                    searchUrl={(() => {
                      const processedTitle = createSearchSubject(book.title);
                      return `https://ebook.gjcity.go.kr/search/searchList.ink?searchType=SimpleSearch&searchKeyword=${encodeURIComponent(processedTitle)}&searchCategoryCode=all&reSch=true&currentPageNo=1`;
                    })()}
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
                    searchUrl={(() => {
                      const processedTitle = createSearchSubject(book.title);
                      return `https://ebook.library.go.kr/search/searchList.ink?searchType=SimpleSearch&searchKeyword=${encodeURIComponent(processedTitle)}&searchCategoryCode=all&reSch=true&currentPageNo=1`;
                    })()}
                  />
                </div>
              </div>
            </div>
          )))}
        </div>
      )}
      {detailModalBookId && (
        <MyLibraryBookDetailModal 
            bookId={detailModalBookId}
            onClose={() => setDetailModalBookId(null)}
        />
      )}
    </div>
  );
};

export default MyLibrary;
