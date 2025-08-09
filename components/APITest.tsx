import React, { useState } from 'react';
import { LibraryStockResponse } from '../types';
import { SearchIcon } from './Icons';
import Spinner from './Spinner';
import { fetchBookAvailability, processBookTitle, LibraryApiResponse } from '../services/unifiedLibrary.service';

type TestType = 'combined';

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
    if (!isbn.trim() || !title.trim()) {
      setError('ISBN과 도서 제목을 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setPaperResult(null);
    setEbookResult(null);
    setError(null);

    try {
      const data = await fetchBookAvailability(isbn.trim(), title.trim());
      setEbookResult({
        gyeonggi_ebooks: data.gyeonggi_ebooks
      });
      setPaperResult({
        book_title: (data.gwangju_paper as any)?.book_title || '',
        availability: (data.gwangju_paper as any)?.availability || [],
        error: 'error' in data.gwangju_paper ? data.gwangju_paper.error : undefined
      });
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
      <h2 className="text-3xl font-bold text-white mb-6">API 테스트</h2>
      
      <div className="bg-gray-800 rounded-lg shadow-xl p-6">
        

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

          
        </div>
      </div>
    </div>
  );
};

export default APITest;