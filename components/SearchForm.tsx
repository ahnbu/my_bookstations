import React, { useState, useEffect } from 'react';
import { SearchIcon } from './Icons';
import Spinner from './Spinner';
import { useBookStore } from '../stores/useBookStore';
import { useUIStore } from '../stores/useUIStore';
import { addHomeResetListener } from '../utils/events';

const SearchForm: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('Keyword');

  // 1. searchBooks 액션만 구독
  const searchBooks = useBookStore((state) => state.searchBooks);
  const isLoading = useUIStore((state) => state.isLoading);

  // 홈 리셋 이벤트 구독
  useEffect(() => {
    const cleanup = addHomeResetListener(() => {
      // 검색 폼 초기화
      setQuery('');
      setSearchType('Keyword');
    });

    return cleanup;
  }, []);

  // 2. handleSubmit 함수 교체
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      await searchBooks(query.trim(), searchType);

      // 검색 완료 후, store의 최신 상태를 직접 조회하여 모달을 엽니다.
      if (useBookStore.getState().searchResults.length > 0) {
        useUIStore.getState().openBookSearchListModal();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="relative flex-shrink-0">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="h-12 py-3 pl-4 pr-10 bg-elevated border-primary rounded-full text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-shadow duration-300"
            disabled={isLoading}
            aria-label="Search Type"
          >
            <option value="Keyword">전체</option>
            <option value="Title">제목</option>
            <option value="Author">저자</option>
            <option value="Publisher">출판사</option>
          </select>
           <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-tertiary">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>
        <div className="relative flex-grow">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="도서관 책을 찾고, 내 서재에 추가하세요 (제목, 저자명 검색)"
              className="h-12 py-3 pl-4 pr-12 w-full bg-elevated border-primary rounded-full text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-shadow duration-300"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-tertiary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
              aria-label="Search"
            >
              {isLoading ? <Spinner /> : <SearchIcon className="w-6 h-6" />}
            </button>
        </div>
      </div>
    </form>
  );
};

export default SearchForm;