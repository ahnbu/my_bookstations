import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';
import { sendFeedback } from '../services/feedback.service';

const FeedbackModal: React.FC = () => {
  const { isFeedbackModalOpen, closeFeedbackModal, setNotification } = useUIStore();
  const { session } = useAuthStore();

  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isFeedbackModalOpen && textareaRef.current) {
      // 모달이 열리면 텍스트 입력에 자동 포커스
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isFeedbackModalOpen]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFeedbackModalOpen && !loading) {
        handleClose();
      }
    };

    if (isFeedbackModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFeedbackModalOpen, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.email) {
      setNotification({ message: '로그인이 필요합니다.', type: 'error' });
      return;
    }

    if (feedback.trim().length === 0) {
      setNotification({ message: '의견을 입력해주세요.', type: 'warning' });
      return;
    }

    setLoading(true);

    const result = await sendFeedback({
      feedback: feedback.trim(),
      userEmail: session.user.email,
      userName: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
    });

    if (result.success) {
      setNotification({ message: '소중한 의견이 전송되었습니다. 감사합니다!', type: 'success' });
      setFeedback('');
      closeFeedbackModal();
    } else {
      setNotification({ message: result.error || '전송에 실패했습니다.', type: 'error' });
    }

    setLoading(false);
  };

  const handleClose = () => {
    if (!loading) {
      setFeedback('');
      closeFeedbackModal();
    }
  };

  const isSubmitDisabled = loading || feedback.trim().length === 0 || feedback.length > 100;

  if (!isFeedbackModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">의견 보내기</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 text-2xl disabled:cursor-not-allowed"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              서비스 개선을 위한 의견을 남겨주세요
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={loading}
                maxLength={100}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-500 resize-none"
                placeholder="서비스에 대한 의견, 건의사항, 버그 신고 등을 자유롭게 남겨주세요."
              />
              <div className={`absolute bottom-2 right-2 text-xs ${
                feedback.length > 100 ? 'text-red-500' :
                feedback.length > 80 ? 'text-orange-500' :
                'text-gray-400'
              }`}>
                {feedback.length}/100
              </div>
            </div>
            {feedback.length > 100 && (
              <p className="mt-1 text-sm text-red-500">100자를 초과했습니다.</p>
            )}
          </div>

          {session?.user && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <div><strong>보내는 사람:</strong> {session.user.user_metadata?.full_name || session.user.user_metadata?.name || '익명 사용자'}</div>
              <div><strong>이메일:</strong> {session.user.email}</div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:cursor-not-allowed"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '전송 중...' : '발송'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal;