import React, { useState } from 'react';
import { useUIStore } from '../stores/useUIStore';
import APITestContent from './APITestContent';
import DevNoteContent from './DevNoteContent';
import BulkBookSearchContent from './BulkBookSearchContent';
import DefaultSettingsContent from './DefaultSettingsContent';

// 관리자 기능 모달 컴포넌트
interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'siteManagement' | 'devTools'>('siteManagement');
  const { setAPITestMode, openBulkSearchModal, openAPITestModal, openDevNoteModal } = useUIStore();

  // 모달이 닫힐 때 API 테스트 모드 비활성화
  React.useEffect(() => {
    if (!isOpen) {
      setAPITestMode(false);
    }
  }, [isOpen, setAPITestMode]);

  // 탭이 변경될 때 처리
  const handleTabChange = (tab: 'siteManagement' | 'devTools') => {
    setActiveTab(tab);
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
              <h2 className="text-xl font-bold text-white">관리자 기능</h2>
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
            onClick={() => handleTabChange('siteManagement')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'siteManagement'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                : 'text-gray-300 hover:text-white hover:bg-gray-700/30'
            }`}
          >
            사이트관리
          </button>
          <button
            onClick={() => handleTabChange('devTools')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'devTools'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                : 'text-gray-300 hover:text-white hover:bg-gray-700/30'
            }`}
          >
            개발도구
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'siteManagement' && (
            <div className="h-full overflow-y-auto p-6">
              <DefaultSettingsContent />
            </div>
          )}

          {activeTab === 'devTools' && (
            <div className="h-full p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <button className="btn-base flex-1 btn-primary" onClick={openBulkSearchModal}>
                  <span className="mr-2">📚</span>대량조회
                </button>
                <button className="btn-base flex-1 btn-primary" onClick={openAPITestModal}>
                  <span className="mr-2">🔧</span>API 테스트
                </button>
                <button className="btn-base flex-1 btn-primary" onClick={openDevNoteModal}>
                  <span className="mr-2">📝</span>개발노트
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 메인 관리자 패널 컴포넌트 (플로팅 버튼 제거)
const AdminPanel: React.FC = () => {
  const { isAdminModalOpen, closeAdminModal } = useUIStore();

  // ESC 키로 모달 닫기
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isAdminModalOpen) {
        closeAdminModal();
      }
    };

    if (isAdminModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // 모달이 열릴 때만 body 스크롤 방지
      if (document.body.style.overflow !== 'hidden') {
        document.body.style.overflow = 'hidden';
      }
    } else {
      // 모달이 닫힐 때만 body 스크롤 복원
      if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = 'unset';
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAdminModalOpen, closeAdminModal]);

  return (
    <>
      {/* 관리자 기능 모달 */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={closeAdminModal}
      />
    </>
  );
};

export default AdminPanel;