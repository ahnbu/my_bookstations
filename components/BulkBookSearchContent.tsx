import React, { useState, useCallback } from 'react';
import { AladdinBookItem, BulkSearchResult } from '../types';
import {
  parseBookTitles,
  searchBulkBooksWithBatch,
  getStatusText,
  downloadBulkSearchCSV,
  updateSearchResultTitle,
  validateTitleInput
} from '../services/bulkSearch.service';
import { useBookStore } from '../stores/useBookStore';
import { useUIStore } from '../stores/useUIStore';
import BulkBookSelectionModal from './BulkBookSelectionModal';

const BulkBookSearchContent: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [searchResults, setSearchResults] = useState<BulkSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState({
    completed: 0,
    total: 0,
    currentBatch: 0,
    totalBatches: 0
  });
  const [selectionModal, setSelectionModal] = useState<{
    isOpen: boolean;
    searchResult: BulkSearchResult | null;
  }>({ isOpen: false, searchResult: null });

  // 편집 관련 상태
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const { addToLibrary } = useBookStore();
  const { setNotification } = useUIStore();

  // 검색 실행
  const handleSearch = useCallback(async () => {
    if (!inputText.trim()) {
      setNotification({ message: '책 제목을 입력해주세요.', type: 'warning' });
      return;
    }

    const titles = parseBookTitles(inputText);
    if (titles.length === 0) {
      setNotification({ message: '유효한 책 제목을 입력해주세요.', type: 'warning' });
      return;
    }

    setIsSearching(true);
    setSearchProgress({ completed: 0, total: titles.length, currentBatch: 0, totalBatches: Math.ceil(titles.length / 5) });

    try {
      const results = await searchBulkBooksWithBatch(titles, (completed, total, currentBatch, totalBatches) => {
        setSearchProgress({ completed, total, currentBatch: currentBatch || 0, totalBatches: totalBatches || 0 });
      });

      setSearchResults(results);
      setNotification({
        message: `총 ${results.length}개 제목에 대한 검색이 완료되었습니다.`,
        type: 'success'
      });
    } catch (error) {
      console.error('Bulk search failed:', error);
      setNotification({
        message: '검색 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setIsSearching(false);
      setSearchProgress({ completed: 0, total: 0, currentBatch: 0, totalBatches: 0 });
    }
  }, [inputText, setNotification]);

  // 책 선택 (다중 결과에서)
  const handleBookSelection = (searchResult: BulkSearchResult, book: AladdinBookItem) => {
    setSearchResults(prev => prev.map(result =>
      result.id === searchResult.id
        ? { ...result, selectedBook: book, status: 'found' as const }
        : result
    ));
  };

  // 선택 모달 열기
  const openSelectionModal = (searchResult: BulkSearchResult) => {
    setSelectionModal({ isOpen: true, searchResult });
  };

  // 선택 모달 닫기
  const closeSelectionModal = () => {
    setSelectionModal({ isOpen: false, searchResult: null });
  };

  // 개별 서재 반영
  const handleAddSingleToLibrary = async (searchResult: BulkSearchResult) => {
    if (!searchResult.selectedBook) return;

    try {
      const addedBook = await addToLibrary(searchResult.selectedBook);
      if (!addedBook) {
        setNotification({
          message: '이미 추가되었거나 추가할 수 없는 책입니다.',
          type: 'warning'
        });
        return;
      }

      setNotification({
        message: `"${searchResult.selectedBook.title}"이(가) 서재에 추가되었습니다.`,
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to add book to library:', error);
      setNotification({
        message: '서재 추가 중 오류가 발생했습니다.',
        type: 'error'
      });
    }
  };

  // 일괄 서재 반영
  const handleAddAllToLibrary = async () => {
    const selectedBooks = searchResults.filter(result => result.selectedBook);

    if (selectedBooks.length === 0) {
      setNotification({ message: '서재에 추가할 책이 없습니다.', type: 'warning' });
      return;
    }

    let successCount = 0;
    let skippedCount = 0;
    let failureCount = 0;

    for (const searchResult of selectedBooks) {
      try {
        const addedBook = await addToLibrary(searchResult.selectedBook!);
        if (addedBook) {
          successCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error('Failed to add book to library:', error);
        failureCount++;
      }
    }

    if (failureCount === 0 && skippedCount === 0) {
      setNotification({
        message: `총 ${successCount}권의 책이 서재에 추가되었습니다.`,
        type: 'success'
      });
    } else if (failureCount === 0) {
      setNotification({
        message: `${successCount}권 추가, ${skippedCount}권은 이미 추가되었거나 건너뛰었습니다.`,
        type: 'warning'
      });
    } else {
      setNotification({
        message: `${successCount}권 추가, ${skippedCount}권 건너뜀, ${failureCount}권 실패했습니다.`,
        type: 'warning'
      });
    }
  };

  // CSV 다운로드
  const handleDownloadCSV = () => {
    if (searchResults.length === 0) {
      setNotification({ message: '다운로드할 데이터가 없습니다.', type: 'warning' });
      return;
    }

    downloadBulkSearchCSV(searchResults);
    setNotification({ message: 'CSV 파일이 다운로드되었습니다.', type: 'success' });
  };

  // 결과 초기화
  const handleClearResults = () => {
    setSearchResults([]);
    setInputText('');
    setEditingTitleId(null);
    setEditingTitle('');
  };

  // 제목 편집 시작
  const handleTitleEditStart = (result: BulkSearchResult) => {
    setEditingTitleId(result.id);
    setEditingTitle(result.inputTitle);
  };

  // 제목 편집 취소
  const handleTitleEditCancel = () => {
    setEditingTitleId(null);
    setEditingTitle('');
  };

  // 제목 편집 저장
  const handleTitleEditSave = async (result: BulkSearchResult) => {
    const validation = validateTitleInput(editingTitle);

    if (!validation.isValid) {
      setNotification({
        message: validation.errorMessage || '제목 입력이 올바르지 않습니다.',
        type: 'warning'
      });
      return;
    }

    try {
      // 편집 상태를 searching으로 변경
      setSearchResults(prev => prev.map(r =>
        r.id === result.id
          ? { ...r, status: 'searching' as const, isEditing: false }
          : r
      ));
      setEditingTitleId(null);
      setEditingTitle('');

      // 제목 업데이트 및 재검색
      const updatedResult = await updateSearchResultTitle(result, editingTitle);

      // 결과 업데이트
      setSearchResults(prev => prev.map(r =>
        r.id === result.id ? updatedResult : r
      ));

      setNotification({
        message: `"${editingTitle}" 제목으로 재검색이 완료되었습니다.`,
        type: 'success'
      });
    } catch (error) {
      console.error('Title update failed:', error);
      setNotification({
        message: '제목 수정 중 오류가 발생했습니다.',
        type: 'error'
      });

      // 오류 시 원래 상태로 복원
      setSearchResults(prev => prev.map(r =>
        r.id === result.id
          ? { ...r, isEditing: false }
          : r
      ));
    }
  };

  // Enter 키로 저장, Escape 키로 취소
  const handleTitleKeyDown = (e: React.KeyboardEvent, result: BulkSearchResult) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleEditSave(result);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleTitleEditCancel();
    }
  };

  const getStatusBadgeStyle = (status: BulkSearchResult['status']) => {
    switch (status) {
      case 'found':
        return 'bg-green-100 text-green-800';
      case 'multiple':
        return 'bg-blue-100 text-blue-800';
      case 'none':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'searching':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* 입력 영역 */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📚 대량 책 조회 및 일괄 반영
        </h3> */}

        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-600">
              💡 제목과 저자를 포함하여 키워드 검색합니다 (앞 2개 단어 사용).
            </div>
            <br></br>
            <label htmlFor="book-titles" className="block text-sm font-medium text-gray-700 mb-2">
              책 제목 목록 (줄바꿈으로 구분)
            </label>

            <textarea
              id="book-titles"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`예시:\n해리포터와 마법사의 돌\n반지의 제왕\n1984\n동물농장\n이상한 나라의 앨리스`}
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500"
              disabled={isSearching}
            />
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleSearch}
              disabled={isSearching || !inputText.trim()}
              className={`btn-base flex-1 ${isSearching || !inputText.trim() ? 'btn-secondary' : 'btn-primary'}`}
            >
              {isSearching ? '검색중...' : '검색 시작'}
            </button>
          </div>

          {/* 진행 상태 */}
          {isSearching && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-blue-900">검색 진행중</span>
                  {searchProgress.totalBatches > 0 && (
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      배치 {searchProgress.currentBatch}/{searchProgress.totalBatches}
                    </span>
                  )}
                </div>
                <span className="text-sm text-blue-700">
                  {searchProgress.completed} / {searchProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${searchProgress.total > 0 ? (searchProgress.completed / searchProgress.total) * 100 : 0}%`
                  }}
                />
              </div>
              {searchProgress.totalBatches > 1 && (
                <div className="mt-2 text-xs text-blue-600">
                  💡 API 안정성을 위해 5개씩 배치로 처리중입니다 (배치 간 0.5초 대기)
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 검색 결과 */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          {/* 결과 헤더 */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900">
                검색 결과 ({searchResults.length}개)
              </h4>
              <div className="flex space-x-2">
                <button
                  onClick={handleDownloadCSV}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                >
                  📄 CSV 다운로드
                </button>
                <button
                  onClick={handleAddAllToLibrary}
                  disabled={!searchResults.some(r => r.selectedBook)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                >
                  📖 일괄 서재 반영
                </button>
                <button
                  onClick={handleClearResults}
                  className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                >
                  🗑️ 결과 초기화
                </button>
              </div>
            </div>
          </div>

          {/* 결과 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    입력 제목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    찾은 책
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ISBN
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {searchResults.map((result, index) => (
                  <tr key={result.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div>
                        {editingTitleId === result.id ? (
                          // 편집 모드
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => handleTitleKeyDown(e, result)}
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              autoFocus
                            />
                            <button
                              onClick={() => handleTitleEditSave(result)}
                              className="p-1 text-green-600 hover:text-green-800 transition-colors"
                              title="저장 (Enter)"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={handleTitleEditCancel}
                              className="p-1 text-red-600 hover:text-red-800 transition-colors"
                              title="취소 (Escape)"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          // 일반 모드
                          <div className="group cursor-pointer" onClick={() => handleTitleEditStart(result)}>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{result.inputTitle}</span>
                              <svg
                                className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                title="클릭하여 편집"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">검색어: {result.searchQuery}</div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {result.status === 'multiple' ? (
                        <button
                          onClick={() => openSelectionModal(result)}
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 ${getStatusBadgeStyle(result.status)}`}
                        >
                          {result.searchResults.length}개 ▼
                        </button>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeStyle(result.status)}`}>
                          {getStatusText(result.status)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {result.selectedBook ? (
                        <div>
                          <div className="font-medium line-clamp-2">{result.selectedBook.title}</div>
                          <div className="text-xs text-gray-500">{result.selectedBook.author}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs font-mono text-gray-600">
                      {result.selectedBook?.isbn13 || '-'}
                    </td>
                    <td className="px-4 py-4">
                      {result.selectedBook && (
                        <button
                          onClick={() => handleAddSingleToLibrary(result)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          서재 추가
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 선택 모달 */}
      <BulkBookSelectionModal
        isOpen={selectionModal.isOpen}
        onClose={closeSelectionModal}
        searchResult={selectionModal.searchResult}
        onSelectBook={(book) => {
          if (selectionModal.searchResult) {
            handleBookSelection(selectionModal.searchResult, book);
          }
        }}
      />
    </div>
  );
};

export default BulkBookSearchContent;
