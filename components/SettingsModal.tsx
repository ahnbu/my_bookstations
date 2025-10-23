import React, { useState, useEffect, useMemo } from 'react';
import { useUIStore } from '../stores/useUIStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useBookStore } from '../stores/useBookStore';
import type { CustomTag, TagColor, Theme } from '../types';
import CustomTagComponent from './CustomTag';

const SettingsModal: React.FC = () => {
  const { isSettingsModalOpen, closeSettingsModal, setNotification } = useUIStore();
  const { settings, loading, updateUserSettings, createTag, updateTag, deleteTag, getTagUsageCount, exportToCSV, setTheme } = useSettingsStore();
  const { myLibraryBooks, totalBooksCount, isAllBooksLoaded, tagCounts, fetchRemainingLibrary, bulkRefreshAllBooks, pauseBulkRefresh, resumeBulkRefresh, cancelBulkRefresh } = useBookStore();

  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'display' | 'tags' | 'data'>('display');
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<TagColor>('primary');

  // [추가] CSV 내보내기 진행 상태 추가
  const [isExporting, setIsExporting] = useState(false);

  // 일괄 갱신 상태
  const [selectedRefreshLimit, setSelectedRefreshLimit] = useState<number | 'all'>(25);
  const [refreshState, setRefreshState] = useState({
    isRunning: false,
    isPaused: false,
    current: 0,
    total: 0,
    failed: 0,
  });

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
    if (refreshState.isRunning) {
      const confirmed = window.confirm(
        '재고 갱신이 진행 중입니다.\n갱신을 취소하고 닫으시겠습니까?'
      );
      if (!confirmed) return;

      // 갱신 취소
      cancelBulkRefresh();
      setRefreshState({
        isRunning: false,
        isPaused: false,
        current: 0,
        total: 0,
        failed: 0,
      });
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
    const usageCount = getTagUsageCount(tag.id, myLibraryBooks);

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

  // const handleExportCSV = () => {
  //   try {
  //     exportToCSV(myLibraryBooks);
  //     setNotification({ message: 'CSV 파일이 다운로드됩니다.', type: 'success' });
  //   } catch (error) {
  //     setNotification({ message: 'CSV 내보내기에 실패했습니다.', type: 'error' });
  //   }
  // };

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
    const totalBooks = totalBooksCount; // DB 전체 권수 사용
    const options = [
      { value: 25, label: '최근 25권' },
      { value: 50, label: '최근 50권' },
      { value: 100, label: '최근 100권' },
      { value: 200, label: '최근 200권' },
      { value: 'all' as const, label: `전체 (${totalBooks}권)` },
    ];

    // 보유 권수보다 큰 선택지 필터링
    return options.filter(opt => opt.value === 'all' || opt.value <= totalBooks);
  };

  // 예상 소요 시간 계산 (초)
  const estimateRefreshTime = (bookCount: number) => {
    const batches = Math.ceil(bookCount / 10);
    const waitTime = (batches - 1) * 1; // 배치 간 대기
    const apiTime = batches * 2; // API 호출 시간
    return waitTime + apiTime;
  };

  // 일괄 갱신 시작
  const handleStartBulkRefresh = async () => {
    const limit = selectedRefreshLimit;
    const bookCount = limit === 'all' ? totalBooksCount : Math.min(limit, totalBooksCount);
    const estimatedTime = estimateRefreshTime(bookCount);

    const confirmed = window.confirm(
      `${bookCount}권의 재고를 갱신하시겠습니까?\n\n예상 소요 시간: 약 ${estimatedTime}초`
    );

    if (!confirmed) return;

    // 전체 갱신 선택 시, 아직 로드되지 않은 책이 있다면 먼저 로드
    if (limit === 'all' && !isAllBooksLoaded) {
      setNotification({
        message: '전체 책을 불러오는 중입니다...',
        type: 'success',
      });

      try {
        await fetchRemainingLibrary();
      } catch (error) {
        setNotification({
          message: '전체 책을 불러오는데 실패했습니다.',
          type: 'error',
        });
        return;
      }
    }

    setRefreshState({
      isRunning: true,
      isPaused: false,
      current: 0,
      total: bookCount,
      failed: 0,
    });

    bulkRefreshAllBooks(limit, {
      onProgress: (current, total, failed) => {
        setRefreshState(prev => ({
          ...prev,
          current,
          total,
          failed,
        }));
      },
      onComplete: (success, failedIds) => {
        setRefreshState({
          isRunning: false,
          isPaused: false,
          current: 0,
          total: 0,
          failed: 0,
        });

        if (failedIds.length === 0) {
          setNotification({
            message: `${success}권의 재고 갱신이 완료되었습니다.`,
            type: 'success',
          });
        } else if (success > 0) {
          setNotification({
            message: `${success}권 갱신 완료, ${failedIds.length}권 실패했습니다.`,
            type: 'warning',
          });
        } else {
          setNotification({
            message: '재고 갱신에 실패했습니다. 네트워크 연결을 확인해주세요.',
            type: 'error',
          });
        }
      },
      shouldPause: () => refreshState.isPaused,
      shouldCancel: () => false, // 취소는 별도 버튼으로 처리
    });
  };

  // 일시정지/재개 토글
  const handleTogglePause = () => {
    if (refreshState.isPaused) {
      resumeBulkRefresh();
      setRefreshState(prev => ({ ...prev, isPaused: false }));
    } else {
      pauseBulkRefresh();
      setRefreshState(prev => ({ ...prev, isPaused: true }));
    }
  };

  // 취소
  const handleCancelRefresh = () => {
    const confirmed = window.confirm('재고 갱신을 중단하시겠습니까?');
    if (!confirmed) return;

    cancelBulkRefresh();
    setRefreshState({
      isRunning: false,
      isPaused: false,
      current: 0,
      total: 0,
      failed: 0,
    });

    setNotification({
      message: `재고 갱신이 취소되었습니다. (${refreshState.current}/${refreshState.total}권 완료)`,
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
      // const aUsage = getTagUsageCount(a.id, myLibraryBooks);
      // const bUsage = getTagUsageCount(b.id, myLibraryBooks);
      // ✅ [수정] getTagUsageCount 대신 tagCounts 객체를 사용합니다.
      const aUsage = tagCounts[a.id] || 0;
      const bUsage = tagCounts[b.id] || 0;

      return bUsage - aUsage;
    });
  // }, [settings.tagSettings?.tags, myLibraryBooks, getTagUsageCount]);
  }, [settings.tagSettings?.tags, tagCounts]);

  if (!isSettingsModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50" style={{ backgroundColor: 'var(--color-bg-overlay)' }}>
      <div className="bg-elevated shadow-2xl rounded-lg p-6 w-[600px] max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
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
        <div className="flex border-b border-secondary mb-6">
          <button
            onClick={() => setActiveTab('display')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'display'
                ? 'border-focus text-blue-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            표시옵션
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'tags'
                ? 'border-focus text-blue-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            태그관리
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
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

            {/* Tag Management Tab */}
            {activeTab === 'tags' && (
              <div className="flex flex-col h-full">
                <div className="flex-shrink-0">
                  <h3 className="text-sm font-medium text-primary mb-3">
                    사용 중 태그 개수 : {sortedTags.length}개
                  </h3>
                </div>

                {/* Tag List - 스크롤 가능 영역 */}
                <div className="flex-1 min-h-0">
                  <div className="max-h-[300px] overflow-y-auto space-y-2 mb-6">
                    {sortedTags.map((tag) => (
                      <div key={tag.id} className="flex items-center justify-between p-3 border border-secondary rounded-lg">
                        <div className="flex items-center gap-3">
                          <CustomTagComponent tag={tag} size="sm" />
                          <span className="text-sm text-secondary">
                            {/* ✅ [수정] getTagUsageCount 대신 tagCounts 객체를 직접 사용합니다. */}
                            ({tagCounts[tag.id] || 0}권)
                            {/* ({getTagUsageCount(tag.id, myLibraryBooks)}권) */}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
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
                    ))}
                  </div>

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

            {/* Data Management Tab */}
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
                      {!refreshState.isRunning && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <label className="text-xs text-secondary whitespace-nowrap">
                            갱신 범위:
                          </label>
                          <select
                            value={selectedRefreshLimit}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSelectedRefreshLimit(value === 'all' ? 'all' : parseInt(value));
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
                      )}

                      {/* 시작 버튼 (갱신 전) */}
                      {!refreshState.isRunning && (
                        <button
                          onClick={handleStartBulkRefresh}
                          disabled={myLibraryBooks.length === 0}
                          className="btn-base btn-primary w-full"
                        >
                          재고 일괄 갱신 시작
                        </button>
                      )}

                      {/* Progress 영역 (갱신 중) */}
                      {refreshState.isRunning && (
                        <div className="space-y-3">
                          {/* Progress Bar */}
                          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                              style={{
                                width: `${(refreshState.current / refreshState.total) * 100}%`,
                              }}
                            ></div>
                          </div>

                          {/* 진행률 텍스트 */}
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-secondary">
                              {refreshState.isPaused
                                ? `${refreshState.current} / ${refreshState.total}권 (일시정지됨)`
                                : `${refreshState.current} / ${refreshState.total}권 갱신 중...`}
                            </span>
                            <span className="text-blue-600 font-medium">
                              {Math.round((refreshState.current / refreshState.total) * 100)}%
                            </span>
                          </div>

                          {/* 실패 건수 */}
                          {refreshState.failed > 0 && (
                            <div className="text-xs text-red-600">
                              실패: {refreshState.failed}권
                            </div>
                          )}

                          {/* 제어 버튼 */}
                          <div className="flex gap-2">
                            <button
                              onClick={handleTogglePause}
                              className="btn-base btn-secondary flex-1 flex items-center justify-center gap-2"
                            >
                              {refreshState.isPaused ? (
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
        {activeTab === 'display' && (
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