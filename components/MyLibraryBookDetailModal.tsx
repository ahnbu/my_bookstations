
import React, { useEffect } from 'react';
import { ReadStatus, StockInfo } from '../types';
import { useBookStore } from '../stores/useBookStore';
import { CloseIcon, RefreshIcon } from './Icons';
import Spinner from './Spinner';
import StarRating from './StarRating';

interface MyLibraryBookDetailModalProps {
  bookId: number;
  onClose: () => void;
}

const renderStockInfo = (libraryName: string, stock?: StockInfo) => {
    if (typeof stock === 'undefined') {
        return <div className="flex justify-between items-center"><span>{libraryName}:</span> <div className="flex items-center gap-2"><Spinner /><span className="text-gray-400">확인중...</span></div></div>;
    }
    if (!stock) {
        return <div className="flex justify-between items-center"><span>{libraryName}:</span> <span className="text-gray-500">정보 없음</span></div>;
    }
    const { total, available } = stock;
    const statusColor = available > 0 ? 'text-green-400' : 'text-red-400';
    const statusText = available > 0 ? '대출가능' : '대출불가';

    return (
        <div className="flex justify-between items-center" title={`${statusText} ${available}권, 총 ${total}권 소장`}>
            <span>{libraryName}:</span>
            <span className={`font-mono font-bold ${statusColor}`}>
                {available} / {total}
            </span>
        </div>
    );
};


const MyLibraryBookDetailModal: React.FC<MyLibraryBookDetailModalProps> = ({ bookId, onClose }) => {
    const { updateReadStatus, updateRating, refreshStock, refreshingIsbn } = useBookStore();
    const book = useBookStore(state => state.myLibraryBooks.find(b => b.id === bookId));

    // If the book is deleted while the modal is open, close the modal.
    useEffect(() => {
        if (!book) {
            onClose();
        }
    }, [book, onClose]);

    if (!book) return null; // Render nothing while closing or if book not found

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-fade-in">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                  <h2 className="text-xl font-bold text-white truncate pr-8" title={book.title}>{book.title} - 상세 정보</h2>
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
                          <p className="text-md text-gray-400 mb-4"><strong>출간일:</strong> {book.pubDate}</p>
                          
                          <div className="flex items-baseline mb-4">
                             <p className="text-2xl font-bold text-blue-400">{book.priceSales.toLocaleString()}원</p>
                             <p className="text-md text-gray-500 line-through ml-3">{book.priceStandard.toLocaleString()}원</p>
                          </div>

                          <p className="text-sm text-gray-400 leading-relaxed mb-6 line-clamp-4">{book.description || "제공된 설명이 없습니다."}</p>
                        </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-gray-700">
                        <h3 className="text-2xl font-bold text-white mb-4">내 서재 정보</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-900/50 rounded-lg p-6">
                            {/* Left side: Status & Rating */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">나의 별점</label>
                                    <StarRating
                                        rating={book.rating}
                                        onRatingChange={(newRating) => updateRating(book.id, newRating)}
                                    />
                                </div>
                                <div>
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
                            {/* Right side: Stock Info */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                     <h4 className="text-lg font-semibold text-white">도서관 재고 현황</h4>
                                     <button
                                        onClick={() => refreshingIsbn !== book.isbn13 && refreshStock(book.id, book.isbn13)}
                                        disabled={refreshingIsbn === book.isbn13}
                                        className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                        title="재고 새로고침"
                                     >
                                        {refreshingIsbn === book.isbn13 ? <Spinner /> : <RefreshIcon className="w-5 h-5" />}
                                     </button>
                                </div>
                                <div className="space-y-2 text-sm text-gray-300 bg-gray-800 p-4 rounded-md">
                                    {renderStockInfo('퇴촌 도서관', book.toechonStock)}
                                    {renderStockInfo('기타 도서관', book.otherStock)}
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
