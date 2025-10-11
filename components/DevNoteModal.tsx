import React from 'react';
import { useUIStore } from '../stores/useUIStore';
import DevNoteContent from './DevNoteContent';

const DevNoteModal: React.FC = () => {
  const { isDevNoteModalOpen, closeDevNoteModal } = useUIStore();

  // ESC 키로 모달 닫기
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDevNoteModalOpen) {
        closeDevNoteModal();
      }
    };

    if (isDevNoteModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDevNoteModalOpen, closeDevNoteModal]);

  if (!isDevNoteModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={closeDevNoteModal}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl h-[95vh] mx-4 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <h2 className="text-xl font-bold text-white">개발노트</h2>
              {/* <p className="text-sm text-gray-400">개발 과정의 메모와 노트를 관리할 수 있습니다</p> */}
            </div>
          </div>
          <button
            onClick={closeDevNoteModal}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-full"
            title="닫기 (ESC)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full p-6">
            <DevNoteContent />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevNoteModal;
