import React, { useState, useEffect } from 'react';
import { useUIStore } from '../stores/useUIStore';
import { useSettingsStore } from '../stores/useSettingsStore';

const SettingsModal: React.FC = () => {
  const { isSettingsModalOpen, closeSettingsModal, setNotification } = useUIStore();
  const { settings, loading, updateUserSettings } = useSettingsStore();
  
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isSettingsModalOpen) {
      setLocalSettings(settings);
    }
  }, [isSettingsModalOpen, settings]);

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
    closeSettingsModal();
  };

  const handleToggle = (key: keyof typeof localSettings) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (!isSettingsModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">맞춤 설정</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Show Read Status Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  완독여부 표시
                </label>
                <p className="text-xs text-gray-500 mt-1">
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

            {/* Show Rating Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  별표 표시
                </label>
                <p className="text-xs text-gray-500 mt-1">
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
          </div>
        )}

        <div className="flex gap-2 pt-6 mt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;