import React, { useState } from 'react';
import { LibraryStockResponse } from '../types';
import { SearchIcon } from './Icons';
import Spinner from './Spinner';
import { fetchBookAvailability, processBookTitle, LibraryApiResponse } from '../services/unifiedLibrary.service';

type TestType = 'paper' | 'ebook' | 'combined';

const APITest: React.FC = () => {
  const [testType, setTestType] = useState<TestType>('combined');
  const [isbn, setIsbn] = useState<string>('9791162543481');
  const [title, setTitle] = useState<string>('세상에서 가장 긴 행복 탐구 보고서');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [paperResult, setPaperResult] = useState<LibraryStockResponse | null>(null);
  const [ebookResult, setEbookResult] = useState<LibraryApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validation
    if (testType === 'paper' && !isbn.trim()) {
      setError('ISBN을 입력해주세요.');
      return;
    }
    if (testType === 'ebook' && !title.trim()) {
      setError('도서 제목을 입력해주세요.');
      return;
    }
    if (testType === 'combined' && (!isbn.trim() || !title.trim())) {
      setError('ISBN과 도서 제목을 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setPaperResult(null);
    setEbookResult(null);
    setError(null);

    try {
      if (testType === 'paper') {
        // For paper book testing, use the unified API with ISBN and a minimal title
        const data = await fetchBookAvailability(isbn.trim(), 'test');
        // Only extract and show paper book result
        setPaperResult({
          book_title: (data.gwangju_paper as any)?.book_title || '',
          availability: (data.gwangju_paper as any)?.availability || [],
          error: 'error' in data.gwangju_paper ? data.gwangju_paper.error : undefined
        });
      } else if (testType === 'ebook') {
        // For ebook testing, we still need a valid ISBN - use the provided one or a default
        const testIsbn = isbn.trim() || '9791130629353';
        const data = await fetchBookAvailability(testIsbn, title.trim());
        // Only show ebook results, create a filtered response
        setEbookResult({
          gwangju_paper: { error: 'Paper book data hidden for ebook-only test' },
          gyeonggi_ebooks: data.gyeonggi_ebooks
        });
      } else if (testType === 'combined') {
        // For combined testing, use both real values and show both results
        const data = await fetchBookAvailability(isbn.trim(), title.trim());
        setEbookResult(data);
        // Extract paper book result for display
        setPaperResult({
          book_title: (data.gwangju_paper as any)?.book_title || '',
          availability: (data.gwangju_paper as any)?.availability || [],
          error: 'error' in data.gwangju_paper ? data.gwangju_paper.error : undefined
        });
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

  const processedTitle = title ? processBookTitle(title) : '';

  return (
    <div className="mt-12 animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-6">API 테스트: 도서관 재고 직접 조회</h2>
      <div className="mb-4 p-3 bg-blue-900/50 border border-blue-600 rounded-lg text-sm text-blue-200">
        <p>💡 <strong>참고:</strong> 현재 API는 통합형 endpoint를 사용하며, 종이책과 전자책 정보를 함께 조회합니다.</p>
      </div>
      <div className="bg-gray-800 rounded-lg shadow-xl p-6">
        {/* Test Type Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">테스트 유형 선택</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTestType('combined')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                testType === 'combined'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🔄 통합 테스트 (ISBN + 제목)
            </button>
            <button
              type="button"
              onClick={() => setTestType('paper')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                testType === 'paper'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📚 종이책 재고 (ISBN)
            </button>
            <button
              type="button"
              onClick={() => setTestType('ebook')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                testType === 'ebook'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📱 전자책 재고 (제목)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* ISBN Input */}
            {(testType === 'paper' || testType === 'combined') && (
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
            )}

            {/* Title Input */}
            {(testType === 'ebook' || testType === 'combined') && (
              <div>
                <label htmlFor="title-test" className="block text-sm font-medium text-gray-300 mb-2">
                  도서 제목
                  {testType === 'ebook' && <span className="text-xs text-gray-400 ml-2">(ISBN은 자동으로 설정됩니다)</span>}
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
            )}
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
          {error && (
            <div className="bg-red-900/50 border border-red-600 rounded-lg p-4">
              <h4 className="font-bold text-red-400 mb-2">❌ 오류 발생</h4>
              <pre className="text-red-300 whitespace-pre-wrap text-sm">{error}</pre>
            </div>
          )}

          {/* Paper Book Results */}
          {paperResult && (
            <div className="bg-gray-900/50 rounded-lg p-4">
              <h4 className="font-bold text-green-400 mb-2">📚 종이책 재고 결과</h4>
              <div className="bg-gray-800 rounded p-3 font-mono text-sm text-gray-300 overflow-auto max-h-64">
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(paperResult, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Ebook Results */}
          {ebookResult && (
            <div className="bg-gray-900/50 rounded-lg p-4">
              <h4 className="font-bold text-blue-400 mb-2">📱 전자책 재고 결과</h4>
              <div className="bg-gray-800 rounded p-3 font-mono text-sm text-gray-300 overflow-auto max-h-64">
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(ebookResult, null, 2)}</pre>
              </div>
            </div>
          )}

          {!isLoading && !error && !paperResult && !ebookResult && (
            <div className="bg-gray-900/50 rounded-lg p-4 text-center text-gray-500">
              <p>테스트 유형을 선택하고 필요한 정보를 입력한 후 'API 테스트 실행' 버튼을 눌러주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default APITest;