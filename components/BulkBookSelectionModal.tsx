import React from 'react';
import { AladdinBookItem, BulkSearchResult } from '../types';

interface BulkBookSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchResult: BulkSearchResult | null;
  onSelectBook: (book: AladdinBookItem) => void;
}

const BulkBookSelectionModal: React.FC<BulkBookSelectionModalProps> = ({
  isOpen,
  onClose,
  searchResult,
  onSelectBook
}) => {
  if (!isOpen || !searchResult) return null;

  const handleBookSelect = (book: AladdinBookItem) => {
    onSelectBook(book);
    onClose();
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString() + '원';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] mx-4 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">책 선택</h2>
            <p className="text-sm text-gray-600 mt-1">
              &quot;{searchResult.inputTitle}&quot;에 대한 검색 결과
            </p>
            <p className="text-xs text-gray-500">
              검색어: &quot;{searchResult.searchQuery}&quot;
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
            title="닫기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 검색 결과 목록 */}
        <div className="flex-1 overflow-y-auto p-6">
          {searchResult.searchResults.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {searchResult.searchResults.map((book, index) => (
                <div
                  key={`${book.isbn13}-${index}`}
                  className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleBookSelect(book)}
                >
                  {/* 책 표지 */}
                  <div className="flex-shrink-0">
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="w-16 h-20 object-cover rounded shadow"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder-book.png';
                      }}
                    />
                  </div>

                  {/* 책 정보 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                      {book.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-1">
                      저자: {book.author}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      출판사: {book.publisher}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      출간일: {book.pubDate.split(' ')[0]}
                    </p>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="text-gray-500">ISBN:</span>
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {book.isbn13}
                      </span>
                    </div>
                  </div>

                  {/* 가격 정보 */}
                  <div className="flex-shrink-0 text-right">
                    {book.priceSales !== book.priceStandard && (
                      <p className="text-xs text-gray-500 line-through">
                        {formatPrice(book.priceStandard)}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-blue-600">
                      {formatPrice(book.priceSales)}
                    </p>
                    {book.subInfo?.ebookList && book.subInfo.ebookList.length > 0 && (
                      <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        전자책
                      </span>
                    )}
                  </div>

                  {/* 선택 아이콘 */}
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            총 {searchResult.searchResults.length}개의 결과
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkBookSelectionModal;