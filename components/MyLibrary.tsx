

import React, { useMemo, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SelectedBook, StockInfo, SortKey, ReadStatus } from '../types';
import { DownloadIcon, TrashIcon, RefreshIcon } from './Icons';
import Spinner from './Spinner';
import { useBookStore } from '../stores/useBookStore';
import { useAuthStore } from '../stores/useAuthStore';
import StarRating from './StarRating';
import MyLibraryBookDetailModal from './MyLibraryBookDetailModal';

const SortArrow: React.FC<{ order: 'asc' | 'desc' }> = ({ order }) => (
  <span className="ml-1 inline-block w-3 h-3 text-xs">
    {order === 'asc' ? '▲' : '▼'}
  </span>
);

const MyLibrary: React.FC = () => {
  const { session } = useAuthStore();
  const {
    myLibraryBooks,
    removeFromLibrary,
    exportToCSV,
    refreshStock,
    refreshingIsbn,
    sortConfig,
    sortLibrary,
    updateReadStatus,
    updateRating,
  } = useBookStore();
  
  const [detailModalBookId, setDetailModalBookId] = useState<number | null>(null);
  
  const createSearchSubject = (title: string): string => {
    const chunks = title.split(' ');
    if (chunks.length <= 3) {
      return title;
    }
    return chunks.slice(0, 3).join(' ');
  };

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

  const rowVirtualizer = useVirtualizer({
    count: sortedLibraryBooks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated height for each row
    overscan: 5, // Render 5 items above and below the visible area
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
    const emoji = available > 0 ? '✔️' : '❌';
    return (
      <span className="flex items-center justify-center whitespace-nowrap">
        <span title={available > 0 ? '대출가능' : '대출불가'} className="mr-2">{emoji}</span>
        {total}({available})
      </span>
    );
  };
  
  const SortButton: React.FC<{ sortKey: SortKey; children: React.ReactNode }> = ({ sortKey, children }) => (
    <button onClick={() => sortLibrary(sortKey)} className={`px-3 py-1 text-sm rounded-full transition-colors duration-200 flex items-center ${sortConfig.key === sortKey ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
      {children}
      {sortConfig.key === sortKey && <SortArrow order={sortConfig.order} />}
    </button>
  );
  
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
        </div>
        <div className="flex items-center gap-x-4 sm:gap-x-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-400 font-medium">정렬:</span>
            <SortButton sortKey="addedDate">추가순</SortButton>
            <SortButton sortKey="title">제목순</SortButton>
            <SortButton sortKey="author">저자순</SortButton>
            <SortButton sortKey="pubDate">출간일순</SortButton>
            <SortButton sortKey="rating">별점순</SortButton>
            <SortButton sortKey="readStatus">읽음순</SortButton>
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
      <div ref={parentRef} className="my-library-table bg-gray-800 rounded-lg shadow-xl overflow-x-auto" style={{ height: `${contentHeight}px`, overflowY: sortedLibraryBooks.length <= 15 ? 'hidden' : 'auto' }}>
        {/* Sticky Header */}
        <div className="flex items-center bg-gray-700 border-b border-gray-600 sticky top-0 z-10" style={{ height: '60px' }}>
          <div className="flex-shrink-0 w-20 p-4 font-semibold text-gray-300">표지</div>
          <div className="flex-1 min-w-0 p-4 font-semibold text-gray-300" style={{ width: '24rem' }}>제목</div>
          <div className="w-40 p-4 font-semibold text-gray-300">저자</div>
          <div className="w-28 p-4 font-semibold text-gray-300">출간일</div>
          <div className="w-32 p-4 font-semibold text-gray-300">읽음</div>
          <div className="w-24 p-4 font-semibold text-gray-300" style={{ width: '8rem' }}>별점</div>
          <div className="w-24 p-4 font-semibold text-gray-300 text-center">퇴촌lib</div>
          <div className="w-24 p-4 font-semibold text-gray-300 text-center">기타lib</div>
          <div className="w-20 p-4 font-semibold text-gray-300 text-center">종이책</div>
          <div className="w-20 p-4 font-semibold text-gray-300 text-center">전자책</div>
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
                {/* Paper Book */}
                 <div className="w-20 p-3 text-center">
                  <a href={book.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      보기
                  </a>
                </div>
                {/* E-book */}
                <div className="w-20 p-3 text-center">
                  {book.subInfo?.ebookList?.[0]?.link ? (
                    <a href={book.subInfo.ebookList[0].link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      보기
                    </a>
                  ) : (
                    <span className="text-gray-500" title="전자책 없음">❌</span>
                  )}
                </div>
                {/* Actions */}
                <div className="w-24 p-3 flex items-center justify-center gap-2">
                  <button
                      onClick={() => refreshingIsbn !== book.isbn13 && refreshStock(book.id, book.isbn13)}
                      disabled={refreshingIsbn === book.isbn13}
                      title="재고 새로고침"
                      className="p-1 rounded-full text-blue-400 hover:text-blue-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-wait transition-colors"
                  >
                      {refreshingIsbn === book.isbn13 ? <Spinner /> : <RefreshIcon className="w-5 h-5" />}
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
