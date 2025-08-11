import React, { useState, useEffect } from 'react';
import { LibraryStockResponse, AladdinBookItem } from '../types';
import { SearchIcon, AlertCircleIcon, BookIcon, CopyIcon } from './Icons';
import Spinner from './Spinner';
import SearchForm from './SearchForm';
import { fetchBookAvailability, processBookTitle, LibraryApiResponse } from '../services/unifiedLibrary.service';
import { useBookStore } from '../stores/useBookStore';
import { useUIStore } from '../stores/useUIStore';

type TestType = 'combined';

const APITest: React.FC = () => {
  const [testType, setTestType] = useState<TestType>('combined');
  const [isbn, setIsbn] = useState<string>('9791162543481');
  const [title, setTitle] = useState<string>('세상에서 가장 긴 행복 탐구 보고서');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fullApiResult, setFullApiResult] = useState<LibraryApiResponse | null>(null);
  const [aladinResult, setAladinResult] = useState<AladdinBookItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  
  // Store에서 검색 결과와 선택된 책 가져오기
  const { searchResults, selectedBook } = useBookStore();
  const { isBookModalOpen, closeBookModal, setAPITestMode } = useUIStore();

  // API 테스트 모드 활성화/비활성화
  useEffect(() => {
    setAPITestMode(true);
    return () => setAPITestMode(false);
  }, [setAPITestMode]);

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

  // 선택된 책이 변경되면 자동으로 API 테스트 실행
  useEffect(() => {
    if (selectedBook) {
      setIsbn(selectedBook.isbn13);
      setTitle(selectedBook.title);
      setAladinResult(selectedBook);
      
      // 자동으로 도서관 API 테스트 실행
      runApiTest(selectedBook.isbn13, selectedBook.title);
    }
  }, [selectedBook]);

  const runApiTest = async (testIsbn: string, testTitle: string) => {
    if (!testIsbn.trim() || !testTitle.trim()) {
      setError('ISBN과 도서 제목을 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setFullApiResult(null);
    setError(null);

    try {
      const data = await fetchBookAvailability(testIsbn.trim(), testTitle.trim());
      setFullApiResult(data);
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

  const processedTitle = title ? processBookTitle(title) : '';

  return (
    <div className="mt-12 animate-fade-in api-test-container">
      <h2 className="text-3xl font-bold text-white mb-6">API 테스트</h2>
      
      <div className="bg-gray-800 rounded-lg shadow-xl p-6">
        {/* 책 검색 섹션 */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white mb-4">📚 책 검색 (알라딘 API)</h3>
          <SearchForm />
          {searchResults.length > 0 && (
            <div className="mt-4 bg-gray-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-white mb-3">검색 결과 ({searchResults.length}권)</h4>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {searchResults.map((book) => (
                  <div 
                    key={book.isbn13}
                    onClick={() => useBookStore.getState().selectBook(book, { scroll: false })}
                    className={`p-3 rounded cursor-pointer transition-colors ${
                      selectedBook?.isbn13 === book.isbn13 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                    }`}
                  >
                    <div className="font-semibold">{book.title}</div>
                    <div className="text-sm opacity-80">{book.author} | {book.publisher}</div>
                    <div className="text-xs opacity-60">ISBN: {book.isbn13}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-600 pt-6"></div>
        
        {/* 수동 입력 섹션 */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white mb-4">✏️ 수동 입력 테스트</h3>
        </div>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* ISBN Input */}
            <div>
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
              </div>

            {/* Title Input */}
              <div>
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
          </div>

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

          {/* Aladin API Results */}
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

          {/* Unified Library Results */}
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
    </div>
  );
};

export default APITest;