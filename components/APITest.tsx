import React, { useState } from 'react';
import { LibraryStockResponse } from '../types';
import { SearchIcon } from './Icons';
import Spinner from './Spinner';
import { fetchLibraryStock } from '../services/library.service';

const APITest: React.FC = () => {
  const [isbn, setIsbn] = useState<string>('9791130629353');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<LibraryStockResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isbn.trim()) {
      setError('ISBN을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await fetchLibraryStock(isbn.trim());
      setResult(data);
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

  return (
    <div className="mt-12 animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-6">API 테스트: 도서관 재고 직접 조회</h2>
      <div className="bg-gray-800 rounded-lg shadow-xl p-6">
        <form onSubmit={handleSubmit} className="mb-6">
          <label htmlFor="isbn-test" className="block text-sm font-medium text-gray-300 mb-2">
            ISBN (13자리)
          </label>
          <div className="relative">
            <input
              id="isbn-test"
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="테스트할 ISBN 코드를 입력하세요..."
              className="w-full pl-4 pr-12 py-3 bg-gray-900 border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow duration-300"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? <Spinner /> : <SearchIcon className="w-6 h-6" />}
            </button>
          </div>
        </form>

        <div className="mt-4 bg-gray-900/50 rounded-lg p-4 min-h-[10rem] font-mono text-sm text-gray-300">
          <h4 className="font-sans font-bold text-lg text-white mb-2">응답 결과</h4>
          {isLoading && (
            <div className="flex justify-center items-center h-full">
                <Spinner />
                <p className="ml-4 font-sans">조회 중...</p>
            </div>
          )}
          {error && (
            <pre className="text-red-400 whitespace-pre-wrap">Error: {error}</pre>
          )}
          {result && (
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(result, null, 2)}</pre>
          )}
          {!isLoading && !error && !result && (
            <p className="font-sans text-gray-500">조회할 ISBN을 입력하고 검색 버튼을 누르세요.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default APITest;