import React, { useState, useEffect } from 'react';
import { LibraryStockResponse, AladdinBookItem, LibraryApiResponse } from '../types';
import { SearchIcon, AlertCircleIcon, BookIcon, CopyIcon } from './Icons';
import Spinner from './Spinner';
import { fetchBookAvailability, processGyeonggiEbookEduTitle  } from '../services/unifiedLibrary.service';
import { searchAladinBooks } from '../services/aladin.service';
import APITestBookSearchModal from './APITestBookSearchModal';
import { combineRawApiResults } from '../utils/bookDataCombiner'; // ✅ [추가]

type TestType = 'combined';

const APITestContent: React.FC = () => {
  const [testType, setTestType] = useState<TestType>('combined');
  const [isbn, setIsbn] = useState<string>('9791162543481');
  const [title, setTitle] = useState<string>('세상에서 가장 긴 행복 탐구 보고서');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fullApiResult, setFullApiResult] = useState<LibraryApiResponse | null>(null);
  const [aladinResult, setAladinResult] = useState<AladdinBookItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  
  // ✅ [추가] 조합된 결과를 저장할 상태
  const [combinedResult, setCombinedResult] = useState<object | null>(null);

  // API 테스트 전용 검색 상태
  const [apiSearchResults, setApiSearchResults] = useState<AladdinBookItem[]>([]);
  const [apiSelectedBook, setApiSelectedBook] = useState<AladdinBookItem | null>(null);
  const [apiIsLoading, setApiIsLoading] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchType, setSearchType] = useState<string>('Keyword');

  // 복사 기능 함수
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`${label} 결과 복사 완료!`);
      setTimeout(() => setCopyFeedback(null), 2000); // 2초 후 피드백 제거
    } catch (err) {
      console.error('복사 실패:', err);
      setCopyFeedback('복사 실패 - 브라우저가 지원하지 않을 수 있습니다.');
      setTimeout(() => setCopyFeedback(null), 3000); // 3초 후 피드백 제거
    }
  };

  // API 테스트 전용 검색 함수
  const handleApiSearch = async (query: string, type: string) => {
    if (!query.trim()) return;
    
    setApiIsLoading(true);
    setError(null);
    
    try {
      const results = await searchAladinBooks(query.trim(), type);
      const filteredResults = results.filter(book => !book.title.startsWith('[세트]'));
      setApiSearchResults(filteredResults);
      setIsSearchModalOpen(true);
    } catch (error) {
      console.error('API 검색 오류:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setApiSearchResults([]);
    } finally {
      setApiIsLoading(false);
    }
  };

  // API 테스트 검색 폼 제출
  const handleApiSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleApiSearch(searchQuery, searchType);
  };

  // API 테스트에서 책 선택
  const handleApiSelectBook = (book: AladdinBookItem) => {
    setApiSelectedBook(book);
    setIsbn(book.isbn13);
    setTitle(book.title);
    setAladinResult(book);
    setIsSearchModalOpen(false);
    
    // 자동으로 도서관 API 테스트 실행
    runApiTest(book.isbn13, book.title);
  };

  // 선택된 책이 변경되면 자동으로 API 테스트 실행 (기존 로직 유지)
  useEffect(() => {
    if (apiSelectedBook) {
      setIsbn(apiSelectedBook.isbn13);
      setTitle(apiSelectedBook.title);
      setAladinResult(apiSelectedBook);
    }
  }, [apiSelectedBook]);

  // const runApiTest = async (testIsbn: string, testTitle: string) => {
  //   if (!testIsbn.trim() || !testTitle.trim()) {
  //     setError('ISBN과 도서 제목을 모두 입력해주세요.');
  //     return;
  //   }

  //   setIsLoading(true);
  //   setFullApiResult(null);
  //   setError(null);

  //   try {
  //     const data = await fetchBookAvailability(testIsbn.trim(), testTitle.trim());
  //     setFullApiResult(data);
  //   } catch (err) {
  //     if (err instanceof Error) {
  //       setError(err.message);
  //     } else {
  //       setError('알 수 없는 오류가 발생했습니다.');
  //     }
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  // ✅ [수정] runApiTest 함수
  const runApiTest = async (testIsbn: string, testTitle: string) => {
    if (!testIsbn?.trim() || !testTitle?.trim()) {
      setError('ISBN과 도서 제목을 모두 입력해주세요.');
      return;
    }
    setIsLoading(true);
    setFullApiResult(null);
    setAladinResult(null);
    setCombinedResult(null); // 조합 결과 초기화
    setError(null);

    try {
      const libraryPromise = fetchBookAvailability(testIsbn.trim(), testTitle.trim());
      const aladinPromise = searchAladinBooks(testIsbn.trim(), 'ISBN');
      const [libraryResult, aladinResultSettled] = await Promise.allSettled([libraryPromise, aladinPromise]);

      if (libraryResult.status === 'rejected') {
        throw libraryResult.reason;
      }
      const libraryData = libraryResult.value;
      const aladinBookData = aladinResultSettled.status === 'fulfilled'
        ? aladinResultSettled.value.find(b => b.isbn13 === testIsbn.trim()) || null
        : null;

      // 원본 API 결과들을 상태에 저장 (참고용)
      setFullApiResult(libraryData);
      setAladinResult(aladinBookData);

      // "순수 API 조합 결과" 생성 및 저장
      if (aladinBookData) {
        const pureApiData = combineRawApiResults(aladinBookData, libraryData);
        setCombinedResult(pureApiData);
      } else {
        throw new Error("알라딘에서 도서 정보를 찾을 수 없습니다.");
      }

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await runApiTest(isbn, title);
  };

  const processedTitle = title ? processGyeonggiEbookEduTitle(title) : '';

  return (
    <div className="space-y-6 relative">
      {/* 책 검색 섹션 */}
      <div>
        {/* <h3 className="text-xl font-semibold text-white mb-4">📚 책 검색 (알라딘 API)</h3>  */}
        
        {/* API 테스트 전용 검색 폼 */}
        <form onSubmit={handleApiSearchSubmit} className="w-full max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="relative flex-shrink-0">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="h-full py-3 pl-4 pr-10 bg-gray-800 border border-gray-600 rounded-full text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-shadow duration-300"
                disabled={apiIsLoading}
              >
                <option value="Keyword">전체</option>
                <option value="Title">제목</option>
                <option value="Author">저자</option>
                <option value="Publisher">출판사</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
            <div className="relative flex-grow">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="책 제목, 저자, 출판사를 입력하세요..."
                className="w-full pl-4 pr-12 py-3 bg-gray-800 border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow duration-300"
                disabled={apiIsLoading}
              />
              <button
                type="submit"
                className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={apiIsLoading}
              >
                {apiIsLoading ? <Spinner /> : <SearchIcon className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </form>

        {/* 선택된 책 정보 */}
        {apiSelectedBook && (
          <div className="mt-4 bg-gray-700 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-white mb-3">✅ 선택된 책</h4>
            <div className="bg-blue-600 text-white p-3 rounded">
              <div className="font-semibold">{apiSelectedBook.title}</div>
              <div className="text-sm opacity-90">{apiSelectedBook.author} | {apiSelectedBook.publisher}</div>
              <div className="text-xs opacity-80">ISBN: {apiSelectedBook.isbn13}</div>
            </div>
          </div>
        )}
      </div>

      {/* API 테스트 검색 결과 모달 */}
      <APITestBookSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        searchResults={apiSearchResults}
        onSelectBook={handleApiSelectBook}
      />

      {/* 수동 입력 섹션 
      <div className="border-t border-gray-600 pt-6"></div>
      
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">✏️ 수동 입력 테스트</h3>
      </div> */}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> */}
          {/* ISBN Input */}
          {/* <div>
            <label htmlFor="isbn-test" className="block text-sm font-medium text-gray-300 mb-2">
              ISBN (13자리)
            </label>
            <input
              id="isbn-test"
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="예: 9791130629353"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow duration-300"
              disabled={isLoading}
            />
          </div> */}

          {/* Title Input */}
          {/* <div>
            <label htmlFor="title-test" className="block text-sm font-medium text-gray-300 mb-2">
              도서 제목
            </label>
            <input
              id="title-test"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 네이비씰 균형의 기술"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow duration-300"
              disabled={isLoading}
            />
            {title && (
              <p className="text-xs text-gray-400 mt-1">
                처리된 검색어: <span className="text-blue-400">"{processedTitle}"</span>
              </p>
            )}
          </div>
        </div> */}

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
          disabled={isLoading}
        >
          {isLoading ? <Spinner /> : <SearchIcon className="w-5 h-5" />}
          {isLoading ? '조회 중...' : 'API 테스트 실행'}
        </button>
      </form>

      {/* Results Display */}
      <div className="space-y-4">
        {copyFeedback && (
          <div className="bg-green-900/50 border border-green-600 rounded-lg p-3">
            <div className="flex items-center text-green-400 text-sm">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {copyFeedback}
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4">
            <h4 className="font-bold text-red-400 mb-2 flex items-center">
              <AlertCircleIcon className="w-5 h-5 mr-2" />
              오류 발생
            </h4>
            <pre className="text-red-300 whitespace-pre-wrap text-sm">{error}</pre>
          </div>
        )}

        {/* 1. 조합된 최종 결과 (가장 위에) */}
        {combinedResult && (
          <div className="bg-gray-900/50 rounded-lg p-4 border border-blue-500">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-blue-400 flex items-center">
                <BookIcon className="w-5 h-5 mr-2" />
                💾 알라딘 API + 도서재고 API
              </h4>
              <button onClick={() => copyToClipboard(JSON.stringify(combinedResult, null, 2), '조합 결과')} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors" title="결과 복사하기">
                <CopyIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-gray-800 rounded p-3 font-mono text-sm text-gray-300 overflow-auto max-h-96">
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(combinedResult, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* 2. 알라딘 API 결과 (참고용) */}
        {aladinResult && (
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-purple-400 flex items-center">
                <BookIcon className="w-5 h-5 mr-2" />
                📚 알라딘 API 결과
              </h4>
              <button
                onClick={() => copyToClipboard(JSON.stringify(aladinResult, null, 2), '알라딘 API')}
                className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors"
                title="결과 복사하기"
              >
                <CopyIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-gray-800 rounded p-3 font-mono text-sm text-gray-300 overflow-auto max-h-96">
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(aladinResult, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* 3. 도서관 재고 결과 (참고용) */}
        {fullApiResult && (
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-green-400 flex items-center">
                <BookIcon className="w-5 h-5 mr-2" />
                🏛️ 도서관 재고 결과 (전체)
              </h4>
              <button
                onClick={() => copyToClipboard(JSON.stringify(fullApiResult, null, 2), '도서관 재고')}
                className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors"
                title="결과 복사하기"
              >
                <CopyIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-gray-800 rounded p-3 font-mono text-sm text-gray-300 overflow-auto max-h-96">
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(fullApiResult, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default APITestContent;