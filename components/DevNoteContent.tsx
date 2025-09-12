import React, { useState, useEffect } from 'react';
import { SaveIcon } from './Icons';

const DevNoteContent: React.FC = () => {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // 컴포넌트 마운트 시 저장된 개발노트 로드
  useEffect(() => {
    const savedNote = localStorage.getItem('devNote');
    if (savedNote) {
      setContent(savedNote);
    }
  }, []);

  // 개발노트 저장 함수
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // 로컬 스토리지에 저장
      localStorage.setItem('devNote', content);
      setSaveStatus('saved');
      console.log('개발노트가 저장되었습니다.');
      
      // 2초 후 저장 상태 초기화
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('개발노트 저장 실패:', error);
      setSaveStatus('error');
      
      // 3초 후 오류 상태 초기화
      setTimeout(() => setSaveStatus('idle'), 3000);
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

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">
            마크다운 형식으로 메모를 작성하세요 • 단축키: Ctrl+S로 저장
          </p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
            saveStatus === 'saved' 
              ? 'bg-green-600 text-white' 
              : saveStatus === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {saveStatus === 'saving' ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              저장 중...
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              저장 완료!
            </>
          ) : saveStatus === 'error' ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              저장 실패
            </>
          ) : (
            <>
              <SaveIcon className="w-4 h-4" />
              저장
            </>
          )}
        </button>
      </div>

      {/* 텍스트 에리어 */}
      <div className="flex-1">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="여기에 개발 노트를 작성하세요...&#10;&#10;예시:&#10;# API 테스트 결과&#10;- 경기도 전자도서관 API 응답 지연 문제&#10;- 퇴촌도서관 웹방화벽 정책 변경&#10;- ISBN 필터링 로직 개선 필요&#10;&#10;## 해결해야 할 문제&#10;- [ ] API 응답 속도 개선&#10;- [ ] 에러 핸들링 강화&#10;- [x] 사용자 인터페이스 개선&#10;&#10;## 참고 링크&#10;- [React 공식문서](https://react.dev)&#10;- [TypeScript 가이드](https://www.typescriptlang.org/docs/)"
          className="w-full h-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-4 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono leading-relaxed"
        />
      </div>

      {/* 상태 표시 */}
      {content.length > 0 && (
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>{content.length.toLocaleString()}자</span>
          <span>
            {content.split('\n').length.toLocaleString()}줄 • 
            마지막 저장: {localStorage.getItem('devNote') ? '로컬 저장소' : '저장된 내용 없음'}
          </span>
        </div>
      )}
    </div>
  );
};

export default DevNoteContent;