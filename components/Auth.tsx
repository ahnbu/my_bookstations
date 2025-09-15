import React, { useState, useEffect, useRef } from 'react';
import Spinner from './Spinner';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { SettingsIcon } from './Icons';
import { isAdmin } from '../utils/adminCheck';

const Auth: React.FC = () => {
    const { session, signOut } = useAuthStore();
    const { openAuthModal, openProfileModal, openSettingsModal, openFeedbackModal, openAdminModal, setNotification } = useUIStore();
    const [loading, setLoading] = useState(false);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 사용자가 변경될 때 이미지 에러 상태 리셋
    useEffect(() => {
        setImageLoadError(false);
    }, [session?.user?.id]);

    // 외부 클릭 감지를 위한 useEffect
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-2">
                <Spinner />
            </div>
        );
    }

    if (session) {
        const { user } = session;
        const userAvatar = user.user_metadata?.avatar_url;
        const userEmail = user.email;

        return (
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 hover:bg-gray-800 p-2 rounded-lg transition-colors duration-200"
                    title="프로필 메뉴"
                >
                    {userAvatar && !imageLoadError ? (
                        <img
                            src={userAvatar}
                            alt="User avatar"
                            className="w-8 h-8 rounded-full"
                            onError={() => setImageLoadError(true)}
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                                {userEmail?.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                </button>

                {/* 드롭다운 메뉴 */}
                {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                        {/* 사용자 정보 섹션 */}
                        <div className="px-4 py-3 border-b border-gray-100">
                            <div className="text-sm font-medium text-gray-900">
                                {user.user_metadata?.full_name || user.user_metadata?.name || '사용자'}
                            </div>
                            <div className="text-sm text-gray-500 truncate">
                                {userEmail}
                            </div>
                        </div>

                        {/* 메뉴 아이템들 */}
                        <div className="py-1">
                            <button
                                onClick={() => {
                                    setIsDropdownOpen(false);
                                    openSettingsModal();
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <SettingsIcon className="w-4 h-4 mr-3 text-gray-500" />
                                맞춤 설정
                            </button>
                            <button
                                onClick={() => {
                                    setIsDropdownOpen(false);
                                    openProfileModal();
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <svg className="w-4 h-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                계정 관리
                            </button>
                            <button
                                onClick={() => {
                                    setIsDropdownOpen(false);
                                    openFeedbackModal();
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <svg className="w-4 h-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                의견 보내기
                            </button>
                            {/* 관리자 기능 메뉴 - 관리자에게만 표시 */}
                            {isAdmin(userEmail) && (
                                <button
                                    onClick={() => {
                                        setIsDropdownOpen(false);
                                        openAdminModal();
                                    }}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-4 h-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    관리자 기능
                                </button>
                            )}
                        </div>

                        {/* 로그아웃 버튼 */}
                        <div className="mt-2 pt-2 border-t border-gray-100">
                            <button
                                onClick={async () => {
                                    if (window.confirm('로그아웃 하시겠습니까?')) {
                                        setIsDropdownOpen(false);
                                        await signOut();
                                        setNotification({ message: '로그아웃되었습니다.', type: 'success' });
                                    }
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <svg className="w-4 h-4 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                로그아웃
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => openAuthModal('login')}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-300 text-sm"
            >
                로그인
            </button>
            <button
                onClick={() => openAuthModal('signup')}
                className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors duration-300 text-sm"
            >
                회원가입
            </button>
        </div>
    );
};

export default Auth;