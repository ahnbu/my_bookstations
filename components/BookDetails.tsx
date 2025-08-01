

import React, { useEffect, useMemo } from 'react';
import { PlusIcon, ArrowLeftIcon, BookOpenIcon } from './Icons';
import LibraryStock from './LibraryStock';
import Spinner from './Spinner';
import { useBookStore } from '../stores/useBookStore';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';

const BookDetails: React.FC = () => {
  const {
    selectedBook,
    addToLibrary,
    myLibraryBooks,
    libraryStock,
    fetchLibraryStock,
    unselectBook,
  } = useBookStore();
  const { session } = useAuthStore();
  const { isLibraryStockLoading, libraryStockError, openBookModal } = useUIStore();
  
  const isBookInLibrary = useMemo(() => {
    if (!selectedBook) return false;
    return myLibraryBooks.some(b => b.isbn13 === selectedBook.isbn13);
  }, [selectedBook, myLibraryBooks]);

  useEffect(() => {
    if (selectedBook?.isbn13) {
      fetchLibraryStock(selectedBook.isbn13);
    }
  }, [selectedBook, fetchLibraryStock]);

  if (!selectedBook) {
    return (
      <div className="text-center text-gray-500 mt-16 p-8 bg-gray-800/50 rounded-lg shadow-inner">
        <p className="text-lg">검색 후 도서를 선택해주세요.</p>
        <p className="mt-2 text-sm">책 제목을 입력하고 검색 버튼을 누르면, 검색 결과가 팝업으로 표시됩니다.</p>
      </div>
    );
  }
  
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
          <p className="text-md text-gray-400 mb-4"><strong>출간일:</strong> {selectedBook.pubDate}</p>
          
          <div className="flex items-baseline mb-4">
             <p className="text-2xl font-bold text-blue-400">{selectedBook.priceSales.toLocaleString()}원</p>
             <p className="text-md text-gray-500 line-through ml-3">{selectedBook.priceStandard.toLocaleString()}원</p>
          </div>

          <p className="text-sm text-gray-400 leading-relaxed mb-6">{selectedBook.description || "제공된 설명이 없습니다."}</p>
          
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <a href={selectedBook.link} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-300">
                <BookOpenIcon className="w-5 h-5" />
                알라딘 보기
            </a>
            <button
              onClick={handleAddClick}
              disabled={!session || isBookInLibrary || isLibraryStockLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLibraryStockLoading ? (
                <>
                  <Spinner />
                  재고 확인중...
                </>
              ) : !session ? (
                '로그인 후 추가'
              ) : isBookInLibrary ? (
                '서재에 있음'
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
              뒤로가기
            </button>
          </div>
        </div>
      </div>
      <LibraryStock 
        stock={libraryStock}
        isLoading={isLibraryStockLoading}
        error={libraryStockError}
      />
    </div>
  );
};

export default BookDetails;