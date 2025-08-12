import React, { useState, useEffect } from 'react';
import { CloseIcon, SaveIcon } from './Icons';

interface DevNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContent?: string;
  onSave: (content: string) => void;
}

const DevNoteModal: React.FC<DevNoteModalProps> = ({ 
  isOpen, 
  onClose, 
  initialContent = '', 
  onSave 
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
      onClose();
    } catch (error) {
      console.error('개발노트 저장 실패:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">개발노트</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 p-6 overflow-hidden">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              마크다운 형식으로 메모를 작성하세요
            </label>
            <div className="text-xs text-gray-500 mb-2">
              단축키: Ctrl+S로 저장, Ctrl+Enter로 줄바꿈
            </div>
          </div>
          
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="여기에 개발 노트를 작성하세요...&#10;&#10;예시:&#10;# API 테스트 결과&#10;- 경기도 전자도서관 API 응답 지연 문제&#10;- 퇴촌도서관 웹방화벽 정책 변경&#10;- ISBN 필터링 로직 개선 필요"
            className="w-full h-96 bg-gray-700 border border-gray-600 text-white text-sm rounded-md p-4 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white border border-gray-600 rounded-md hover:border-gray-500 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                저장 중...
              </>
            ) : (
              <>
                <SaveIcon className="w-4 h-4" />
                저장
              </>
              )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DevNoteModal;
