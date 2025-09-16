import React, { useState, useEffect, useCallback } from 'react';
import { SaveIcon } from './Icons';
import { DevNoteService } from '../services/devNote.service';
import { useAuthStore } from '../stores/useAuthStore';

const DevNoteContent: React.FC = () => {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaveSource, setLastSaveSource] = useState<'server' | 'local' | null>(null);
  const [lastModified, setLastModified] = useState<number>(0);
  const [lastSavedContent, setLastSavedContent] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { user } = useAuthStore();

  // 컴포넌트 마운트 시 저장된 개발노트 로드
  useEffect(() => {
    const loadDevNote = async () => {
      setIsLoading(true);
      try {
        const noteData = await DevNoteService.getDevNote();
        setContent(noteData.content);
        setLastSavedContent(noteData.content);
        setLastSaveSource(noteData.source);
        setLastModified(noteData.lastModified);
      } catch (error) {
        console.error('개발자 노트 로드 실패:', error);
        setSaveStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    loadDevNote();
  }, []);

  // 온라인 상태 변경시 동기화
  useEffect(() => {
    const handleOnline = () => {
      DevNoteService.syncWhenOnline();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // 개발노트 저장 함수
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const result = await DevNoteService.saveDevNote(content);

      if (result.success) {
        setSaveStatus('saved');
        setLastSaveSource(result.source);
        setLastModified(Date.now());
        setLastSavedContent(content);
        setHasUnsavedChanges(false);
        console.log(`개발노트가 ${result.source === 'server' ? '서버에' : '로컬에'} 저장되었습니다.`);
      } else {
        setSaveStatus('error');
      }

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
  }, [content, isSaving]);

  // 변경사항 감지
  useEffect(() => {
    setHasUnsavedChanges(content !== lastSavedContent);
  }, [content, lastSavedContent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  // textarea에서 포커스가 해제될 때 자동 저장
  const handleBlur = () => {
    if (hasUnsavedChanges && !isSaving) {
      handleSave();
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
          개발자 노트 로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* 헤더 */}
      <div>
        <p className="text-sm text-gray-400">
          마크다운으로 메모작성 (Ctrl+S로 저장, 포커스 해제시 자동저장)
        </p>
        {/* 저장 상태 표시 */}
        <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {user ? (
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  navigator.onLine ? 'bg-green-500' : 'bg-yellow-500'
                }`}></span>
                {navigator.onLine ? '온라인' : '오프라인'} •
                마지막 저장: {lastSaveSource === 'server' ? '서버' : '로컬'}
              </span>
            ) : (
              <span className="text-yellow-500">비로그인 상태 (로컬 저장만 가능)</span>
            )}
          </div>
          {/* 변경사항 상태 표시 */}
          <div className="flex items-center gap-1">
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1 text-orange-400">
                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                변경사항 있음
              </span>
            ) : (
              saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  저장됨
                </span>
              )
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                저장 실패
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-center">
        <button
          onClick={handleSave}
          disabled={isSaving || !hasUnsavedChanges}
          className={`btn-base flex-1 ${
            saveStatus === 'saved' && !hasUnsavedChanges
              ? 'btn-success'
              : saveStatus === 'error'
              ? 'btn-danger'
              : isSaving
              ? 'btn-secondary'
              : hasUnsavedChanges
              ? 'btn-primary'
              : 'btn-secondary opacity-50'
          }`}
        >
          {saveStatus === 'saving' ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              저장 중...
            </>
          ) : saveStatus === 'saved' && !hasUnsavedChanges ? (
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
          ) : hasUnsavedChanges ? (
            <>
              <SaveIcon className="w-4 h-4" />
              저장
            </>
          ) : (
            <>
              <SaveIcon className="w-4 h-4" />
              저장됨
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
          onBlur={handleBlur}
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
            {lastModified > 0 ? (
              <span className="ml-1">
                마지막 수정: {new Date(lastModified).toLocaleString('ko-KR')}
              </span>
            ) : (
              <span className="ml-1">저장된 내용 없음</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default DevNoteContent;