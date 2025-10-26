import React, { useState } from 'react';
import { useUIStore } from '../stores/useUIStore';
import { CloseIcon, SearchIcon } from './Icons';
import Spinner from './Spinner';
// [추가] createLibraryOpenURL과 LibraryName 타입을 import
import { createLibraryOpenURL } from '../services/unifiedLibrary.service';
import { LibraryName } from '../types';

interface SearchResult {
  type: '종이책' | '전자책';
  libraryName: '퇴촌' | '기타' | 'e교육' | 'e시립구독' | 'e시립소장' | 'e경기';
  title: string;
  author: string;
  publisher: string; // [추가]
  pubDate: string;
  isAvailable: boolean;
}

type SortKey = 'libraryName' | 'type' | 'title' | 'author' | 'pubDate' | 'isAvailable';

// type SortKey = 'libraryName' | 'type' | 'title' | 'author' | 'publisher' | 'pubDate' | 'isAvailable';
// type SortKey = 'libraryName' | 'type' | 'title' | 'author' | 'pubDate' | 'isAvailable';
type SortOrder = 'asc' | 'desc';

const KeywordSearchModal: React.FC = () => {
  const { isKeywordSearchModalOpen, closeKeywordSearchModal } = useUIStore();
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('libraryName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  if (!isKeywordSearchModalOpen) return null;

  const handleSearch = async () => {
    if (!keyword.trim()) {
      setErrorMessage('검색할 키워드를 입력해주세요.');
      return;
    }

    setIsSearching(true);
    setHasSearched(false);
    setErrorMessage('');
    setSearchResults([]);

    try {
      const response = await fetch('https://library-checker.byungwook-an.workers.dev/keyword-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      if (!response.ok) {
        throw new Error('검색에 실패했습니다.');
      }

      const data: SearchResult[] = await response.json();
      setSearchResults(data);
      setHasSearched(true);
    } catch (error) {
      console.error('Keyword search error:', error);
      setErrorMessage('검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClose = () => {
    setKeyword('');
    setSearchResults([]);
    setHasSearched(false);
    setErrorMessage('');
    setSortKey('libraryName');
    setSortOrder('asc');
    closeKeywordSearchModal();
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedResults = [...searchResults].sort((a, b) => {
    let aValue: any = a[sortKey];
    let bValue: any = b[sortKey];

    // 대출 가능 여부는 boolean이므로 숫자로 변환
    if (sortKey === 'isAvailable') {
      aValue = aValue ? 1 : 0;
      bValue = bValue ? 1 : 0;
    }

    // console.log(searchResults) // pubDate 체크 디버깅 위한

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const SortArrow: React.FC<{ column: SortKey }> = ({ column }) => {
    if (sortKey !== column) return null;
    return (
      <span className="ml-1 inline-block">
        {sortOrder === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  return (    
    <div className="fixed inset-0 bg-bg-overlay flex items-center justify-center z-50 p-4">
      <div className="bg-elevated rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        {/* <div className="flex justify-between items-center p-6 border-b border-primary"> */}
        <div className="flex justify-between items-center p-6">

          <h2 className="text-2xl font-bold text-primary">키워드 통합 검색</h2>
          <button onClick={handleClose} className="text-tertiary hover:text-primary transition-colors" title="닫기">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* 검색 입력 영역 */}
        {/* <div className="p-6 border-b border-primary"> */}
        <div className="p-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="검색할 키워드를 입력하세요 (6개 도서관 동시 검색)"
              className="input-base flex-1 px-4 py-3 text-lg"
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="btn-base btn-primary px-6 py-3 font-semibold flex items-center gap-2"
            >
              <SearchIcon className="w-5 h-5" />
              검색
            </button>
          </div>
        </div>

        {/* 결과 표시 영역 */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasSearched && !isSearching && !errorMessage && (
            <div className="flex flex-col items-center justify-center h-full text-tertiary">
              {/* <SearchIcon className="w-16 h-16 mb-4" /> */}
              {/* <p className="text-lg">검색할 키워드를 입력하세요.</p> */}
              {/* <p className="text-sm mt-2">6개 도서관에서 동시에 검색합니다.</p> */}
            </div>
          )}

          {isSearching && (
            // <div className="flex flex-col items-center justify-center h-full">
            <div className="flex flex-col items-center justify-center">
              <Spinner />
              {/* <p className="mt-4 text-secondary text-lg">6개 도서관에서 검색 중입니다...</p>
              <p className="mt-2 text-tertiary text-sm">잠시만 기다려주세요.</p> */}
            </div>
          )}

          {errorMessage && (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-lg">{errorMessage}</p>
            </div>
          )}

          {hasSearched && !isSearching && searchResults.length === 0 && !errorMessage && (
            <div className="flex flex-col items-center justify-center h-full text-tertiary">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-lg">검색 결과가 없습니다.</p>
              <p className="text-sm mt-2">다른 키워드로 검색해보세요.</p>
            </div>
          )}

          {hasSearched && sortedResults.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-secondary mb-4">총 <span className="font-bold text-blue-500 dark:text-blue-400">{sortedResults.length}</span>건의 결과를 찾았습니다.</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-secondary border-b-2 border-primary">
                    <th onClick={() => handleSort('type')} className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover-surface w-20 whitespace-nowrap">타입 <SortArrow column="type" /></th>
                    <th onClick={() => handleSort('libraryName')} className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover-surface w-24 whitespace-nowrap">도서관 <SortArrow column="libraryName" /></th>
                    <th onClick={() => handleSort('title')} className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover-surface min-w-[200px]">제목 <SortArrow column="title" /></th>
                    <th onClick={() => handleSort('author')} className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover-surface w-40">저자 <SortArrow column="author" /></th>
                    {/* <th onClick={() => handleSort('publisher')} className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover-surface w-40">출판사 <SortArrow column="publisher" /></th> */}
                    <th onClick={() => handleSort('pubDate')} className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover-surface w-28 whitespace-nowrap">출간일 <SortArrow column="pubDate" /></th>
                    <th onClick={() => handleSort('isAvailable')} className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover-surface w-28 whitespace-nowrap">대출가능 <SortArrow column="isAvailable" /></th>
                  </tr>
                </thead>

                {/* ====================================================================== */}
                {/* 1. <thead>...</thead> 바로 다음에 오는 <tbody>...</tbody> 전체를 */}
                {/*    아래 코드로 교체하세요. */}
                {/* ====================================================================== */}
                <tbody>
                  {sortedResults.map((result, index) => {
                    // 요구사항 처리를 위한 데이터 가공
                    const displayAuthor = result.author.length > 3
                      ? `${result.author.slice(0, 3)}...`
                      : result.author;

                    const displayTitle = result.title.length > 25 
                      ? `${result.title.slice(0, 25)}...` // 25자로 잘린 제목을 표시
                      : result.title;
                      
                    // YYYY 형식만 추출 (정규식 사용)
                    const displayPubDate = result.pubDate.match(/\d{4}/)?.[0] || result.pubDate;

                    return (
                      <tr key={index} className="border-b border-primary hover-surface transition-colors">
                        {/* 모든 셀에 truncate(말줄임표), whitespace-nowrap(줄바꿈 방지) 클래스 추가 */}
                        <td className="px-4 py-3 text-sm text-secondary truncate whitespace-nowrap">{result.type}</td>
                        <td className="px-4 py-3 text-sm text-secondary truncate whitespace-nowrap">{result.libraryName}</td>
                        <td className="px-4 py-3 text-sm truncate whitespace-nowrap max-w-xs"> {/* max-w-* 로 최대 너비 제한 */}
                          <a
                            href={createLibraryOpenURL(result.libraryName as LibraryName, result.title)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 dark:text-blue-400 hover:underline"
                            title={result.title} // 마우스를 올리면 전체 제목이 보이도록 설정
                          >
                            {displayTitle} 
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-secondary truncate whitespace-nowrap" title={result.author}>
                            {displayAuthor} {/* 3자로 잘린 저자를 표시 */}
                        </td>
                        {/* 출판사 컬럼은 숨김 처리되었으므로 여기에 코드가 없습니다. */}
                        <td className="px-4 py-3 text-sm text-secondary truncate whitespace-nowrap">{displayPubDate}</td>
                        <td className="px-4 py-3 text-sm truncate whitespace-nowrap">
                          {result.isAvailable ? (
                            <span className="flex items-center text-green-600 font-medium">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              가능
                            </span>
                          ) : (
                            <span className="flex items-center text-red-600 font-medium">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                              불가
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeywordSearchModal;
