import React, { useState, useEffect, useMemo } from 'react';
import { useUIStore } from '../stores/useUIStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useBookStore } from '../stores/useBookStore';
import type { CustomTag, TagColor } from '../types';
import CustomTagComponent from './CustomTag';

const SettingsModal: React.FC = () => {
  const { isSettingsModalOpen, closeSettingsModal, setNotification } = useUIStore();
  const { settings, loading, updateUserSettings, createTag, updateTag, deleteTag, getTagUsageCount, exportToCSV, setTheme } = useSettingsStore();
  const { myLibraryBooks } = useBookStore();

  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'display' | 'tags' | 'data'>('display');
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<TagColor>('primary');

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

  const handleExportCSV = () => {
    try {
      exportToCSV(myLibraryBooks);
      setNotification({ message: 'CSV 파일이 다운로드됩니다.', type: 'success' });
    } catch (error) {
      setNotification({ message: 'CSV 내보내기에 실패했습니다.', type: 'error' });
    }
  };

  const colorOptions: { value: TagColor; label: string; class: string }[] = [
    { value: 'primary', label: '기본', class: 'tag-primary' },
    { value: 'secondary', label: '보조', class: 'tag-secondary' },
  ];

  // 태그 정렬: 1차-색상별(기본>보조), 2차-사용량별(많은순)
  const sortedTags = useMemo(() => {
    if (!settings.tagSettings?.tags) return [];

    return [...settings.tagSettings.tags].sort((a, b) => {
      // 1차 정렬: 색상별 (기본색상 > 보조색상)
      const colorOrder = { 'primary': 0, 'secondary': 1 };
      const colorDiff = colorOrder[a.color] - colorOrder[b.color];
      if (colorDiff !== 0) return colorDiff;

      // 2차 정렬: 사용량별 (많이 사용 > 적게 사용)
      const aUsage = getTagUsageCount(a.id, myLibraryBooks);
      const bUsage = getTagUsageCount(b.id, myLibraryBooks);
      return bUsage - aUsage;
    });
  }, [settings.tagSettings?.tags, myLibraryBooks, getTagUsageCount]);

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
            표시 옵션
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'tags'
                ? 'border-focus text-blue-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            태그 관리
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'data'
                ? 'border-focus text-blue-600'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            내보내기
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            {/* Display Options Tab */}
            {activeTab === 'display' && (
              <div className="space-y-6">
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

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-primary">
                      테마
                    </label>
                    <p className="text-xs text-secondary mt-1 hidden sm:block">
                      애플리케이션의 외관을 설정합니다.
                    </p>
                  </div>
                  <div className="theme-button-group flex flex-row gap-2">
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
                    내 태그 ({sortedTags.length}개)
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
                            ({getTagUsageCount(tag.id, myLibraryBooks)}권)
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
                            className={`px-3 py-1 text-xs font-semibold rounded-md border ${color.class} ${
                              newTagColor === color.value
                                ? 'ring-2 ring-ring ring-offset-2'
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
                <div>
                  {/* <h3 className="text-sm font-medium text-primary mb-3">내보내기</h3> */}
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
                        className="btn-base btn-primary"
                      >
                        내보내기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Buttons - 표시 옵션 탭에서만 표시 */}
        {activeTab === 'display' && (
          <div className="flex gap-2 pt-6 mt-6 border-t border-secondary">
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
                        className={`px-3 py-1 text-xs font-semibold rounded-md border ${color.class} ${
                          editingTag.color === color.value
                            ? 'ring-2 ring-ring ring-offset-2'
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