import React, { useState } from 'react';
import { useUIStore } from '../stores/useUIStore';
import { CloseIcon, SearchIcon } from './Icons';
import Spinner from './Spinner';

interface SearchResult {
  type: '종이책' | '전자책';
  libraryName: '퇴촌' | '기타' | 'e교육' | 'e시립구독' | 'e시립소장' | 'e경기';
  title: string;
  author: string;
  pubDate: string;
  isAvailable: boolean;
}

type SortKey = 'libraryName' | 'type' | 'title' | 'author' | 'pubDate' | 'isAvailable';
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

  // MyLibrary와 동일한 키워드 처리 로직
  const processKeyword = (keyword: string): string => {
    let processed = keyword.trim();

    // 특수문자(:, -, (), [], {})에서 자르기
    const cutIndex = processed.search(/[:()\[\]{}-]/);
    if (cutIndex !== -1) {
      processed = processed.substring(0, cutIndex).trim();
    }

    // 공백 기준 3단어까지만
    return processed.split(' ').slice(0, 3).join(' ');
  };

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

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const generateLibraryLink = (result: SearchResult): string => {
    // 처리된 키워드 사용 (특수문자 제거 + 3단어 제한)
    const processedKeyword = processKeyword(keyword);
    const encodedKeyword = encodeURIComponent(processedKeyword);

    switch (result.libraryName) {
      case '퇴촌':
        return `https://lib.gjcity.go.kr/tc/lay1/program/S23T3001C3002/jnet/resourcessearch/resultList.do?type=&searchType=SIMPLE&searchKey=ALL&searchLibraryArr=MN&searchKeyword=${encodedKeyword}`;
      case '기타':
        return `https://lib.gjcity.go.kr/lay1/program/S1T446C461/jnet/resourcessearch/resultList.do?searchType=SIMPLE&searchKey=TITLE&searchLibrary=ALL&searchKeyword=${encodedKeyword}`;
      case 'e교육':
        return `https://lib.goe.go.kr/elib/module/elib/search/index.do?menu_idx=94&author_name=&viewPage=1&search_text=${encodedKeyword}&sortField=book_pubdt&sortType=desc&rowCount=20`;
      case 'e시립구독':
        {
          // MyLibrary와 동일: 책 제목의 앞 3단어 사용
          let titleForSearch = result.title;
          const cutIndex = titleForSearch.search(/[:()\[\]{}-]/);
          if (cutIndex !== -1) {
            titleForSearch = titleForSearch.substring(0, cutIndex).trim();
          }
          titleForSearch = titleForSearch.split(' ').slice(0, 3).join(' ');
          return `https://gjcitylib.dkyobobook.co.kr/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent(titleForSearch)}`;
        }
      case 'e시립소장':
        {
          // MyLibrary와 동일: 책 제목의 앞 3단어 사용
          let titleForSearch = result.title;
          const cutIndex = titleForSearch.search(/[:()\[\]{}-]/);
          if (cutIndex !== -1) {
            titleForSearch = titleForSearch.substring(0, cutIndex).trim();
          }
          titleForSearch = titleForSearch.split(' ').slice(0, 3).join(' ');
          return `https://lib.gjcity.go.kr:444/elibrary-front/search/searchList.ink?schClst=all&schDvsn=000&orderByKey=&schTxt=${encodeURIComponent(titleForSearch)}`;
        }
      case 'e경기':
        return `https://ebook.library.kr/search?OnlyStartWith=false&searchType=all&listType=list&keyword=${encodedKeyword}`;
      default:
        return '#';
    }
  };

  const SortArrow: React.FC<{ column: SortKey }> = ({ column }) => {
    if (sortKey !== column) return null;
    return (
      <span className="ml-1 inline-block">
        {sortOrder === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">키워드 통합 검색</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="닫기"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* 검색 입력 영역 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex gap-3">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="검색할 키워드를 입력하세요"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <SearchIcon className="w-5 h-5" />
              검색
            </button>
          </div>
        </div>

        {/* 결과 표시 영역 */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasSearched && !isSearching && !errorMessage && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <SearchIcon className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg">검색할 키워드를 입력하세요.</p>
              <p className="text-sm mt-2">6개 도서관에서 동시에 검색합니다.</p>
            </div>
          )}

          {isSearching && (
            <div className="flex flex-col items-center justify-center h-full">
              <Spinner />
              <p className="mt-4 text-gray-600 text-lg">6개 도서관에서 검색 중입니다...</p>
              <p className="mt-2 text-gray-500 text-sm">잠시만 기다려주세요.</p>
            </div>
          )}

          {errorMessage && (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg">{errorMessage}</p>
            </div>
          )}

          {hasSearched && !isSearching && searchResults.length === 0 && !errorMessage && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg">검색 결과가 없습니다.</p>
              <p className="text-sm mt-2">다른 키워드로 검색해보세요.</p>
            </div>
          )}

          {hasSearched && sortedResults.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-gray-600 mb-4">총 <span className="font-bold text-blue-600">{sortedResults.length}</span>건의 결과를 찾았습니다.</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th
                      onClick={() => handleSort('type')}
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      타입 <SortArrow column="type" />
                    </th>
                    <th
                      onClick={() => handleSort('libraryName')}
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      도서관 <SortArrow column="libraryName" />
                    </th>
                    <th
                      onClick={() => handleSort('title')}
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      제목 <SortArrow column="title" />
                    </th>
                    <th
                      onClick={() => handleSort('author')}
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      저자 <SortArrow column="author" />
                    </th>
                    <th
                      onClick={() => handleSort('pubDate')}
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      출간일 <SortArrow column="pubDate" />
                    </th>
                    <th
                      onClick={() => handleSort('isAvailable')}
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      대출 가능 <SortArrow column="isAvailable" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((result, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {result.type}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {result.libraryName}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <a
                          href={generateLibraryLink(result)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {result.title}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {result.author}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {result.pubDate}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {result.isAvailable ? (
                          <span className="flex items-center text-green-600 font-medium">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            가능
                          </span>
                        ) : (
                          <span className="flex items-center text-red-600 font-medium">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            불가
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeywordSearchModal;
