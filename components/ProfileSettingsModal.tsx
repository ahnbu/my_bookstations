import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';
import { EyeIcon, EyeOffIcon } from './Icons';

const ProfileSettingsModal: React.FC = () => {
  const { isProfileModalOpen, closeProfileModal, setNotification } = useUIStore();
  const { updatePassword, deleteAccount } = useAuthStore();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const newPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isProfileModalOpen && newPasswordRef.current) {
      // 모달이 열리면 새 비밀번호 필드에 자동 포커스
      setTimeout(() => {
        newPasswordRef.current?.focus();
      }, 100);
    }
  }, [isProfileModalOpen]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setNotification({ message: '새 비밀번호가 일치하지 않습니다.', type: 'error' });
      return;
    }
    
    if (newPassword.length < 6) {
      setNotification({ message: '비밀번호는 최소 6자 이상이어야 합니다.', type: 'error' });
      return;
    }
    
    setLoading(true);
    const result = await updatePassword(newPassword);
    
    if (result.success) {
      setNotification({ message: '비밀번호가 성공적으로 변경되었습니다.', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      closeProfileModal();
    } else {
      setNotification({ message: result.error || '비밀번호 변경에 실패했습니다.', type: 'error' });
    }
    
    setLoading(false);
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    closeProfileModal();
  };

  const handleDeleteAccount = async () => {
    // 1차 확인
    const firstConfirm = window.confirm(
      '정말로 회원탈퇴를 하시겠습니까?\n\n탈퇴 시 모든 도서 정보, 설정, 개인 데이터가 영구적으로 삭제됩니다.'
    );

    if (!firstConfirm) {
      return;
    }

    // 2차 확인 (더 강력한 경고)
    const secondConfirm = window.confirm(
      '⚠️ 최종 확인 ⚠️\n\n이 작업은 되돌릴 수 없습니다.\n계정과 모든 데이터가 완전히 삭제됩니다.\n\n정말로 계속하시겠습니까?'
    );

    if (!secondConfirm) {
      return;
    }

    setIsDeleting(true);

    try {
      const result = await deleteAccount();

      if (result.success) {
        setNotification({
          message: '회원탈퇴가 완료되었습니다. 그동안 이용해주셔서 감사합니다.',
          type: 'success'
        });

        // 탈퇴 성공 후 모달 닫기
        closeProfileModal();

        // 홈페이지로 리디렉션 (옵션)
        // window.location.href = '/';
      } else {
        setNotification({
          message: result.error || '회원탈퇴 처리 중 오류가 발생했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Account deletion error:', error);
      setNotification({
        message: '회원탈퇴 처리 중 예상치 못한 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };


  if (!isProfileModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">계정 관리</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              현재 비밀번호
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-500"
              placeholder="현재 비밀번호를 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              새 비밀번호
            </label>
            <div className="relative">
              <input
                ref={newPasswordRef}
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-500"
                placeholder="새 비밀번호를 입력하세요"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={loading}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed"
                title={showNewPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showNewPassword ? (
                  <EyeOffIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              새 비밀번호 확인
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-500"
                placeholder="새 비밀번호를 다시 입력하세요"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed"
                title={showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showConfirmPassword ? (
                  <EyeOffIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>

        {/* 회원탈퇴 섹션 */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="mb-3">
            {/* <h3 className="text-lg font-semibold text-gray-800 mb-1">회원탈퇴</h3> 
            <p className="text-sm text-gray-600">계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.</p> */}
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={loading || isDeleting}
            className="w-full px-4 py-3 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                탈퇴 처리 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                회원탈퇴
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsModal;