import React from 'react';
import { CloseIcon } from './Icons';
import { useBookStore } from '../stores/useBookStore';
import { useUIStore } from '../stores/useUIStore';

const BookSearchListModal: React.FC = () => {
  const { isBookSearchListModalOpen, closeBookSearchListModal } = useUIStore();
  const { searchResults, selectBook } = useBookStore();

  if (!isBookSearchListModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">도서 검색 결과</h2>
          <button onClick={closeBookSearchListModal} className="text-gray-400 hover:text-white">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {searchResults.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {searchResults.map((book) => (
                <li
                  key={book.isbn13}
                  onClick={() => selectBook(book)}
                  className="bg-gray-700 rounded-lg p-4 flex flex-col items-center text-center cursor-pointer hover:bg-gray-600 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300"
                >
                  <img src={book.cover.replace('coversum', 'cover')} alt={book.title} className="w-32 h-48 object-cover rounded shadow-md mb-4" />
                  <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2">{book.title}</h3>
                  <p className="text-xs text-gray-400 line-clamp-2">{book.author.replace(/\s*\([^)]*\)/g, '')}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-400 py-8">검색 결과가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookSearchListModal;