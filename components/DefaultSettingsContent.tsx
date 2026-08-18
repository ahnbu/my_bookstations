import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { PlusIcon } from './Icons';
import type { UserSettings, TagColor, CustomTag, Theme } from '../types';

const DefaultSettingsContent: React.FC = () => {
  const { settings } = useSettingsStore();
  const [defaultSettings, setDefaultSettings] = useState<UserSettings>({
    showReadStatus: true,
    showRating: true,
    showTags: true,
    showLibraryStock: true,
    showFavorites: true,
    showBookNotes: true,
    defaultPageSize: 50,
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

  // 환영 메시지 설정 상태
  const [welcomeMessageSettings, setWelcomeMessageSettings] = useState({
    enabled: true,
    content: `마이 북스테이션에
오신 것을 환영합니다.

이 서비스는
경기도 광주시의
책을 좋아하는 사람들이
지역 도서관과 전자도서관 재고를
간편하게 찾아볼 수 있도록
만든 것입니다.

맨 위 검색 창에
원하는 책 제목을 입력하고
"내 서재 추가"를 눌러보세요.

그러면 해당 책이
관내 도서관에 있는지
도서관 전자책이 있는지
알 수 있습니다.

💡 가끔 재고 확인에
오류가 나기도 하니
재고가 없는 경우는
책 오른쪽 끝에 있는
새로고침 버튼을 눌러보세요.`
  });
  const [isEditingWelcomeMessage, setIsEditingWelcomeMessage] = useState(false);

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
      localStorage.setItem('adminWelcomeMessageSettings', JSON.stringify(welcomeMessageSettings));

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
    if (window.confirm('정말로 모든 설정을 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      setDefaultSettings({
        showReadStatus: true,
        showRating: true,
        showTags: true,
        showLibraryStock: true,
        showFavorites: true,
        showBookNotes: true,
        defaultPageSize: 50,
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
    }
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

    // 환영 메시지 설정 로드
    const savedWelcomeSettings = localStorage.getItem('adminWelcomeMessageSettings');
    if (savedWelcomeSettings) {
      try {
        setWelcomeMessageSettings(JSON.parse(savedWelcomeSettings));
      } catch (error) {
        console.error('저장된 환영 메시지 설정 로드 실패:', error);
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
      <div className="bg-gray-800 rounded-lg space-y-6">
        <h3 className="text-xl font-semibold text-white mb-4 pt-6">기본값 설정 (신규 유저만 적용)</h3>

        <div className="space-y-4 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">완독여부 표시</label>
              <p className="text-xs text-secondary mt-1 hidden sm:block">내 서재에서 읽기 상태를 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showReadStatus')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                defaultSettings.showReadStatus ? 'bg-blue-600' : 'bg-gray-200'
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
              <p className="text-xs text-secondary mt-1 hidden sm:block">내 서재에서 별점 평가를 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showRating')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                defaultSettings.showRating ? 'bg-blue-600' : 'bg-gray-200'
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
              <p className="text-xs text-secondary mt-1 hidden sm:block">내 서재에서 책별 태그를 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showTags')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                defaultSettings.showTags ? 'bg-blue-600' : 'bg-gray-200'
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
              <p className="text-xs text-secondary mt-1 hidden sm:block">내 서재에서 도서관별 재고 정보를 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showLibraryStock')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                defaultSettings.showLibraryStock ? 'bg-blue-600' : 'bg-gray-200'
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
              <p className="text-xs text-secondary mt-1 hidden sm:block">내 서재에서 책별 좋아요 버튼을 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showFavorites')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                defaultSettings.showFavorites ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  defaultSettings.showFavorites ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">메모 표시</label>
              <p className="text-xs text-secondary mt-1 hidden sm:block">내 서재에서 책별 메모 기능을 표시합니다.</p>
            </div>
            <button
              onClick={() => handleToggle('showBookNotes')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                defaultSettings.showBookNotes ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  defaultSettings.showBookNotes ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">기본 보기 건수</label>
              <p className="text-xs text-secondary mt-1 hidden sm:block">새 사용자의 내 서재 초기 로딩 시 표시할 책의 수를 설정합니다.</p>
            </div>
            <select
              value={defaultSettings.defaultPageSize}
              onChange={(e) => setDefaultSettings(prev => ({ ...prev, defaultPageSize: parseInt(e.target.value) }))}
              className="input-base w-24 text-sm"
            >
              <option value={25}>25권</option>
              <option value={50}>50권</option>
              <option value={100}>100권</option>
              <option value={200}>200권</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">초기 안내 메시지</label>
              <p className="text-xs text-secondary mt-1 hidden sm:block">첫 방문자에게 표시되는 환영 메시지를 관리합니다.</p>
              <p className="text-xs text-amber-400 mt-1">이 설정은 지금 사용 중인 브라우저에만 적용됩니다. 다른 방문자에게는 기본값(표시 안 함)이 적용됩니다.</p>
            </div>
            <button
              onClick={() => setWelcomeMessageSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                welcomeMessageSettings.enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  welcomeMessageSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {welcomeMessageSettings.enabled && (
            <div className="space-y-3">
              <div className="flex flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => setIsEditingWelcomeMessage(!isEditingWelcomeMessage)}
                  className="btn-base btn-secondary flex-1"
                >
                  {isEditingWelcomeMessage ? '편집 완료' : '메시지 수정'}
                </button>
                <button
                  onClick={() => {
                    setWelcomeMessageSettings(prev => ({
                      ...prev,
                      content: `마이 북스테이션에
오신 것을 환영합니다.

이 서비스는
경기도 광주시의
책을 좋아하는 사람들이
지역 도서관과 전자도서관 재고를
간편하게 찾아볼 수 있도록
만든 것입니다.

맨 위 검색 창에
원하는 책 제목을 입력하고
"내 서재 추가"를 눌러보세요.

그러면 해당 책이
관내 도서관에 있는지
도서관 전자책이 있는지
알 수 있습니다.

💡 가끔 재고 확인에
오류가 나기도 하니
재고가 없는 경우는
책 오른쪽 끝에 있는
새로고침 버튼을 눌러보세요.`
                    }));
                  }}
                  className="btn-base btn-secondary flex-1"
                >
                  메시지 원래대로
                </button>
              </div>

              {isEditingWelcomeMessage && (
                <div className="space-y-3">
                  <textarea
                    value={welcomeMessageSettings.content}
                    onChange={(e) => setWelcomeMessageSettings(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full h-64 px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 resize-none text-sm leading-relaxed"
                    placeholder="환영 메시지를 입력하세요..."
                  />
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-2">미리보기:</h4>
                    <div className="text-sm text-secondary leading-relaxed whitespace-pre-line">
                      {welcomeMessageSettings.content || '메시지를 입력하세요...'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-white">테마</label>
              <p className="text-xs text-secondary mt-1 hidden sm:block">애플리케이션의 기본 외관을 설정합니다.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {[
                { value: 'light', label: '라이트', icon: '☀️' },
                { value: 'dark', label: '다크', icon: '🌙' },
                { value: 'system', label: '시스템', icon: '⚙️' }
              ].map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => handleThemeChange(theme.value as Theme)}
                  className={`btn-base flex-1 ${
                    defaultSettings.theme === theme.value
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
      </div>

      {/* 기본 태그 설정 */}
      <div className="bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between pt-6 mb-4">
          <h3 className="text-xl font-semibold text-white">기본 태그 설정</h3>
          <button
            onClick={addDefaultTag}
            className="btn-base btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            태그 추가
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-4 hidden sm:block">새 사용자에게 기본으로 제공할 태그를 설정합니다.</p>

        <div className="space-y-3 mb-4">
          {defaultSettings.tagSettings.tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2 sm:gap-3 p-3 bg-gray-700 rounded-lg">
              <input
                type="text"
                value={tag.name}
                onChange={(e) => updateTagName(tag.id, e.target.value)}
                className="flex-1 min-w-0 px-3 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 text-sm"
                maxLength={20}
              />
              <div className="flex gap-1 flex-shrink-0">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => updateTagColor(tag.id, color.value)}
                    className={`px-2 py-1 text-xs font-semibold rounded border ${color.class} ${
                      tag.color === color.value
                        ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-700'
                        : 'opacity-70 hover:opacity-100'
                    } whitespace-nowrap`}
                    title={color.label}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => removeDefaultTag(tag.id)}
                className="px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-red-600 hover:border-red-500 rounded flex-shrink-0 whitespace-nowrap"
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <div className="pb-6">
        </div>
      </div>

      {/* 액션 버튼들 */}
      {/* 구분선 없앰 
      <div className="flex gap-4 pt-6 border-t border-gray-600">
      */}
      <div className="flex gap-4 pt-6">
        <button
          onClick={applyDefaultSettings}
          disabled={saving}
          className="btn-base btn-primary flex-1"
        >
          {saving ? '저장 중...' : '변경 저장하기'}
        </button>
        <button
          onClick={resetToOriginal}
          className="btn-base btn-primary flex-1"
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