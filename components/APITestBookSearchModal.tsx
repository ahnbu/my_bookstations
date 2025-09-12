import React from 'react';
import { AladdinBookItem } from '../types';

interface APITestBookSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchResults: AladdinBookItem[];
  onSelectBook: (book: AladdinBookItem) => void;
}

const APITestBookSearchModal: React.FC<APITestBookSearchModalProps> = ({ 
  isOpen, 
  onClose, 
  searchResults, 
  onSelectBook 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-4 bg-gray-800 rounded-lg shadow-xl flex flex-col z-10">
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <h3 className="text-lg font-bold text-white">📚 검색 결과</h3>
        <button 
          onClick={onClose} 
          className="text-gray-400 hover:text-white transition-colors p-1"
          title="닫기"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        {searchResults.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {searchResults.map((book) => (
              <div
                key={book.isbn13}
                onClick={() => onSelectBook(book)}
                className="bg-gray-700 rounded-lg p-3 flex flex-col items-center text-center cursor-pointer hover:bg-gray-600 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
              >
                <img 
                  src={book.cover.replace('coversum', 'cover')} 
                  alt={book.title} 
                  className="w-20 h-28 object-cover rounded shadow-md mb-3" 
                />
                <h4 className="text-xs font-semibold text-white mb-1 line-clamp-2">{book.title}</h4>
                <p className="text-xs text-gray-400 line-clamp-1">{book.author.replace(/\s*\([^)]*\)/g, '')}</p>
                <p className="text-xs text-gray-500 mt-1">{book.publisher}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">📚</div>
            <p>검색 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default APITestBookSearchModal;