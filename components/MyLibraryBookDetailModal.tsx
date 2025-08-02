
import React, { useEffect } from 'react';
import { ReadStatus, StockInfo } from '../types';
import { useBookStore } from '../stores/useBookStore';
import { CloseIcon, RefreshIcon, BookOpenIcon } from './Icons';
import Spinner from './Spinner';
import StarRating from './StarRating';
import { getStatusClass, getStatusEmoji, processBookTitle } from '../services/unifiedLibrary.service';

// Use the standardized title processing function from ebook.service
const createSearchSubject = processBookTitle;

interface MyLibraryBookDetailModalProps {
  bookId: number;
  onClose: () => void;
}

const renderStockInfo = (libraryName: string, stock?: StockInfo, bookTitle: string) => {
    if (typeof stock === 'undefined') {
        return <div className="flex justify-between items-center"><span>{libraryName}:</span> <div className="flex items-center gap-2"><Spinner /><span className="text-gray-400">확인중...</span></div></div>;
    }
    if (!stock) {
        return <div className="flex justify-between items-center"><span>{libraryName}:</span> <span className="text-gray-500">정보 없음</span></div>;
    }
    const { total, available } = stock;
    const statusColor = available > 0 ? 'text-green-400' : 'text-red-400';
    const statusText = available > 0 ? '대출가능' : '대출불가';
    
    const subject = createSearchSubject(bookTitle);
    let searchUrl = '';
    let searchTitle = '';
    
    if (libraryName === '퇴촌 도서관') {
        searchUrl = `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${encodeURIComponent(subject)}`;
        searchTitle = `퇴촌 도서관에서 '${subject}' 검색`;
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


const MyLibraryBookDetailModal: React.FC<MyLibraryBookDetailModalProps> = ({ bookId, onClose }) => {
    const { updateReadStatus, updateRating, refreshStock, refreshingIsbn, refreshEBookInfo, refreshingEbookId, refreshAllBookInfo } = useBookStore();
    const book = useBookStore(state => state.myLibraryBooks.find(b => b.id === bookId));

    // If the book is deleted while the modal is open, close the modal.
    useEffect(() => {
        if (!book) {
            onClose();
        }
    }, [book, onClose]);

    if (!book) return null; // Render nothing while closing or if book not found

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    };

    const hasEbookLink = book.subInfo?.ebookList?.[0]?.link;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-fade-in">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                  <h2 className="text-xl font-bold text-white truncate pr-8">도서 상세 정보</h2>
                  <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 flex justify-center items-start">
                          <img src={book.cover.replace('coversum', 'cover')} alt={book.title} className="w-48 h-auto object-cover rounded-lg shadow-lg bg-gray-700" />
                        </div>
                        <div className="md:col-span-2 text-gray-200">
                          <h3 className="text-2xl font-bold text-white mb-2">{book.title}</h3>
                          <p className="text-lg text-gray-300 mb-1"><strong>저자:</strong> {book.author.replace(/\s*\([^)]*\)/g, '')}</p>
                          <p className="text-md text-gray-400 mb-1"><strong>출판사:</strong> {book.publisher}</p>
                          <p className="text-md text-gray-400 mb-1"><strong>출간일:</strong> {book.pubDate}</p>
                          <p className="text-md text-gray-400 mb-4"><strong>ISBN:</strong> {book.isbn13}</p>
                          
                          <div className="flex items-baseline mb-4">
                             <p className="text-2xl font-bold text-blue-400">{book.priceSales.toLocaleString()}원</p>
                             <p className="text-md text-gray-500 line-through ml-3">{book.priceStandard.toLocaleString()}원</p>
                          </div>

                          <p className="text-sm text-gray-400 leading-relaxed mb-6 line-clamp-4">{book.description || "제공된 설명이 없습니다."}</p>
                          
                          <div className="flex flex-wrap gap-4">
                            <a
                              href={book.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors duration-300"
                            >
                              <BookOpenIcon className="w-5 h-5" />
                              알라딘 보기
                            </a>
                            <a
                              href={hasEbookLink || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => !hasEbookLink && e.preventDefault()}
                              className={`inline-flex items-center justify-center gap-2 px-5 py-2 bg-sky-500 text-white font-semibold rounded-lg transition-colors duration-300 ${
                                !hasEbookLink ? 'opacity-50 cursor-not-allowed' : 'hover:bg-sky-600'
                              }`}
                              title={!hasEbookLink ? "알라딘에서 제공하는 전자책 정보가 없습니다" : "알라딘에서 전자책 보기"}
                            >
                              <BookOpenIcon className="w-5 h-5" />
                              전자책 보기
                            </a>
                          </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-gray-700">
                        <h3 className="text-2xl font-bold text-white mb-4">내 서재 정보</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-gray-900/50 rounded-lg p-6">
                            {/* Left side: Status & Rating */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">나의 별점</label>
                                    <StarRating
                                        rating={book.rating}
                                        onRatingChange={(newRating) => updateRating(book.id, newRating)}
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">읽음 상태</label>
                                    <select
                                        value={book.readStatus}
                                        onChange={(e) => updateReadStatus(book.id, e.target.value as ReadStatus)}
                                        className="bg-gray-700 border-gray-600 text-white text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                    >
                                        <option value="읽지 않음">읽지 않음</option>
                                        <option value="읽는 중">읽는 중</option>
                                        <option value="완독">완독</option>
                                    </select>
                                </div>
                            </div>
                            
                            {/* Middle: Paper Book Stock Info */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                     <h4 className="text-lg font-semibold text-white">종이책 재고</h4>
                                     <button
                                        onClick={() => refreshAllBookInfo(book.id, book.isbn13, book.title)}
                                        disabled={refreshingIsbn === book.isbn13 || refreshingEbookId === book.id}
                                        className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                        title="전체 정보 새로고침"
                                     >
                                        {(refreshingIsbn === book.isbn13 || refreshingEbookId === book.id) ? <Spinner /> : <RefreshIcon className="w-5 h-5" />}
                                     </button>
                                </div>
                                <div className="space-y-2 text-sm text-gray-300 bg-gray-800 p-4 rounded-md">
                                    {renderStockInfo('퇴촌 도서관', book.toechonStock, book.title)}
                                    {renderStockInfo('기타 도서관', book.otherStock, book.title)}
                                </div>
                            </div>

                            {/* Right side: EBook Info */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-lg font-semibold text-white">전자책 정보</h4>
                                    <button
                                        onClick={() => refreshEBookInfo(book.id, book.isbn13, book.title)}
                                        disabled={refreshingEbookId === book.id}
                                        className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                        title="전자책 정보 새로고침"
                                    >
                                        {refreshingEbookId === book.id ? <Spinner /> : <RefreshIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                                <div className="bg-gray-800 p-4 rounded-md">
                                    {book.ebookInfo ? (
                                        <div className="space-y-3">
                                            {/* Summary */}
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">총 보유:</span>
                                                    <span className="text-white">{book.ebookInfo.summary.총개수}권</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">대출 가능:</span>
                                                    <span className="text-green-400">{book.ebookInfo.summary.대출가능}권</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">대출 불가:</span>
                                                    <span className="text-red-400">{book.ebookInfo.summary.대출불가}권</span>
                                                </div>
                                                {book.ebookInfo.summary.오류개수 > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">조회 오류:</span>
                                                        <span className="text-yellow-400">{book.ebookInfo.summary.오류개수}개</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Detailed results */}
                                            {book.ebookInfo.details.length > 0 && (
                                                <div className="border-t border-gray-600 pt-3 space-y-2">
                                                    <h5 className="text-sm font-medium text-gray-300">상세 정보:</h5>
                                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                                        {book.ebookInfo.details.map((item, index) => (
                                                            <div key={index} className="text-xs">
                                                                {'error' in item ? (
                                                                    <div className="text-red-400 p-2 bg-red-900/20 rounded">
                                                                        ❌ {item.error}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex justify-between items-center p-2 bg-gray-700/50 rounded">
                                                                        <div>
                                                                            <div className="font-medium text-white truncate">
                                                                                {item.도서명}
                                                                            </div>
                                                                            <div className="text-gray-400">
                                                                                {item.소장도서관} | {item.저자}
                                                                            </div>
                                                                        </div>
                                                                        <span className={`text-xs px-2 py-1 rounded ${
                                                                            item.대출상태 === '대출가능' 
                                                                                ? 'bg-green-600 text-green-100' 
                                                                                : 'bg-red-600 text-red-100'
                                                                        }`}>
                                                                            {getStatusEmoji(item.대출상태)} {item.대출상태}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="text-xs text-gray-500 pt-2 border-t border-gray-600">
                                                {formatDate(book.ebookInfo.lastUpdated)} 기준
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-400 py-4">
                                            <p className="mb-2">전자책 정보가 없습니다</p>
                                            <button
                                                onClick={() => refreshEBookInfo(book.id, book.isbn13, book.title)}
                                                className="text-blue-400 hover:text-blue-300 text-sm underline"
                                                disabled={refreshingEbookId === book.id}
                                            >
                                                {refreshingEbookId === book.id ? '조회중...' : '지금 조회하기'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyLibraryBookDetailModal;
