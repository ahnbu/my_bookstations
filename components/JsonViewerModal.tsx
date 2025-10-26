// 파일 위치: components/JsonViewerModal.tsx

// import React, 'react';
// import React, { useEffect } from 'react';
import React, { useEffect, useState } from 'react';
import { CloseIcon, CopyIcon } from './Icons'; // ✅ CopyIcon import 추가
import { useUIStore } from '../stores/useUIStore';

const JsonViewerModal: React.FC = () => {
  const {
    isJsonViewerModalOpen,
    jsonViewerData,
    jsonViewerTitle,
    closeJsonViewerModal,
    setNotification, // ✅ useUIStore에서 setNotification 액션을 가져옵니다.
  } = useUIStore();

  // ESC 키로 모달을 닫는 로직은 App.tsx 등 상위 컴포넌트나
  // 전역 이벤트 리스너로 관리하는 것이 더 효율적일 수 있습니다.
  // 여기서는 컴포넌트 내부에 두겠습니다.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeJsonViewerModal();
      }
    };
    if (isJsonViewerModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isJsonViewerModalOpen, closeJsonViewerModal]);


  if (!isJsonViewerModalOpen || !jsonViewerData) return null;

  const formattedJson = JSON.stringify(jsonViewerData, null, 2);

  // ✅ 클립보드 복사 핸들러 함수
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson);
      setNotification({
        message: 'JSON 데이터가 클립보드에 복사되었습니다.',
        type: 'success',
      });
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      setNotification({
        message: '클립보드 복사에 실패했습니다.',
        type: 'error',
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[60] p-4">
      <div className="bg-elevated rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-fade-in">
        <div className="flex justify-between items-center p-4 border-b border-primary">
          <h2 className="text-xl font-bold text-primary truncate pr-4">{jsonViewerTitle}</h2>
          <div className="flex items-center gap-2">
            {/* ✅ 복사 버튼 UI 추가 */}
            <button
              onClick={handleCopy}
              className="p-2 text-secondary hover:text-primary rounded-full hover-surface transition-colors"
              title="JSON 복사하기"
            >
              <CopyIcon className="w-5 h-5" />
            </button>
            <button
              onClick={closeJsonViewerModal}
              className="p-2 text-secondary hover:text-primary rounded-full hover-surface transition-colors"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-auto">
          <pre className="text-sm text-primary bg-secondary p-4 rounded-md whitespace-pre-wrap break-all">
            <code>{formattedJson}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default JsonViewerModal;