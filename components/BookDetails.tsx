
import React, { useMemo } from 'react';
import { PlusIcon, ArrowLeftIcon, BookOpenIcon, RefreshIcon } from './Icons';
import { useBookStore } from '../stores/useBookStore';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';
import { SelectedBook, ReadStatus, StockInfo } from '../types';
import { generateLibraryDetailURL, isLibraryStockClickable } from '../services/unifiedLibrary.service';
import StarRating from './StarRating';
import Spinner from './Spinner';

const createSearchSubject = (title: string): string => {
  const chunks = title.split(' ');
  if (chunks.length <= 3) {
    return title;
  }
  return chunks.slice(0, 3).join(' ');
};

const renderStockInfo = (libraryName: string, stock?: StockInfo, bookTitle: string, detailedStockInfo?: any) => {
    if (!stock) {
        return <div className="flex justify-between items-center"><span>{libraryName}:</span> <span className="text-gray-500">정보 없음</span></div>;
    }
    const { total, available } = stock;
    const statusColor = available > 0 ? 'text-green-400' : 'text-red-400';
    const statusText = available > 0 ? '대출가능' : '대출불가';
    
    const subject = createSearchSubject(bookTitle);
    let searchUrl = '';
    let searchTitle = '';
    
    // 퇴촌도서관의 경우 상세 재고 정보에서 URL 파라미터 확인
    if (libraryName === '퇴촌 도서관' && detailedStockInfo?.gwangju_paper?.availability) {
        const toechonItem = detailedStockInfo.gwangju_paper.availability.find((item: any) => 
            item.소장도서관 === '퇴촌도서관' && 
            item.recKey && 
            item.bookKey && 
            item.publishFormCode
        );
        
        if (toechonItem) {
            searchUrl = generateLibraryDetailURL(toechonItem.recKey, toechonItem.bookKey, toechonItem.publishFormCode);
            searchTitle = `퇴촌도서관 상세 페이지로 이동`;
            console.log('퇴촌도서관 상세 URL 생성:', searchUrl);
        } else {
            // 파라미터가 없으면 향상된 검색 URL 사용 (제목 + 저자)
            const authorName = bookTitle.includes(' - ') ? '' : ` ${bookTitle.split(' by ')[1] || ''}`.trim();
            const enhancedKeyword = authorName ? `${subject} ${authorName}` : subject;
            searchUrl = `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${encodeURIComponent(enhancedKeyword)}`;
            searchTitle = `퇴촌 도서관에서 '${enhancedKeyword}' 검색`;
            console.log('퇴촌도서관 URL 파라미터 없음, 향상된 검색 URL 사용:', enhancedKeyword);
        }
    } else if (libraryName === '기타 도서관') {
        searchUrl = `https://lib.gjcity.go.kr/lay1/program/S1T446C461/jnet/resourcessearch/resultList.do?searchType=SIMPLE&searchKey=TITLE&searchLibrary=ALL&searchKeyword=${encodeURIComponent(subject)}`;
        searchTitle = `광주시립도서관에서 '${subject}' 검색`;
    }

    return (
        <div className="flex justify-between items-center">
            <span>{libraryName}:</span>
            {searchUrl ? (
                <a
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`font-medium ${statusColor} hover:text-blue-400 hover:underline cursor-pointer transition-colors`}
                    title={`${searchTitle} - ${statusText} ${available}권, 총 ${total}권 소장`}
                >
                    {available} / {total}
                </a>
            ) : (
                <span className={`font-medium ${statusColor}`} title={`${statusText} ${available}권, 총 ${total}권 소장`}>
                    {available} / {total}
                </span>
            )}
        </div>
    );
};


const BookDetails: React.FC = () => {
  const {
    selectedBook,
    addToLibrary,
    myLibraryBooks,
    unselectBook,
    updateReadStatus,
    updateRating,
    refreshStock,
    refreshingIsbn,
  } = useBookStore();
  const { session } = useAuthStore();
  const { openBookModal } = useUIStore();
  
  const isBookInLibrary = useMemo(() => {
    if (!selectedBook) return false;
    return myLibraryBooks.some(b => b.isbn13 === selectedBook.isbn13);
  }, [selectedBook, myLibraryBooks]);

  if (!selectedBook) {
    return (
      <div className="text-center text-gray-500 mt-16 p-8 bg-gray-800/50 rounded-lg shadow-inner">
        <p className="text-lg">검색 후 도서를 선택하거나, 내 서재의 도서 제목을 클릭해주세요.</p>
        <p className="mt-2 text-sm">책 제목을 입력하고 검색 버튼을 누르면, 검색 결과가 팝업으로 표시됩니다.</p>
      </div>
    );
  }

  const isFromLibrary = 'id' in selectedBook;
  const bookFromLibrary = isFromLibrary ? (selectedBook as SelectedBook) : null;
  
  const handleAddClick = () => {
    addToLibrary();
  }
  
  const handleBackToList = () => {
    unselectBook();
    openBookModal();
  };

  return (
    <div className="mt-8 p-6 bg-gray-800 rounded-lg shadow-xl animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 flex justify-center items-start">
          <img src={selectedBook.cover.replace('coversum', 'cover')} alt={selectedBook.title} className="w-48 h-auto object-cover rounded-lg shadow-lg bg-gray-700" />
        </div>
        <div className="md:col-span-2 text-gray-200">
          <h2 className="text-3xl font-bold text-white mb-2">{selectedBook.title}</h2>
          <p className="text-lg text-gray-300 mb-1"><strong>저자:</strong> {selectedBook.author.replace(/\s*\([^)]*\)/g, '')}</p>
          <p className="text-md text-gray-400 mb-1"><strong>출판사:</strong> {selectedBook.publisher}</p>
          <p className="text-md text-gray-400 mb-1"><strong>출간일:</strong> {selectedBook.pubDate}</p>
          <p className="text-md text-gray-400 mb-1"><strong>ISBN:</strong> {selectedBook.isbn13}</p>
          {selectedBook.subInfo?.ebookList?.[0]?.isbn13 && (
            <p className="text-md text-gray-400 mb-4"><strong>ISBN:</strong> {selectedBook.subInfo.ebookList[0].isbn13} (전자책)</p>
          )}
          
          <div className="flex items-baseline mb-4">
             <p className="text-2xl font-bold text-blue-400">{selectedBook.priceSales.toLocaleString()}원</p>
             <p className="text-md text-gray-500 line-through ml-3">{selectedBook.priceStandard.toLocaleString()}원</p>
          </div>

          <p className="text-sm text-gray-400 leading-relaxed mb-6">{selectedBook.description || "제공된 설명이 없습니다."}</p>
          
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <button
              onClick={handleAddClick}
              disabled={!session || isBookInLibrary}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {!session ? (
                '로그인 후 추가'
              ) : isBookInLibrary ? (
                '추가 완료'
              ) : (
                <>
                  <PlusIcon className="w-5 h-5" />
                  내 서재 추가
                </>
              )}
            </button>
             <button
              onClick={handleBackToList}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors duration-300"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              검색결과로
            </button>
            <a
              href={selectedBook.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors duration-300"
            >
              <BookOpenIcon className="w-5 h-5" />
              알라딘 보기
            </a>
            {selectedBook.subInfo?.ebookList?.[0]?.link && (
              <a
                href={selectedBook.subInfo.ebookList[0].link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 transition-colors duration-300"
              >
                <BookOpenIcon className="w-5 h-5" />
                전자책 보기
              </a>
            )}
          </div>
        </div>
      </div>
      {isFromLibrary && bookFromLibrary && (
            <div className="mt-8 pt-6 border-t border-gray-700">
                <h3 className="text-2xl font-bold text-white mb-4">내 서재 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-900/50 rounded-lg p-6">
                    {/* Left side: Status & Rating */}
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">읽음 상태</label>
                            <select
                                value={bookFromLibrary.readStatus}
                                onChange={(e) => updateReadStatus(bookFromLibrary.id, e.target.value as ReadStatus)}
                                className="bg-gray-700 border-gray-600 text-white text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            >
                                <option value="읽지 않음">읽지 않음</option>
                                <option value="읽는 중">읽는 중</option>
                                <option value="완독">완독</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">나의 별점</label>
                            <StarRating
                                rating={bookFromLibrary.rating}
                                onRatingChange={(newRating) => updateRating(bookFromLibrary.id, newRating)}
                            />
                        </div>
                    </div>
                    {/* Right side: Stock Info */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                             <h4 className="text-lg font-semibold text-white">도서관 재고 현황</h4>
                             <button
                                onClick={() => refreshingIsbn !== bookFromLibrary.isbn13 && refreshStock(bookFromLibrary.id, bookFromLibrary.isbn13)}
                                disabled={refreshingIsbn === bookFromLibrary.isbn13}
                                className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                title="재고 새로고침"
                             >
                                {refreshingIsbn === bookFromLibrary.isbn13 ? <Spinner /> : <RefreshIcon className="w-5 h-5" />}
                             </button>
                        </div>
                        <div className="space-y-2 text-sm text-gray-300 bg-gray-800 p-4 rounded-md">
                            {renderStockInfo('퇴촌 도서관', bookFromLibrary.toechonStock, bookFromLibrary.title, bookFromLibrary.detailedStockInfo)}
                            {renderStockInfo('기타 도서관', bookFromLibrary.otherStock, bookFromLibrary.title, bookFromLibrary.detailedStockInfo)}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default BookDetails;
