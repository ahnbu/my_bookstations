

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SelectedBook, StockInfo, SortKey, ReadStatus } from '../types';
import { DownloadIcon, TrashIcon, RefreshIcon } from './Icons';
import Spinner from './Spinner';
import { useBookStore } from '../stores/useBookStore';
import { useAuthStore } from '../stores/useAuthStore';
import StarRating from './StarRating';
import MyLibraryBookDetailModal from './MyLibraryBookDetailModal';
import { getStatusEmoji, isEBooksEmpty, hasAvailableEBooks, processBookTitle, processGyeonggiEbookTitle, createGyeonggiEbookSearchURL } from '../services/unifiedLibrary.service';

const SortArrow: React.FC<{ order: 'asc' | 'desc' }> = ({ order }) => (
  <span className="ml-1 inline-block w-3 h-3 text-xs">
    {order === 'asc' ? '▲' : '▼'}
  </span>
);

type ViewType = 'table' | 'grid';

const MyLibrary: React.FC = () => {
  const { session } = useAuthStore();
  const {
    myLibraryBooks,
    removeFromLibrary,
    exportToCSV,
    refreshStock,
    refreshingIsbn,
    refreshEBookInfo,
    refreshingEbookId,
    refreshAllBookInfo,
    sortConfig,
    sortLibrary,
    updateReadStatus,
    updateRating,
  } = useBookStore();
  
  const [detailModalBookId, setDetailModalBookId] = useState<number | null>(null);
  const [viewType, setViewType] = useState<ViewType>('table');
  const [gridColumns, setGridColumns] = useState(5);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  
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

  const sortedLibraryBooks = useMemo(() => {
    const readStatusOrder: Record<ReadStatus, number> = { '완독': 0, '읽는 중': 1, '읽지 않음': 2 };

    return [...myLibraryBooks].sort((a, b) => {
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
  }, [myLibraryBooks, sortConfig]);
  
  const parentRef = useRef<HTMLDivElement>(null);

  // Responsive grid columns
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) setGridColumns(2);
      else if (width < 768) setGridColumns(3);
      else if (width < 1024) setGridColumns(4);
      else if (width < 1280) setGridColumns(5);
      else if (width < 1536) setGridColumns(6);
      else setGridColumns(7);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: sortedLibraryBooks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated height for each row
    overscan: 5, // Render 5 items above and below the visible area
  });

  const gridVirtualizer = useVirtualizer({
    count: Math.ceil(sortedLibraryBooks.length / gridColumns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 316, // Adjusted height for each grid row (300 + 16px vertical spacing)
    overscan: 2,
  });

  // Calculate actual content height for natural sizing
  const contentHeight = useMemo(() => {
    const headerHeight = 60; // Header height
    const actualRowHeight = 72; // Actual row height
    const maxVisibleRows = 15; // Maximum rows to display before enabling scroll
    
    // For small datasets, show all rows naturally
    if (sortedLibraryBooks.length <= maxVisibleRows) {
      const totalRowsHeight = sortedLibraryBooks.length * actualRowHeight;
      return headerHeight + totalRowsHeight;
    }
    
    // For large datasets, use virtualization with controlled height
    return headerHeight + (maxVisibleRows * actualRowHeight);
  }, [sortedLibraryBooks.length]);

  const renderStockCell = (stock?: StockInfo) => {
    if (typeof stock === 'undefined') {
      return <span className="text-xs text-gray-500">확인중...</span>;
    }
    const { total, available } = stock;
    const emoji = available > 0 ? '✔️' : '';
    const emojiClass = available > 0 ? '' : 'text-gray-500 opacity-50';
    const textClass = available > 0 ? '' : 'text-gray-500 opacity-50';
    return (
      <span className="flex items-center justify-center whitespace-nowrap">
        {emoji && <span title={available > 0 ? '대출가능' : '대출불가'} className={`mr-2 ${emojiClass}`}>{emoji}</span>}
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
          className="flex items-center justify-center whitespace-nowrap text-gray-500 opacity-50 hover:text-blue-300"
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
          className="flex items-center justify-center whitespace-nowrap text-gray-500 opacity-50 hover:text-blue-300"
          title="전자책 없음 - 클릭하여 직접 검색"
        >
          0(0)
        </a>
      );
    }

    const availableEmoji = summary.대출가능 > 0 ? '✔️' : '';
    const emojiClass = summary.대출가능 > 0 ? '' : 'text-gray-500 opacity-50';
    const statusTitle = `총 ${summary.총개수}권 (대출가능: ${summary.대출가능}권, 대출불가: ${summary.대출불가}권)`;

    return (
      <a
        href={ebookEduUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center whitespace-nowrap text-blue-400 hover:text-blue-300"
      >
        {availableEmoji && <span className={`mr-2 ${emojiClass}`}>{availableEmoji}</span>}
        {summary.총개수}({summary.대출가능})
      </a>
    );
  };

  const renderSidokEbookCell = (book: SelectedBook) => {
    // e북.시독은 별도의 API가 없으므로 항상 클릭 가능한 링크로 표시
    const titleForSearch = (() => {
      let titleForSearch = book.title;
      const dashIndex = titleForSearch.indexOf('-');
      if (dashIndex !== -1) {
        titleForSearch = titleForSearch.substring(0, dashIndex).trim();
      }
      return titleForSearch.split(' ').slice(0, 3).join(' ');
    })();

    const sidokUrl = `https://gjcitylib.dkyobobook.co.kr/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent(titleForSearch)}`;

    return (
      <a
        href={sidokUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center whitespace-nowrap text-blue-400 hover:text-blue-300"
        title="광주시립도서관 전자책(구독) 검색"
      >
        <span className="mr-2">✔️</span>1(1)
      </a>
    );
  };

  const renderGyeonggiEbookCell = (book: SelectedBook) => {
    const isRefreshing = refreshingEbookId === book.id;
    
    if (isRefreshing) {
      return (
        <div className="flex justify-center">
          <Spinner />
        </div>
      );
    }

    if (!book.gyeonggiEbookInfo) {
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

    if ('error' in book.gyeonggiEbookInfo) {
      return (
        <a
          href={gyeonggiEbookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center whitespace-nowrap text-gray-500 opacity-50 hover:text-blue-300"
          title="조회 실패 - 클릭하여 직접 검색"
        >
          0(0)
        </a>
      );
    }

    const { total_count, available_count } = book.gyeonggiEbookInfo;
    
    if (total_count === 0) {
      return (
        <a
          href={gyeonggiEbookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center whitespace-nowrap text-gray-500 opacity-50 hover:text-blue-300"
          title="전자책 없음 - 클릭하여 직접 검색"
        >
          0(0)
        </a>
      );
    }

    const availableEmoji = available_count > 0 ? '✔️' : '';
    const emojiClass = available_count > 0 ? '' : 'text-gray-500 opacity-50';
    const statusTitle = `총 ${total_count}권 (대출가능: ${available_count}권, 소장형: ${book.gyeonggiEbookInfo.owned_count}권, 구독형: ${book.gyeonggiEbookInfo.subscription_count}권)`;

    return (
      <a
        href={gyeonggiEbookUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center whitespace-nowrap text-blue-400 hover:text-blue-300"
        title={statusTitle}
      >
        {availableEmoji && <span className={`mr-2 ${emojiClass}`}>{availableEmoji}</span>}
        {total_count}({available_count})
      </a>
    );
  };
  
  
  if (!session) {
    return (
      <div className="mt-12 animate-fade-in text-center text-gray-400 p-8 bg-gray-800 rounded-lg shadow-inner">
        <h2 className="text-2xl font-bold mb-4 text-white">내 서재</h2>
        <p>로그인 후 '내 서재' 기능을 사용해보세요.</p>
        <p className="text-sm mt-2">관심있는 책을 저장하고, 여러 기기에서 확인하세요.</p>
      </div>
    );
  }
  
  if (myLibraryBooks.length === 0) {
    return (
       <div className="mt-12 animate-fade-in text-center text-gray-400 p-8 bg-gray-800 rounded-lg shadow-inner">
        <h2 className="text-2xl font-bold mb-4 text-white">내 서재</h2>
        <p>서재가 비어있습니다.</p>
        <p className="text-sm mt-2">책을 검색하고 '내 서재에 추가' 버튼을 눌러 관리해보세요.</p>
      </div>
    );
  }

  return (
    <div className="mt-12 animate-fade-in">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold text-white">내 서재</h2>
          <span className="text-sm text-gray-400 bg-gray-700 px-3 py-1 rounded-full">
            총 {sortedLibraryBooks.length}권
          </span>
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewType('table')}
              className={`p-2 rounded transition-colors duration-200 ${
                viewType === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-600'
              }`}
              title="테이블 보기"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => setViewType('grid')}
              className={`p-2 rounded transition-colors duration-200 ${
                viewType === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-600'
              }`}
              title="그리드 보기"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-x-4 sm:gap-x-6">
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
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              <div className="absolute top-full left-0 mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-20 animate-in fade-in duration-200">
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
                        : 'text-gray-300 hover:bg-gray-600 hover:text-white focus:bg-gray-600'
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
          <button
            onClick={() => exportToCSV(sortedLibraryBooks)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors duration-300"
          >
            <DownloadIcon className="w-5 h-5" />
            <span className="hidden sm:inline">CSV로 내보내기</span>
          </button>
        </div>
      </div>
      
      {viewType === 'table' ? (
        <div ref={parentRef} className="my-library-table bg-gray-800 rounded-lg shadow-xl overflow-x-auto" style={{ height: `${contentHeight}px`, overflowY: sortedLibraryBooks.length <= 15 ? 'hidden' : 'auto' }}>
          {/* Sticky Header */}
          <div className="flex items-center bg-gray-700 border-b border-gray-600 sticky top-0 z-10" style={{ height: '60px' }}>
            <div className="flex-shrink-0 w-20 p-4 font-semibold text-gray-300">표지</div>
            <div className="flex-1 min-w-0 p-4 font-semibold text-gray-300" style={{ width: '24rem' }}>제목</div>
            <div className="w-40 p-4 font-semibold text-gray-300">저자</div>
            <div className="w-28 p-4 font-semibold text-gray-300">출간일</div>
            <div className="w-32 p-4 font-semibold text-gray-300">읽음</div>
            <div className="w-24 p-4 font-semibold text-gray-300" style={{ width: '8rem' }}>별점</div>
            <div className="w-20 p-4 font-semibold text-gray-300 text-center">종이책</div>
            <div className="w-20 p-4 font-semibold text-gray-300 text-center">전자책</div>
            <div className="w-24 p-4 font-semibold text-gray-300 text-center">퇴촌lib</div>
            <div className="w-24 p-4 font-semibold text-gray-300 text-center">기타lib</div>
            <div className="w-24 p-4 font-semibold text-gray-300 text-center">e북.교육</div>
            <div className="w-24 p-4 font-semibold text-gray-300 text-center">e북.시독</div>
            <div className="w-24 p-4 font-semibold text-gray-300 text-center">e북.경기</div>
            <div className="w-24 p-4 font-semibold text-gray-300 text-center">관리</div>
          </div>

          {/* Virtualized Rows */}
          <div
            className="relative"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualItem => {
              const book = sortedLibraryBooks[virtualItem.index];
              if (!book) return null;

              const subject = createSearchSubject(book.title);
              const toechonSearchUrl = `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${encodeURIComponent(subject)}`;
              const otherSearchUrl = `https://lib.gjcity.go.kr/lay1/program/S1T446C461/jnet/resourcessearch/resultList.do?searchType=SIMPLE&searchKey=TITLE&searchLibrary=ALL&searchKeyword=${encodeURIComponent(subject)}`;

              return (
                <div
                  key={book.id}
                  className={`absolute top-0 left-0 w-full flex items-center border-b border-gray-700 hover:bg-gray-700/50 transition-colors duration-200 ${virtualItem.index % 2 === 0 ? 'bg-gray-800/50' : 'bg-gray-800/30'}`}
                  style={{
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {/* Cover */}
                  <div className="flex-shrink-0 w-20 p-3">
                    <img src={book.cover} alt={book.title} className="w-12 h-16 object-cover rounded bg-gray-700" />
                  </div>
                  {/* Title */}
                  <div className="flex-1 min-w-0 p-3 font-medium text-white" style={{ width: '24rem' }}>
                    <button
                      onClick={() => setDetailModalBookId(book.id)}
                      className="text-left hover:text-blue-400 hover:underline truncate block w-full"
                      title={book.title}
                    >
                      {book.title}
                    </button>
                  </div>
                  {/* Author */}
                  <div className="w-40 p-3 text-gray-400 truncate">
                    {book.author.replace(/\s*\([^)]*\)/g, '').split(',')[0]}
                  </div>
                  {/* PubDate */}
                  <div className="w-28 p-3 text-gray-400 truncate" title={book.pubDate}>
                    {book.pubDate.substring(0, 7)}
                  </div>
                  {/* Read Status */}
                  <div className="w-32 p-3">
                    <select
                      value={book.readStatus}
                      onChange={(e) => updateReadStatus(book.id, e.target.value as ReadStatus)}
                      className="bg-gray-700 border-gray-600 text-white text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                    >
                      <option value="읽지 않음">읽지 않음</option>
                      <option value="읽는 중">읽는 중</option>
                      <option value="완독">완독</option>
                    </select>
                  </div>
                  {/* Rating */}
                  <div className="w-24 p-3" style={{ width: '8rem' }}>
                    <StarRating
                      rating={book.rating}
                      onRatingChange={(newRating) => updateRating(book.id, newRating)}
                    />
                  </div>
                  {/* Paper Book */}
                   <div className="w-20 p-3 text-center">
                    <a href={book.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                        보기
                    </a>
                  </div>
                  {/* 기존 전자책 */}
                  <div className="w-20 p-3 text-center">
                    {book.subInfo?.ebookList?.[0]?.link ? (
                      <a href={book.subInfo.ebookList[0].link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                        보기
                      </a>
                    ) : (
                      <span className="text-gray-500 opacity-50" title="전자책 없음">-</span>
                    )}
                  </div>
                  {/* Toechon Stock */}
                  <a
                    href={toechonSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-24 p-3 text-center text-gray-300 hover:bg-gray-700 transition-colors block"
                    title={`퇴촌 도서관에서 '${subject}' 검색`}
                  >
                    {refreshingIsbn === book.isbn13 ? (
                      <div className="flex justify-center"><Spinner/></div>
                    ) : (
                      renderStockCell(book.toechonStock)
                    )}
                  </a>
                  {/* Other Stock */}
                  <a
                    href={otherSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-24 p-3 text-center text-gray-300 hover:bg-gray-700 transition-colors block"
                    title={`광주시립도서관에서 '${subject}' 검색`}
                  >
                    {refreshingIsbn === book.isbn13 ? (
                      <div className="flex justify-center"><Spinner/></div>
                    ) : (
                      renderStockCell(book.otherStock)
                    )}
                  </a>
                  {/* e북.교육 정보 */}
                  <div className="w-24 p-3 text-center text-gray-300">
                    {refreshingEbookId === book.id ? (
                      <div className="flex justify-center"><Spinner/></div>
                    ) : (
                      renderEBookCell(book)
                    )}
                  </div>
                  {/* e북.시독 정보 */}
                  <div className="w-24 p-3 text-center text-gray-300">
                    {renderSidokEbookCell(book)}
                  </div>
                  {/* e북.경기 정보 */}
                  <div className="w-24 p-3 text-center text-gray-300">
                    {renderGyeonggiEbookCell(book)}
                  </div>
                  {/* Actions */}
                  <div className="w-24 p-3 flex items-center justify-center gap-2">
                    <button
                        onClick={() => refreshAllBookInfo(book.id, book.isbn13, book.title)}
                        disabled={refreshingIsbn === book.isbn13 || refreshingEbookId === book.id}
                        title="전체 정보 새로고침"
                        className="p-1 rounded-full text-blue-400 hover:text-blue-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-wait transition-colors"
                    >
                        {(refreshingIsbn === book.isbn13 || refreshingEbookId === book.id) ? <Spinner /> : <RefreshIcon className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`'${book.title}'을(를) 서재에서 삭제하시겠습니까?`)) {
                          removeFromLibrary(book.id);
                        }
                      }}
                      title="서재에서 삭제"
                      className="p-1 rounded-full text-red-500 hover:text-red-400 hover:bg-gray-700 transition-colors"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div ref={parentRef} className="bg-gray-800 rounded-lg shadow-xl p-4" style={{ height: '80vh', overflowY: 'auto' }}>
          <div
            className="relative"
            style={{
              height: `${gridVirtualizer.getTotalSize()}px`,
            }}
          >
            {gridVirtualizer.getVirtualItems().map(virtualItem => {
              const startIndex = virtualItem.index * gridColumns;
              const rowBooks = sortedLibraryBooks.slice(startIndex, startIndex + gridColumns);

              return (
                <div
                  key={virtualItem.index}
                  className="absolute top-0 left-0 w-full"
                  style={{
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                    paddingBottom: '16px', // Add vertical spacing between rows (equivalent to gap-4)
                  }}
                >
                  <div 
                    className="grid gap-4 h-full"
                    style={{
                      gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                    }}
                  >
                    {rowBooks.map(book => {
                      const getReadStatusBadge = (status: ReadStatus) => {
                        const statusStyles = {
                          '읽지 않음': 'bg-gray-600 text-gray-300',
                          '읽는 중': 'bg-yellow-600 text-yellow-100',
                          '완독': 'bg-green-600 text-green-100'
                        };
                        return (
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${statusStyles[status]}`}>
                            {status}
                          </span>
                        );
                      };

                      return (
                        <div
                          key={book.id}
                          className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-all duration-200 cursor-pointer transform hover:scale-105 flex flex-col h-full min-h-[260px]"
                          onClick={() => setDetailModalBookId(book.id)}
                        >
                          {/* Book Cover */}
                          <div className="flex justify-center mb-3">
                            <img 
                              src={book.cover} 
                              alt={book.title} 
                              className="w-20 h-28 sm:w-24 sm:h-32 object-cover rounded shadow-md bg-gray-600" 
                            />
                          </div>

                          {/* Book Info */}
                          <div className="flex-1 flex flex-col">
                            {/* Title */}
                            <h3 
                              className="text-white font-medium text-sm mb-2 hover:text-blue-400 transition-colors"
                              style={{ 
                                height: '2.5rem', 
                                lineHeight: '1.25rem',
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={book.title}
                            >
                              {book.title}
                            </h3>

                            {/* Publication Date */}
                            <p className="text-gray-400 text-xs mb-2">
                              {book.pubDate.substring(0, 7)}
                            </p>

                            {/* Read Status Badge */}
                            <div className="mb-2">
                              {getReadStatusBadge(book.readStatus)}
                            </div>

                            {/* E-book Info */}
                            <div className="mb-1">
                              {book.ebookInfo ? (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">전자책:</span>
                                  <span className={`${book.ebookInfo.summary.대출가능 > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                    {book.ebookInfo.summary.총개수 > 0 
                                      ? `${book.ebookInfo.summary.총개수}권(${book.ebookInfo.summary.대출가능})`
                                      : '없음'
                                    }
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">전자책:</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      refreshEBookInfo(book.id, book.isbn13, book.title);
                                    }}
                                    className="text-blue-400 hover:text-blue-300"
                                    disabled={refreshingEbookId === book.id}
                                  >
                                    {refreshingEbookId === book.id ? '로딩...' : '조회'}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Star Rating */}
                            <div className="mt-auto">
                              <StarRating
                                rating={book.rating}
                                onRatingChange={(newRating) => {
                                  updateRating(book.id, newRating);
                                }}
                                size="sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
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
