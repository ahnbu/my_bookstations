import React, { useState } from 'react';
import { useUIStore } from '../stores/useUIStore';
import APITestContent from './APITestContent';
import DevNoteContent from './DevNoteContent';
import BulkBookSearchContent from './BulkBookSearchContent';
import DefaultSettingsContent from './DefaultSettingsContent';

// DevTools 모달 컴포넌트
interface DevToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DevToolsModal: React.FC<DevToolsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'apiTest' | 'devNote' | 'bulkSearch' | 'defaultSettings'>('bulkSearch');
  const { setAPITestMode } = useUIStore();

  // 모달이 열릴 때 API 테스트 모드 활성화, 닫힐 때 비활성화
  React.useEffect(() => {
    if (isOpen && activeTab === 'apiTest') {
      setAPITestMode(true);
    }
    return () => {
      if (!isOpen) {
        setAPITestMode(false);
      }
    };
  }, [isOpen, activeTab, setAPITestMode]);

  // 탭이 변경될 때 API 테스트 모드 설정
  const handleTabChange = (tab: 'apiTest' | 'devNote' | 'bulkSearch' | 'defaultSettings') => {
    setActiveTab(tab);
    if (tab === 'apiTest') {
      setAPITestMode(true);
    } else {
      setAPITestMode(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* 모달 컨텐츠 */}
      <div className="relative bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl h-[95vh] mx-4 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <div className="flex items-center gap-3">
            {/* <span className="text-2xl">🛠️</span>  */}
            <div>
              <h2 className="text-xl font-bold text-white">개발자 도구</h2>
              {/* <p className="text-sm text-gray-400">API 테스트 및 개발 노트</p> */}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-full"
            title="닫기 (ESC)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 탭 헤더 */}
        <div className="flex border-b border-gray-600">
          <button
            onClick={() => handleTabChange('bulkSearch')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'bulkSearch'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                : 'text-gray-300 hover:text-white hover:bg-gray-700/30'
            }`}
          >
            대량조회
          </button>
          <button
            onClick={() => handleTabChange('apiTest')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'apiTest'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                : 'text-gray-300 hover:text-white hover:bg-gray-700/30'
            }`}
          >
            API 테스트
          </button>
          <button
            onClick={() => handleTabChange('devNote')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'devNote'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                : 'text-gray-300 hover:text-white hover:bg-gray-700/30'
            }`}
          >
            개발노트
          </button>
          <button
            onClick={() => handleTabChange('defaultSettings')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'defaultSettings'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                : 'text-gray-300 hover:text-white hover:bg-gray-700/30'
            }`}
          >
            기본값설정
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'bulkSearch' && (
            <div className="h-full overflow-y-auto p-6">
              <BulkBookSearchContent />
            </div>
          )}

          {activeTab === 'apiTest' && (
            <div className="h-full overflow-y-auto p-6">
              <APITestContent />
            </div>
          )}

          {activeTab === 'devNote' && (
            <div className="h-full p-6">
              <DevNoteContent />
            </div>
          )}

          {activeTab === 'defaultSettings' && (
            <div className="h-full overflow-y-auto p-6">
              <DefaultSettingsContent />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 메인 플로팅 컴포넌트
const DevToolsFloat: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ESC 키로 모달 닫기
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // 모달이 열릴 때 body 스크롤 방지
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 z-40 flex flex-col items-center justify-center group"
        title="개발자 도구 열기"
      >
        <span className="text-xl group-hover:animate-pulse">🛠️</span>
        <span className="text-xs opacity-90 mt-0.5">DEV</span>
      </button>

      {/* 개발자 도구 모달 */}
      <DevToolsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
};

export default DevToolsFloat;