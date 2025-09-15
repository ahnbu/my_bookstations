import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import type { UserSettings, TagColor, CustomTag, Theme } from '../types';

const DefaultSettingsContent: React.FC = () => {
  const { settings } = useSettingsStore();
  const [defaultSettings, setDefaultSettings] = useState<UserSettings>({
    showReadStatus: true,
    showRating: true,
    showTags: true,
    showLibraryStock: true,
    showFavorites: true,
    tagSettings: {
      tags: [
        {
          id: 'default_personal',
          name: '개인',
          color: 'primary' as TagColor,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ],
      maxTags: 5,
    },
    theme: 'system' as Theme,
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleToggle = (key: keyof UserSettings) => {
    if (key === 'tagSettings' || key === 'theme') return; // 이 필드들은 별도 처리

    setDefaultSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleThemeChange = (theme: Theme) => {
    setDefaultSettings(prev => ({
      ...prev,
      theme
    }));
  };

  const addDefaultTag = () => {
    const newTag: CustomTag = {
      id: `default_tag_${Date.now()}`,
      name: '새 태그',
      color: 'primary',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setDefaultSettings(prev => ({
      ...prev,
      tagSettings: {
        ...prev.tagSettings,
        tags: [...prev.tagSettings.tags, newTag]
      }
    }));
  };

  const removeDefaultTag = (tagId: string) => {
    setDefaultSettings(prev => ({
      ...prev,
      tagSettings: {
        ...prev.tagSettings,
        tags: prev.tagSettings.tags.filter(tag => tag.id !== tagId)
      }
    }));
  };

  const updateTagName = (tagId: string, newName: string) => {
    setDefaultSettings(prev => ({
      ...prev,
      tagSettings: {
        ...prev.tagSettings,
        tags: prev.tagSettings.tags.map(tag =>
          tag.id === tagId ? { ...tag, name: newName, updatedAt: Date.now() } : tag
        )
      }
    }));
  };

  const updateTagColor = (tagId: string, newColor: TagColor) => {
    setDefaultSettings(prev => ({
      ...prev,
      tagSettings: {
        ...prev.tagSettings,
        tags: prev.tagSettings.tags.map(tag =>
          tag.id === tagId ? { ...tag, color: newColor, updatedAt: Date.now() } : tag
        )
      }
    }));
  };

  const applyDefaultSettings = async () => {
    setSaving(true);
    try {
      // 실제로는 관리자용 기본값을 저장하는 API 호출
      // 현재는 localStorage에 저장하는 방식으로 구현
      localStorage.setItem('adminDefaultSettings', JSON.stringify(defaultSettings));

      setMessage({ text: '기본값이 성공적으로 적용되었습니다.', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ text: '기본값 적용에 실패했습니다.', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const resetToOriginal = () => {
    setDefaultSettings({
      showReadStatus: true,
      showRating: true,
      showTags: true,
      showLibraryStock: true,
      showFavorites: true,
      tagSettings: {
        tags: [
          {
            id: 'default_personal',
            name: '개인',
            color: 'primary',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        ],
        maxTags: 5,
      },
      theme: 'system',
    });
    setMessage({ text: '기본값이 초기화되었습니다.', type: 'success' });
    setTimeout(() => setMessage(null), 3000);
  };

  // 컴포넌트 마운트 시 저장된 기본값 로드
  useEffect(() => {
    const savedDefaults = localStorage.getItem('adminDefaultSettings');
    if (savedDefaults) {
      try {
        setDefaultSettings(JSON.parse(savedDefaults));
      } catch (error) {
        console.error('저장된 기본값 로드 실패:', error);
      }
    }
  }, []);

  const colorOptions: { value: TagColor; label: string; class: string }[] = [
    { value: 'primary', label: '기본', class: 'tag-primary' },
    { value: 'secondary', label: '보조', class: 'tag-secondary' },
  ];

  return (
    <div className="space-y-8 text-white">
      {/* 
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">기본값 설정</h2>
        <p className="text-gray-400">새로운 사용자가 가입할 때 적용되는 기본 설정을 관리합니다.</p>
      </div>
      */}
      {/* 표시 옵션 기본값 */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-6">
        <h3 className="text-xl font-semibold text-white mb-4">표시 옵션 기본값</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">완독여부 표시</label>
              <p className="text-xs text-gray-400 mt-1">내 서재에서 읽기 상태를 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showReadStatus')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                defaultSettings.showReadStatus ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  defaultSettings.showReadStatus ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">별표 표시</label>
              <p className="text-xs text-gray-400 mt-1">내 서재에서 별점 평가를 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showRating')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                defaultSettings.showRating ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  defaultSettings.showRating ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">태그 보기</label>
              <p className="text-xs text-gray-400 mt-1">내 서재에서 책별 태그를 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showTags')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                defaultSettings.showTags ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  defaultSettings.showTags ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">도서관별 재고 보기</label>
              <p className="text-xs text-gray-400 mt-1">내 서재에서 도서관별 재고 정보를 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showLibraryStock')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                defaultSettings.showLibraryStock ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  defaultSettings.showLibraryStock ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">좋아요 아이콘 표시</label>
              <p className="text-xs text-gray-400 mt-1">내 서재에서 책별 좋아요 버튼을 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showFavorites')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                defaultSettings.showFavorites ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  defaultSettings.showFavorites ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-white">테마</label>
              <p className="text-xs text-gray-400 mt-1">애플리케이션의 기본 외관을 설정합니다.</p>
            </div>
            <div className="flex gap-2">
              {[
                { value: 'light', label: '라이트', icon: '☀️' },
                { value: 'dark', label: '다크', icon: '🌙' },
                { value: 'system', label: '시스템', icon: '⚙️' }
              ].map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => handleThemeChange(theme.value as Theme)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    defaultSettings.theme === theme.value
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span className="mr-2">{theme.icon}</span>
                  {theme.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 기본 태그 설정 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4">기본 태그 설정</h3>
        <p className="text-gray-400 text-sm mb-4">새 사용자에게 기본으로 제공할 태그를 설정합니다.</p>

        <div className="space-y-3 mb-4">
          {defaultSettings.tagSettings.tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
              <input
                type="text"
                value={tag.name}
                onChange={(e) => updateTagName(tag.id, e.target.value)}
                className="flex-1 px-3 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500"
                maxLength={20}
              />
              <div className="flex gap-1">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => updateTagColor(tag.id, color.value)}
                    className={`px-2 py-1 text-xs font-semibold rounded border ${color.class} ${
                      tag.color === color.value
                        ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-700'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    title={color.label}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => removeDefaultTag(tag.id)}
                className="px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-red-600 hover:border-red-500 rounded"
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addDefaultTag}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          기본 태그 추가
        </button>
      </div>

      {/* 액션 버튼들 */}
      {/* 구분선 없앰 
      <div className="flex gap-4 pt-6 border-t border-gray-600">
      */}
      <div className="flex gap-4 pt-6">
        <button
          onClick={applyDefaultSettings}
          disabled={saving}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg transition-colors font-medium"
        >
          {saving ? '적용 중...' : '기본값 적용'}
        </button>
        <button
          onClick={resetToOriginal}
          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          초기화
        </button>
      </div>

      {/* 메시지 표시 - 버튼 하단으로 이동 */}
      {message && (
        <div className={`mt-4 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-600/20 text-green-400 border border-green-600/30'
            : 'bg-red-600/20 text-red-400 border border-red-600/30'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default DefaultSettingsContent;