import React, { useState, useEffect, useMemo } from 'react';
import { useUIStore } from '../stores/useUIStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useBookStore } from '../stores/useBookStore';
import type { CustomTag, TagColor, Theme, RefreshType, RefreshLimit, ViewType, SelectedBook } from '../types';
import CustomTagComponent from './CustomTag';

const SettingsModal: React.FC = () => {
  const { isSettingsModalOpen, closeSettingsModal, setNotification } = useUIStore();
  const { settings, loading, updateUserSettings, createTag, updateTag, deleteTag, getTagUsageCount, exportToCSV, setTheme, updateAutoTagRule } = useSettingsStore();
  const { myLibraryBooks, totalBooksCount, isAllBooksLoaded, tagCounts, bulkRefreshState, 
    fetchRemainingLibrary, recalculateAutoTagsForAllBooks, bulkRefreshAllBooks, pauseBulkRefresh, resumeBulkRefresh, cancelBulkRefresh,
    errorBooks, errorBooksCount
   } = useBookStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'display' | 'initial' | 'tags' | 'data'>('display');
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [editingAutoRuleTagId, setEditingAutoRuleTagId] = useState<string | null>(null);
  const [autoKeywordInput, setAutoKeywordInput] = useState('');
  const [autoRuleEnabled, setAutoRuleEnabled] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<TagColor>('primary');

  // [추가] CSV 내보내기 진행 상태 추가
  const [isExporting, setIsExporting] = useState(false);

  // ✅ [수정] 일괄 갱신 관련 상태 확장
  const [selectedRefreshType, setSelectedRefreshType] = useState<RefreshType>('recent');
  const [selectedRefreshLimit, setSelectedRefreshLimit] = useState<RefreshLimit>(25);
  
    // 범위 지정을 위한 상태 추가
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // const [refreshState, setRefreshState] = useState({
  //   isRunning: false,
  //   isPaused: false,
  //   current: 0,
  //   total: 0,
  //   failed: 0,
  // });

  // ================================================================
  // ✅ [CREATE] 이 줄을 여기에 추가합니다.
  // useBookStore의 bulkRefreshState를 실시간으로 구독하여 상태 변화를 감지합니다.
  const bulkRefreshStateFromStore = useBookStore(state => state.bulkRefreshState);
  // ================================================================

  useEffect(() => {
    if (isSettingsModalOpen) {
      setLocalSettings(settings);
    }
  }, [isSettingsModalOpen, settings]);

  // 컴포넌트 마운트 시 테마 적용
  useEffect(() => {
    const { applyTheme } = useSettingsStore.getState();
    applyTheme(settings.theme);
  }, [settings.theme]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserSettings(localSettings);
      setNotification({ message: '설정이 저장되었습니다.', type: 'success' });
      closeSettingsModal();
    } catch (error) {
      setNotification({ message: '설정 저장에 실패했습니다.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // 갱신 중일 때 경고
    if (bulkRefreshState.isRunning) {
      const confirmed = window.confirm(
        '재고 갱신이 진행 중입니다.\n갱신을 취소하고 닫으시겠습니까?'
      );
      if (!confirmed) return;

      // 갱신 취소
      cancelBulkRefresh();
      // setRefreshState({
      //   isRunning: false,
      //   isPaused: false,
      //   current: 0,
      //   total: 0,
      //   failed: 0,
      // });
    }

    setLocalSettings(settings); // Reset to original settings
    setActiveTab('display');
    setEditingTag(null);
    setNewTagName('');
    setNewTagColor('blue');
    closeSettingsModal();
  };

  const handleToggle = (key: keyof typeof localSettings) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Tag Management Functions
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      await createTag(newTagName.trim(), newTagColor);
      setNewTagName('');
      setNewTagColor('primary');
      setNotification({ message: '태그가 추가되었습니다.', type: 'success' });
    } catch (error) {
      setNotification({ message: '태그 추가에 실패했습니다.', type: 'error' });
    }
  };

  const handleUpdateTag = async (tagId: string, updates: Partial<Pick<CustomTag, 'name' | 'color'>>) => {
    try {
      await updateTag(tagId, updates);
      setEditingTag(null);
      setNotification({ message: '태그가 수정되었습니다.', type: 'success' });
    } catch (error) {
      setNotification({ message: '태그 수정에 실패했습니다.', type: 'error' });
    }
  };

  const handleDeleteTag = async (tag: CustomTag) => {
    
    // ✅ [수정] 함수가 호출되는 시점의 최신 myLibraryBooks 상태를 가져옵니다.
    // const usageCount = getTagUsageCount(tag.id, myLibraryBooks); // 💥 오래된 myLibraryBooks를 사용

    const currentLibraryBooks = useBookStore.getState().myLibraryBooks;
    const usageCount = getTagUsageCount(tag.id, currentLibraryBooks);
    
    if (usageCount > 0) {
      const confirmed = window.confirm(
        `'${tag.name}' 태그는 현재 ${usageCount}권의 책에 사용 중입니다.\n` +
        `태그를 삭제하면 모든 책에서 이 태그가 제거됩니다.\n\n` +
        `정말 삭제하시겠습니까?`
      );

      if (!confirmed) return;
    }

    try {
      await deleteTag(tag.id);
      setNotification({ message: '태그가 삭제되었습니다.', type: 'success' });
    } catch (error) {
      setNotification({ message: '태그 삭제에 실패했습니다.', type: 'error' });
    }
  };

  // [전체권수 대상으로 csv 내보내기]
  // 전체로딩 안되어 있으면, 전체로딩 후에 csv내보내기
  const handleExportCSV = async () => {
    // 이미 내보내기 중이면 중복 실행 방지
    if (isExporting) return;

    if (!window.confirm(`전체 ${totalBooksCount}권의 서재 데이터를 CSV 파일로 내보내시겠습니까?`)) {
      return;
    }

    setIsExporting(true);
    setNotification({ message: '전체 서재 데이터를 준비 중입니다...', type: 'info' });

    try {
      let booksToExport = myLibraryBooks;

      // 1. 모든 책이 로드되지 않았다면 나머지 책을 불러옵니다.
      if (!isAllBooksLoaded) {
        await fetchRemainingLibrary();
        // 2. 스토어에서 최신화된 전체 책 목록을 다시 가져옵니다.
        booksToExport = useBookStore.getState().myLibraryBooks;
      }

      // 3. 전체 책 목록으로 내보내기 실행
      exportToCSV(booksToExport);

    } catch (error) {
      console.error("CSV export failed:", error);
      setNotification({ message: 'CSV 내보내기 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  // 일괄 갱신 범위 선택지 생성
  const getRefreshOptions = () => {
    const totalBooks = totalBooksCount;
    const halfCount = Math.floor(totalBooks / 2);

    // 1. 가능한 모든 옵션을 정의합니다.
    const allPossibleOptions = [
      { value: 'recent-25', label: '최근 25권', count: 25 },
      { value: 'recent-50', label: '최근 50권', count: 50 },
      // { value: 'recent-100', label: '최근 100권', count: 100 },
      // halfCount가 100 이하일 경우, 위 옵션과 중복되므로 추가하지 않습니다.
      // 또한 halfCount가 의미 있는 숫자일 때만 (예: 10 이상) 추가합니다.
      halfCount > 100 ? { value: `recent-${halfCount}`, label: `최근 ${halfCount}권`, count: halfCount } : null,
      halfCount > 100 ? { value: `old-${halfCount}`, label: `오래된 ${halfCount}권`, count: halfCount } : null,
      { value: 'all-all', label: `전체 (${totalBooks}권)`, count: totalBooks },
      // ✅ 에러 보유 책 Only 옵션
      errorBooksCount > 0 ? { 
          value: 'error-only', 
          label: `에러 보유 책 Only (${errorBooksCount}권)`, 
          count: errorBooksCount, 
          type: 'error' 
      } : null,
      { value: 'range-custom', label: '범위 지정', count: Infinity }, // 범위 지정은 항상 표시
    ];

    // 2. 유효한 옵션만 필터링합니다.
    const validOptions = allPossibleOptions.filter(opt => {
      // null인 항목(조건 미충족) 제거
      if (!opt) return false;
      
      // '전체' 또는 '범위 지정' 옵션은 항상 포함
      if (opt.value === 'all-all' || opt.value === 'range-custom') return true;
      
      // 옵션의 수량이 총 보유 권수보다 작거나 같을 때만 포함
      return opt.count <= totalBooks;
    });

    // 3. 중복 가능성 제거 (예: totalBooks가 50일 때 '최근 50권'과 '최근 halfCount'가 겹칠 수 있음)
    // Map을 사용하여 value가 고유한 옵션만 남깁니다.
    const uniqueOptions = Array.from(new Map(validOptions.map(opt => [opt.value, opt])).values());
    
    return uniqueOptions;
  };

  // 예상 소요 시간 계산 (초)
  const estimateRefreshTime = (bookCount: number) => {
    const batches = Math.ceil(bookCount / 10);
    const waitTime = (batches - 1) * 1; // 배치 간 대기
    const apiTime = batches * 2; // API 호출 시간
    return waitTime + apiTime;
  };

  const handleStartBulkRefresh = async () => {
      // 1. 옵션 객체와 갱신할 책의 수를 초기화합니다.
      let options: any = { type: selectedRefreshType };
      let bookCount = 0;
      let targetBooks: SelectedBook[] | undefined = undefined;

      // 2. 선택된 갱신 타입(selectedRefreshType)에 따라 분기하여 처리합니다.
      switch (selectedRefreshType) {
          case 'recent':
          case 'old':
              options.limit = selectedRefreshLimit as number;
              bookCount = Math.min(options.limit, totalBooksCount);
              break;

          case 'error':
              // 에러 책 처리는 이미 잘 동작하므로 그대로 유지합니다.
              targetBooks = errorBooks;
              bookCount = errorBooksCount;
              if (bookCount === 0) {
                  setNotification({ message: '갱신할 에러 보유 책이 없습니다.', type: 'warning' });
                  return;
              }
              if (!isAllBooksLoaded) {
                  setNotification({ message: '정확한 대상 선정을 위해 전체 서재를 로드합니다. 잠시만 기다려주세요.', type: 'info' });
                  await fetchRemainingLibrary();
                  const currentErrorBooks = useBookStore.getState().errorBooks;
                  targetBooks = currentErrorBooks;
                  bookCount = currentErrorBooks.length;
              }
              // bulkRefreshAllBooks에 targetBooks를 전달하기 위해 options에 추가합니다.
              options.targetBooks = targetBooks; 
              break;

          case 'range':
              const start = parseInt(rangeStart) || 1;
              const end = parseInt(rangeEnd) || totalBooksCount;
              if (start > end || start < 1 || end > totalBooksCount) {
                  setNotification({ message: '범위가 올바르지 않습니다.', type: 'error' });
                  return;
              }
              options.start = start;
              options.end = end;
              bookCount = end - start + 1;
              break;

          case 'all':
              bookCount = totalBooksCount;
              break;

          default:
              setNotification({ message: '알 수 없는 갱신 타입입니다.', type: 'error' });
              return;
      }

      // 3. 확인창 표시 (기존과 동일)
      const estimatedTime = estimateRefreshTime(bookCount);
      const confirmed = window.confirm(
        `${bookCount}권의 재고를 갱신하시겠습니까?\n\n예상 소요 시간: 약 ${estimatedTime}초`
      );
      if (!confirmed) return;

      // 4. UI 상태 초기화 (기존과 동일)
      // setRefreshState({
      //     isRunning: true,
      //     isPaused: false,
      //     current: 0,
      //     total: bookCount,
      //     failed: 0,
      // });

      // 5. bulkRefreshAllBooks 호출 (기존과 동일)
      bulkRefreshAllBooks(options, {
          onProgress: () => {},
          onComplete: (success, failedIds) => {
              if (failedIds.length === 0) {
                  setNotification({ message: `${success}권의 재고 갱신이 완료되었습니다.`, type: 'success' });
              } else if (success > 0) {
                  setNotification({ message: `${success}권 갱신 완료, ${failedIds.length}권 실패했습니다.`, type: 'warning' });
              } else {
                  setNotification({ message: '재고 갱신에 실패했습니다. 네트워크 연결을 확인해주세요.', type: 'error' });
              }
          },
          shouldPause: () => useBookStore.getState().bulkRefreshState.isPaused,
          shouldCancel: () => useBookStore.getState().bulkRefreshState.isCancelled,
      });
  };

  // 일시정지/재개 토글
  const handleTogglePause = () => {
    if (bulkRefreshState.isPaused) {
      resumeBulkRefresh();
    } else {
      pauseBulkRefresh();
    }
  };

  // 취소
  const handleCancelRefresh = () => {
    const confirmed = window.confirm('재고 갱신을 중단하시겠습니까?');
    if (!confirmed) return;

    cancelBulkRefresh();

    setNotification({
      message: `재고 갱신이 취소되었습니다. (${bulkRefreshState.current}/${bulkRefreshState.total}권 완료)`,
      type: 'warning',
    });
  };

  const colorOptions: { value: TagColor; label: string; class: string }[] = [
    { value: 'primary', label: '기본', class: 'tag-primary' },
    { value: 'secondary', label: '보조1', class: 'tag-secondary' },
    { value: 'tertiary', label: '보조2', class: 'tag-tertiary' },
  ];

  // 태그 정렬: 1차-색상별(기본>보조), 2차-사용량별(많은순)
  const sortedTags = useMemo(() => {
    if (!settings.tagSettings?.tags) return [];

    return [...settings.tagSettings.tags].sort((a, b) => {
      // 1차 정렬: 색상별 (기본색상 > 보조색상)
      const colorOrder = { 'primary': 0, 'secondary': 1, 'tertiary': 2 };
      // const colorDiff = colorOrder[a.color] - colorOrder[b.color];
      const colorDiff = (colorOrder[a.color] ?? 99) - (colorOrder[b.color] ?? 99);
      if (colorDiff !== 0) return colorDiff;

      // 2차 정렬: 사용량별 (많이 사용 > 적게 사용)
      // ✅ [수정] getTagUsageCount 대신 tagCounts 객체를 사용합니다.
      const aUsage = tagCounts[a.id] || 0;
      const bUsage = tagCounts[b.id] || 0;

      return bUsage - aUsage;
    });
  // }, [settings.tagSettings?.tags, myLibraryBooks, getTagUsageCount]);
  }, [settings.tagSettings?.tags, tagCounts]);

  
  // ✅ [신규] 선택된 기본 필터 태그의 이름 목록을 생성합니다.
  const selectedDefaultTagNames = useMemo(() => {
    const tagIds = localSettings.defaultFilterTagIds ?? [];
    if (tagIds.length === 0) return '';

    return tagIds
      .map(id => sortedTags.find(tag => tag.id === id)?.name) // ID로 태그 이름을 찾음
      .filter(Boolean) // 이름이 없는 경우(undefined)를 필터링
      .join(', '); // 쉼표와 공백으로 이름들을 연결
  }, [localSettings.defaultFilterTagIds, sortedTags]); // localSettings나 sortedTags가 바뀔 때만 재계산

  if (!isSettingsModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50" style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
      <div className="bg-elevated shadow-2xl rounded-lg p-4 sm:p-6 w-[600px] max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-primary">맞춤 설정</h2>
          <button
            onClick={handleClose}
            className="text-secondary hover:text-primary text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-secondary mb-6">
          <button
            onClick={() => setActiveTab('display')}
            className={`px-2 sm:px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === 'display'
                ? 'border-focus text-blue-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            표시옵션
          </button>
          {/* ✅ [신규] '초기화면' 탭 버튼을 여기에 추가합니다. */}
          <button
            onClick={() => setActiveTab('initial')}
            className={`px-2 sm:px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === 'initial'
                ? 'border-focus text-blue-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            초기화면
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-2 sm:px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === 'tags'
                ? 'border-focus text-blue-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            태그관리
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-2 sm:px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === 'data'
                ? 'border-focus text-blue-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            저장갱신
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Display Options Tab */}
            {activeTab === 'display' && (
              <div className="space-y-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-primary">
                      완독여부 표시
                    </label>
                    <p className="text-xs text-secondary mt-1 hidden sm:block">
                      내 서재에서 읽기 상태를 표시합니다.
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle('showReadStatus')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                      localSettings.showReadStatus ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        localSettings.showReadStatus ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-primary">
                      별표 표시
                    </label>
                    <p className="text-xs text-secondary mt-1 hidden sm:block">
                      내 서재에서 별점 평가를 표시합니다.
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle('showRating')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                      localSettings.showRating ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        localSettings.showRating ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-primary">
                      태그 보기
                    </label>
                    <p className="text-xs text-secondary mt-1 hidden sm:block">
                      내 서재에서 책별 태그를 표시합니다.
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle('showTags')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                      localSettings.showTags ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        localSettings.showTags ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-primary">
                      도서관별 재고 보기
                    </label>
                    <p className="text-xs text-secondary mt-1 hidden sm:block">
                      내 서재에서 도서관별 재고 정보를 표시합니다.
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle('showLibraryStock')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                      localSettings.showLibraryStock ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        localSettings.showLibraryStock ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-primary">
                      좋아요 아이콘 표시
                    </label>
                    <p className="text-xs text-secondary mt-1 hidden sm:block">
                      내 서재에서 책별 좋아요 버튼을 표시합니다.
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle('showFavorites')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                      localSettings.showFavorites ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        localSettings.showFavorites ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-primary">
                      메모 표시
                    </label>
                    <p className="text-xs text-secondary mt-1 hidden sm:block">
                      내 서재에서 책별 메모 기능을 표시합니다.
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle('showBookNotes')}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                      localSettings.showBookNotes ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        localSettings.showBookNotes ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* 기본 보기 건수 */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-primary">
                      기본 보기 건수
                    </label>
                    <p className="text-xs text-secondary mt-1 hidden sm:block">
                      내 서재 초기 로딩 시 표시할 책의 수를 설정합니다.
                    </p>
                  </div>
                  <select
                    value={localSettings.defaultPageSize}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, defaultPageSize: parseInt(e.target.value) }))}
                    disabled={saving}
                    className="input-base w-24 text-sm disabled:opacity-50"
                  >
                    <option value={25}>25권</option>
                    <option value={50}>50권</option>
                    <option value={100}>100권</option>
                    <option value={200}>200권</option>
                  </select>
                </div>

                {/*  테마 선택 */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-primary">
                      테마
                    </label>
                    <p className="text-xs text-secondary mt-1 hidden sm:block">
                      애플리케이션의 외관을 설정합니다.
                    </p>
                  </div>
                  <div className="theme-button-group flex flex-col sm:flex-row gap-2">
                    {[
                      { value: 'light', label: '라이트', icon: '☀️' },
                      { value: 'dark', label: '다크', icon: '🌙' },
                      { value: 'system', label: '시스템', icon: '⚙️' }
                    ].map((theme) => (
                      <button
                        key={theme.value}
                        onClick={async () => {
                          const newTheme = theme.value as Theme;
                          setLocalSettings(prev => ({ ...prev, theme: newTheme }));
                          try {
                            await setTheme(newTheme);
                          } catch (error) {
                            setNotification({ message: '테마 설정에 실패했습니다.', type: 'error' });
                          }
                        }}
                        disabled={saving}
                        className={`btn-base flex-1 ${
                          localSettings.theme === theme.value
                            ? 'btn-primary'
                            : 'btn-secondary'
                        }`}
                      >
                        <span className="mr-2">{theme.icon}</span>
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 초기화면 세팅 탭 */}
            {activeTab === 'initial' && (
              <div className="space-y-6 pb-4">
                                {/* ✅ 초기 화면 세팅 : 뷰 & 필터 설정 */}
                {/* <div className="space-y-6 pt-6 mt-6 border-t border-secondary"> */}
                  {/* <div>
                    <h4 className="text-sm font-medium text-primary">
                      내 서재 초기 필터 설정
                    </h4>
                    <p className="text-xs text-secondary mt-1 hidden sm:block">
                      내 서재에 처음 진입할 때 자동으로 적용할 필터를 설정합니다.
                    </p>
                  </div> */}

                  {/* 기본 보기 방식 - 카드뷰, 그리드뷰 */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-primary">
                        기본 보기 방식
                      </label>
                      <p className="text-xs text-secondary mt-1 hidden sm:block">
                        내 서재 진입 시 기본으로 표시될 보기 방식을 설정합니다.
                      </p>
                    </div>
                    <div className="theme-button-group flex flex-col sm:flex-row gap-2">
                      {[
                        { value: 'card', label: '카드 뷰', icon: ' M3 4a1 1 0 000 2h14a1 1 0 100-2H3zM3 8a1 1 0 000 2h14a1 1 0 100-2H3zM3 12a1 1 0 100 2h14a1 1 0 100-2H3z' },
                        { value: 'grid', label: '그리드 뷰', icon: 'M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' }
                      ].map((view) => (
                        <button
                          key={view.value}
                          onClick={() => {
                            const newViewType = view.value as ViewType;
                            setLocalSettings(prev => ({ ...prev, defaultViewType: newViewType }));
                          }}
                          disabled={saving}
                          className={`btn-base flex-1 ${
                            localSettings.defaultViewType === view.value
                              ? 'btn-primary'
                              : 'btn-secondary'
                          }`}
                        >
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d={view.icon} clipRule="evenodd" /></svg>
                          {view.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 좋아요 필터 설정 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-primary">
                        '좋아요'한 책만 보기
                      </label>
                      <p className="text-xs text-secondary mt-1 hidden sm:block">
                        이 옵션을 켜면 서재 진입 시 '좋아요' 필터가 자동으로 활성화됩니다.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        // 좋아요 필터와 태그 필터는 동시에 활성화될 수 없으므로,
                        // 좋아요를 켜면 태그 필터 설정을 초기화합니다.
                        const isEnabling = !localSettings.defaultFilterFavorites;
                        setLocalSettings(prev => ({
                          ...prev,
                          defaultFilterFavorites: isEnabling,
                          // ...(isEnabling && { defaultFilterTagIds: [] }) // 켤 때만 태그 초기화
                        }));
                      }}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                        localSettings.defaultFilterFavorites ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          localSettings.defaultFilterFavorites ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* 태그 필터 설정 */}
                  <div>
                    {/* ✅ [수정] 제목과 초기화 버튼을 한 줄에 배치하기 위해 flex 사용 */}
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <label className="text-sm font-medium text-primary">
                          기본 태그 필터
                        </label>
                        <p className="text-xs text-secondary mt-1 hidden sm:block">
                          서재 진입 시 자동으로 필터링할 태그를 선택하세요. (최대 3개)
                        </p>
                      </div>
                      
                      {/* ✅ [신규] '초기화' 버튼 추가 */}
                      {(localSettings.defaultFilterTagIds ?? []).length > 0 && (
                        <button
                          onClick={() => {
                            setLocalSettings(prev => ({
                              ...prev,
                              defaultFilterTagIds: [] // 태그 선택을 빈 배열로 초기화
                            }));
                          }}
                          className="text-xs text-secondary hover:text-primary underline"
                          title="선택한 태그 모두 해제"
                        >
                          초기화
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {sortedTags.map(tag => (
                        <CustomTagComponent
                          key={tag.id}
                          tag={tag}
                          isActive={(localSettings.defaultFilterTagIds ?? []).includes(tag.id)}
                          onClick={() => {
                            // ... (기존 onClick 로직은 그대로 유지)
                            const currentTags = localSettings.defaultFilterTagIds ?? [];
                            let newTags: string[];
                            if (currentTags.includes(tag.id)) {
                              newTags = currentTags.filter(id => id !== tag.id);
                            } else {
                              if (currentTags.length < 3) {
                                newTags = [...currentTags, tag.id];
                              } else {
                                setNotification({ message: '최대 3개의 태그만 선택할 수 있습니다.', type: 'warning' });
                                return;
                              }
                            }
                            setLocalSettings(prev => ({
                              ...prev,
                              defaultFilterTagIds: newTags,
                            }));
                          }}
                          size="sm"
                        />
                      ))}
                    </div>

                    {/* ✅ [신규] 선택된 태그 목록 표시 */}
                    {(localSettings.defaultFilterTagIds ?? []).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-secondary">
                        <span className="text-xs text-tertiary">
                          필터링 미리보기 : <span className="font-medium text-secondary">{selectedDefaultTagNames}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              // </div>
            )}

            {/* 태그관리 탭 */}
            {activeTab === 'tags' && (
              <div className="flex flex-col h-full">
                <div className="flex-shrink-0">
                  <h3 className="text-sm font-medium text-primary mb-3">
                    사용 중 태그 개수 : {sortedTags.length}개
                  </h3>
                  <button
                    onClick={async () => {
                      try {
                        const result = await recalculateAutoTagsForAllBooks();
                        setNotification({ message: `자동태그를 적용했습니다. (${result.changed}권 변경)`, type: 'success' });
                      } catch (error) {
                        setNotification({ message: '자동태그 적용에 실패했습니다.', type: 'error' });
                      }
                    }}
                    disabled={saving || myLibraryBooks.length === 0}
                    className="btn-base btn-secondary w-full mb-3 disabled:opacity-50"
                  >
                    기존 책에 자동태그 적용
                  </button>
                </div>

                {/* Tag List - 스크롤 가능 영역 */}
                <div className="flex-1 min-h-0">
                  <div className="max-h-[300px] overflow-y-auto space-y-2 mb-6">
                    {sortedTags.map((tag) => {
                      const autoRule = settings.tagSettings.autoTagRules?.find(rule => rule.tagId === tag.id);
                      const keywordCount = autoRule?.keywords.length ?? 0;

                      return (
                        <div key={tag.id} className="flex items-center justify-between p-3 border border-secondary rounded-lg">
                          <div className="flex items-center gap-3">
                            <CustomTagComponent tag={tag} size="sm" />
                            <span className="text-sm text-secondary">
                              {/* ✅ [수정] getTagUsageCount 대신 tagCounts 객체를 직접 사용합니다. */}
                              ({tagCounts[tag.id] || 0}권)
                              {/* ({getTagUsageCount(tag.id, myLibraryBooks)}권) */}
                            </span>
                            <span className="text-xs text-tertiary">
                              자동 {autoRule?.enabled === false ? '꺼짐' : `${keywordCount}개`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingAutoRuleTagId(tag.id);
                                setAutoKeywordInput((autoRule?.keywords ?? [tag.name]).join(', '));
                                setAutoRuleEnabled(autoRule?.enabled ?? true);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 underline"
                            >
                              자동
                            </button>
                            <button
                              onClick={() => setEditingTag(tag)}
                              className="text-xs text-blue-600 hover:text-blue-700 underline"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag)}
                              className="text-xs text-red-600 hover:text-red-700 underline"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {editingAutoRuleTagId && (
                    <div className="border-t border-secondary pt-4 mb-6">
                      <h4 className="text-sm font-medium text-primary mb-3">자동태그 키워드</h4>
                      <textarea
                        value={autoKeywordInput}
                        onChange={(event) => setAutoKeywordInput(event.target.value)}
                        className="input-base w-full min-h-[96px]"
                        placeholder="쉼표로 구분해 입력"
                      />
                      <p className="text-xs text-secondary mt-2">도서명에 포함되면 해당 태그가 자동으로 붙습니다.</p>
                      <div className="flex justify-between items-center mt-3">
                        <label className="flex items-center gap-2 text-sm text-secondary">
                          <input
                            type="checkbox"
                            checked={autoRuleEnabled}
                            onChange={(event) => setAutoRuleEnabled(event.target.checked)}
                          />
                          자동 적용
                        </label>
                        <div className="flex gap-2">
                          <button
                            className="btn-base btn-secondary"
                            onClick={() => setEditingAutoRuleTagId(null)}
                          >
                            취소
                          </button>
                          <button
                            className="btn-base btn-primary"
                            onClick={async () => {
                              await updateAutoTagRule(editingAutoRuleTagId, {
                                enabled: autoRuleEnabled,
                                keywords: autoKeywordInput.split(',').map(keyword => keyword.trim()).filter(Boolean),
                              });
                              setEditingAutoRuleTagId(null);
                            }}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add New Tag - 항상 하단 고정 */}
                  <div className="flex-shrink-0 pt-4">
                    {/* 구분선 보이는 버전 
                    <div className="flex-shrink-0 pt-4 border-t border-secondary"> 
                    */}
                    {/* <h4 className="text-sm font-medium text-primary mb-3">새 태그 추가</h4> */}
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="태그 이름"
                          className="input-base flex-1"
                          maxLength={20}
                        />
                        <button
                          onClick={handleCreateTag}
                          disabled={!newTagName.trim()}
                          className="btn-base btn-primary"
                        >
                          추가
                        </button>
                      </div>
                      <div className="flex gap-2">
                        {colorOptions.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setNewTagColor(color.value)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md border ${color.class} transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                              newTagColor === color.value
                                ? '' // 선택 시 full opacity (ring 제거)
                                : 'opacity-70 hover:opacity-100'
                            }`}
                            title={color.label}
                          >
                            {color.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 내보내기, 일괄갱신 탭 */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                {/* CSV 내보내기 */}
                <div>
                  <div className="p-4 border border-secondary rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-primary">
                          CSV로 내보내기
                        </label>
                        <p className="text-xs text-secondary mt-1 hidden sm:block">
                          내 서재의 모든 책 정보를 CSV 파일로 다운로드합니다.
                        </p>
                      </div>
                      <button
                        onClick={handleExportCSV}
                        disabled={isExporting || myLibraryBooks.length === 0}
                        className="btn-base btn-primary disabled:opacity-50 disabled:cursor-wait"
                      >
                        {isExporting 
                          ? '내보내는 중...' 
                          : `내보내기`
                          // : `전체 서재(${totalBooksCount}권) 내보내기`
                        }
                      </button>
                    </div>
                  </div>
                </div>

                {/* 재고 일괄 갱신 */}
                <div>
                  <div className="p-4 border border-secondary rounded-lg">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-primary">
                          재고 일괄 갱신
                        </label>
                        <p className="text-xs text-secondary mt-1 hidden sm:block">
                          내 서재의 책 재고 정보를 일괄적으로 갱신합니다.
                        </p>
                      </div>

                      {/* 갱신 범위 선택 */}
                      {!bulkRefreshState.isRunning && (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <label className="text-xs text-secondary whitespace-nowrap">
                              갱신 범위:
                            </label>
                            <select
                              // ✅ [수정] value를 selectedRefreshType으로 직접 관리
                              value={selectedRefreshType === 'error' ? 'error-only' : `${selectedRefreshType}-${selectedRefreshLimit}`} 
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === 'error-only') {
                                  setSelectedRefreshType('error');
                                  setSelectedRefreshLimit('all'); // limit는 'all'로 설정
                                } else {
                                  const [type, limit] = value.split('-');
                                  setSelectedRefreshType(type as RefreshType);
                                  setSelectedRefreshLimit(limit === 'all' || limit === 'custom' ? limit : parseInt(limit));
                                }
                              }}
                              className="input-base flex-1 text-sm"
                            >
                              {getRefreshOptions().map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            
                          </div>
                          
                          {/* ✅ [추가] 범위 지정 입력 필드 */}
                          {selectedRefreshType === 'range' && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={rangeStart}
                                onChange={(e) => setRangeStart(e.target.value)}
                                placeholder="시작"
                                className="input-base w-1/2 text-sm text-center"
                                min="1"
                                max={totalBooksCount}
                              />
                              <span className="text-secondary">~</span>
                              <input
                                type="number"
                                value={rangeEnd}
                                onChange={(e) => setRangeEnd(e.target.value)}
                                placeholder="끝"
                                className="input-base w-1/2 text-sm text-center"
                                min="1"
                                max={totalBooksCount}
                              />
                              <span className="text-xs text-secondary whitespace-nowrap">
                                (총 {totalBooksCount}권)
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 시작 버튼 (갱신 전) */}
                      {!bulkRefreshState.isRunning && (
                        <button
                          onClick={handleStartBulkRefresh}
                          disabled={myLibraryBooks.length === 0}
                          className="btn-base btn-primary w-full"
                        >
                          재고 일괄 갱신 시작
                        </button>
                      )}

                      {/* Progress 영역 (갱신 중) */}
                      {bulkRefreshState.isRunning && (
                      // {refreshState.isRunning && (
                        <div className="space-y-3">
                          {/* Progress Bar */}
                          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                              style={{
                                width: `${(bulkRefreshState.current / bulkRefreshState.total) * 100}%`,
                              }}
                            ></div>
                          </div>

                          {/* 진행률 텍스트 */}
                          <div className="flex justify-between items-center text-xs">
                          <span className="text-secondary truncate">
                            {bulkRefreshState.isPaused
                              ? `${bulkRefreshState.current} / ${bulkRefreshState.total}권 (일시정지됨)`
                              : `${bulkRefreshState.current} / ${bulkRefreshState.total}권 갱신 중...`}
                            {bulkRefreshState.currentBookTitle && !bulkRefreshState.isPaused && (
                                <span className="text-tertiary ml-2">
                                    ({bulkRefreshState.currentBookTitle.length > 10
                                        ? bulkRefreshState.currentBookTitle.substring(0, 10) + '…'
                                        : bulkRefreshState.currentBookTitle
                                    })
                                </span>
                            )}
                          </span>
                            {/* <span className="text-blue-600 font-medium">
                              {Math.round((bulkRefreshState.current / bulkRefreshState.total) * 100)}%
                            </span> */}
                            <span className="text-blue-600 font-medium whitespace-nowrap">
                              {/* ✅ 수정: bulkRefreshState 사용 (total이 0일 경우 NaN 방지) */}
                              {bulkRefreshState.total > 0
                                ? `${Math.round((bulkRefreshState.current / bulkRefreshState.total) * 100)}%`
                                : '0%'
                              }
                            </span>
                          </div>

                          {/* 실패 건수 */}
                          {bulkRefreshState.failed.length > 0 && (
                            <div className="text-xs text-red-600">
                              실패: {bulkRefreshState.failed}권
                            </div>
                          )}

                          {/* 제어 버튼 */}
                          <div className="flex gap-2">
                            <button
                              onClick={handleTogglePause}
                              className="btn-base btn-secondary flex-1 flex items-center justify-center gap-2"
                            >
                              {bulkRefreshState.isPaused ? (
                                <>
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                  </svg>
                                  재개
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                                  </svg>
                                  일시정지
                                </>
                              )}
                            </button>
                            <button
                              onClick={handleCancelRefresh}
                              className="btn-base bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Buttons - 표시 옵션 탭에서만 표시 */}
        {/* {activeTab === 'display' && ( */}
        {(activeTab === 'display' || activeTab === 'initial') && (
          <div className="flex gap-2 pt-6 mt-6 border-t border-secondary flex-shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="btn-base btn-secondary flex-1"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="btn-base btn-primary flex-1"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        )}

        {/* Edit Tag Modal */}
        {editingTag && (
          <div className="fixed inset-0 flex items-center justify-center z-60" style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
            <div className="bg-elevated shadow-xl rounded-lg p-6 w-96">
              <h3 className="text-lg font-bold text-primary mb-4">태그 수정</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-secondary mb-2">태그 이름</label>
                  <input
                    type="text"
                    defaultValue={editingTag.name}
                    ref={(input) => {
                      if (input) {
                        input.focus();
                        input.select();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateTag(editingTag.id, { name: e.currentTarget.value.trim() });
                      } else if (e.key === 'Escape') {
                        setEditingTag(null);
                      }
                    }}
                    className="input-base w-full"
                    maxLength={20}
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-2">색상</label>
                  <div className="flex gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => handleUpdateTag(editingTag.id, { color: color.value })}
                        className={`px-3 py-1 text-xs font-semibold rounded-md border ${color.class} transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                          editingTag.color === color.value
                            ? '' // 선택 시 full opacity (ring 제거)
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        title={color.label}
                      //   onClick={() => handleUpdateTag(editingTag.id, { color: color.value })}
                      //   className={`px-3 py-1 text-xs font-semibold rounded-md border ${color.class} ${
                      //     editingTag.color === color.value
                      //       ? 'ring-2 ring-ring ring-offset-2'
                      //       : 'opacity-70 hover:opacity-100'
                      //   }`}
                      //   title={color.label}
                      >
                        {color.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setEditingTag(null)}
                  className="btn-base btn-secondary flex-1"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
